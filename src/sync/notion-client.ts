import { setTimeout as delay } from 'node:timers/promises';
import { Client, isHTTPResponseError } from '@notionhq/client';
import type { NotionSource } from './notion.ts';

/** Credentials are attached only to api.notion.com, never to article images. */
export function createNotionSource(token: string): NotionSource {
  if (!token.trim()) throw new Error('请配置 NOTION_TOKEN 读取凭据。');
  let nextRequest = 0;
  const client = new Client({
    auth: token.trim(), notionVersion: '2026-03-11', timeoutMs: 30_000,
    retry: { maxRetries: 2, maxRetryDelayMs: 60_000 },
    // Remote error messages can contain private content; report only safe errors below.
    logger: () => {},
    async fetch(url, init) {
      await delay(Math.max(0, nextRequest - Date.now()));
      nextRequest = Date.now() + 350;
      return fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
    },
  });
  async function read<T>(operation: () => Promise<T>, query = false): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); } catch (error) {
        if (!isHTTPResponseError(error)) throw new Error('Notion 网络、响应解析失败或超时；本次未发布。');
        // The SDK does not retry POST server errors. Data-source queries are read-only.
        if (query && attempt < 2 && [500, 503, 504].includes(error.status)) {
          await delay((attempt + 1) * 1000); continue;
        }
        throw new Error(`Notion 读取失败：HTTP ${error.status}；请检查读取授权与资源 ID。`);
      }
    }
  }
  return {
    retrieveDatabase: id => read(() => client.databases.retrieve({ database_id: id })),
    retrieveDataSource: id => read(() => client.dataSources.retrieve({ data_source_id: id })),
    query: (id, cursor) => read(() => client.dataSources.query({
      data_source_id: id, filter: { property: 'to-blog-site', checkbox: { equals: true } },
      page_size: 100, start_cursor: cursor,
    }), true),
    retrievePage: id => read(() => client.pages.retrieve({ page_id: id })),
    readMarkdown: id => read(() => client.pages.retrieveMarkdown({ page_id: id })),
    retrieveBlock: id => read(() => client.blocks.retrieve({ block_id: id })),
    readProperty: (id, property, cursor) => read(() => client.pages.properties.retrieve({
      page_id: id, property_id: property, page_size: 100, start_cursor: cursor,
    })),
    async image(url) {
      try {
        const address = new URL(url);
        if (address.protocol !== 'https:' || address.username || address.password) throw new Error();
        const response = await fetch(address, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok || !response.body) throw new Error();
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 30_000_000) throw new Error();
            chunks.push(value);
          }
        } finally { await reader.cancel(); }
        return { bytes: Buffer.concat(chunks), contentType: response.headers.get('content-type') || '' };
      } catch { throw new Error('必需图片读取失败：请检查公开 HTTPS 地址、图片授权及大小（上限 30 MB）。'); }
    },
  };
}
