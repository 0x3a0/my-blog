import { setTimeout as delay } from 'node:timers/promises';
import type { NotionSource } from './notion.ts';

/** Credentials are attached only to api.notion.com, never to article images. */
export function createNotionSource(token: string): NotionSource {
  if (!token.trim()) throw new Error('请配置 NOTION_TOKEN 读取凭据。');
  let nextRequest = 0;
  async function request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      await delay(Math.max(0, nextRequest - Date.now()));
      nextRequest = Date.now() + 350;
      let response: Response;
      try {
        response = await fetch('https://api.notion.com/v1/' + path, {
          method: body ? 'POST' : 'GET', redirect: 'error',
          headers: { Authorization: `Bearer ${token.trim()}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000),
        });
      } catch { throw new Error('Notion 网络读取失败或超时；本次未发布。'); }
      if (response.ok) {
        try { return await response.json(); } catch { throw new Error('Notion 返回了无效的响应内容。'); }
      }
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        const wait = Number(response.headers.get('retry-after') || (attempt + 1));
        if (Number.isFinite(wait) && wait >= 0 && wait <= 60) { await delay(wait * 1000); continue; }
      }
      throw new Error(`Notion 读取失败：HTTP ${response.status}；请检查读取授权与资源 ID。`);
    }
    throw new Error('Notion 读取重试耗尽。');
  }
  return {
    retrieveDatabase: id => request(`databases/${id}`),
    retrieveDataSource: id => request(`data_sources/${id}`),
    query: (id, cursor) => request(`data_sources/${id}/query`, {
      filter: { property: 'to-blog-site', checkbox: { equals: true } }, page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    }),
    retrievePage: id => request(`pages/${id}`),
    readMarkdown: id => request(`pages/${id}/markdown`),
    retrieveBlock: id => request(`blocks/${id}`),
    readProperty: (id, property, cursor) => request(`pages/${id}/properties/${encodeURIComponent(decodeURIComponent(property))}?page_size=100${cursor ? '&start_cursor=' + encodeURIComponent(cursor) : ''}`),
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
