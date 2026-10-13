import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotionSource } from '../src/sync/notion-client.ts';

test('官方 SDK 处理限流及只读查询重试，图片请求不携带 Notion 凭据', async t => {
  const token = 'TEST-NOTION-TOKEN';
  let markdownAttempts = 0;
  let queryAttempts = 0;
  const body = { markdown: '## 正文', truncated: false, unknown_block_ids: [] };
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    if (url.hostname === 'images.example.com') {
      assert.equal(headers.get('authorization'), null);
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
    }
    assert.equal(url.origin, 'https://api.notion.com');
    assert.equal(headers.get('authorization'), 'Bearer ' + token);
    assert.equal(headers.get('notion-version'), '2026-03-11');
    assert.equal(init?.redirect, 'error');
    if (url.pathname.endsWith('/markdown')) {
      if (++markdownAttempts === 1) return Response.json({ code: 'rate_limited', message: 'PRIVATE-REMOTE-CONTENT' }, { status: 429, headers: { 'retry-after': '0' } });
      return Response.json(body);
    }
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      filter: { property: 'to-blog-site', checkbox: { equals: true } },
      page_size: 100, start_cursor: 'opaque-cursor',
    });
    if (++queryAttempts < 3) return Response.json({ code: 'service_unavailable', message: 'PRIVATE-REMOTE-CONTENT' }, { status: 503 });
    return Response.json({ results: [], has_more: false, next_cursor: null });
  });
  const source = createNotionSource(token);
  assert.deepEqual(await source.readMarkdown('33333333-3333-4333-8333-333333333333'), body);
  assert.equal(markdownAttempts, 2);
  await source.query('22222222-2222-4222-8222-222222222222', 'opaque-cursor');
  assert.equal(queryAttempts, 3);
  assert.deepEqual((await source.image('https://images.example.com/image.png')).bytes, Buffer.from([1, 2, 3]));
});

test('永久 API 错误不重试、不输出远程内容，查询重试次数有上限', async t => {
  let calls = 0;
  let status = 403;
  const warnings = t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ code: status === 403 ? 'restricted_resource' : 'service_unavailable', message: 'PRIVATE-REMOTE-CONTENT' }, { status });
  });
  const source = createNotionSource('TEST-NOTION-TOKEN');
  await assert.rejects(source.readMarkdown('33333333-3333-4333-8333-333333333333'), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /HTTP 403/);
    assert.doesNotMatch(error.message, /PRIVATE|TEST-NOTION-TOKEN/);
    return true;
  });
  assert.equal(calls, 1);
  status = 503; calls = 0;
  await assert.rejects(source.query('22222222-2222-4222-8222-222222222222'), /HTTP 503/);
  assert.equal(calls, 3);
  assert.equal(warnings.mock.callCount(), 0);
});
