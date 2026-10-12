import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'astro/zod';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const databaseSchema = z.object({
  id: uuid,
  data_sources: z.array(z.object({ id: uuid, name: z.string() })),
});
const pageSchema = z.object({
  object: z.literal('page'),
  id: uuid,
  properties: z.record(z.string(), z.looseObject({
    type: z.string(),
    title: z.array(z.object({ plain_text: z.string() })).optional(),
  })),
});
const listSchema = z.object({
  results: z.array(pageSchema),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
  request_status: z.object({ type: z.string() }).optional(),
});
const markdownSchema = z.object({
  markdown: z.string(),
  truncated: z.boolean(),
  unknown_block_ids: z.array(uuid),
});

async function main() {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) throw new Error('请在本地 .env 中配置 NOTION_TOKEN。');
  const databaseId = uuid.parse(process.argv[2] || process.env.NOTION_DATABASE_ID);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2026-03-11',
    'Content-Type': 'application/json',
  };

  async function request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`https://api.notion.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Notion 请求失败：HTTP ${response.status}；请检查 Token、授权和资源 ID。`);
    return response.json();
  }

  const database = databaseSchema.parse(await request(`databases/${databaseId}`));
  const requestedSource = process.env.NOTION_DATA_SOURCE_ID;
  const source = requestedSource
    ? database.data_sources.find(item => item.id === requestedSource)
    : database.data_sources.length === 1 ? database.data_sources[0] : undefined;
  if (!source) {
    console.log(JSON.stringify({ data_sources: database.data_sources }, null, 2));
    throw new Error('请从上述数据源中选择文章库，在 .env 配置 NOTION_DATA_SOURCE_ID。');
  }

  const pages: z.infer<typeof pageSchema>[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let listRequests = 0;
  do {
    const list = listSchema.parse(await request(`data_sources/${source.id}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    }));
    listRequests++;
    if (list.request_status?.type === 'incomplete') throw new Error('文章列表不完整，停止验证。');
    pages.push(...list.results);
    if (!list.has_more) break;
    if (!list.next_cursor || cursors.has(list.next_cursor) || listRequests >= 100) {
      throw new Error('文章列表分页异常或超过验证范围，停止验证。');
    }
    cursors.add(list.next_cursor);
    cursor = list.next_cursor;
  } while (true);

  const titleOf = (page: z.infer<typeof pageSchema>) =>
    Object.values(page.properties).find(property => property.type === 'title')
      ?.title?.map(item => item.plain_text).join('') || '未命名文章';
  console.log(JSON.stringify({
    databaseId: database.id,
    dataSourceId: source.id,
    dataSourceName: source.name,
    articleCount: pages.length,
    listRequests,
    articles: pages.map(page => ({ id: page.id, title: titleOf(page) })),
  }, null, 2));

  const requestedPageId = process.argv[3];
  const firstPage = requestedPageId
    ? pages.find(page => page.id === uuid.parse(requestedPageId))
    : pages.find(page => Object.values(page.properties).some(property =>
      property.type === 'title' && property.title?.some(item => item.plain_text.trim()))) ?? pages[0];
  if (!firstPage) throw new Error('文章库为空，或指定的文章不在这个文章库中。');
  const markdown = markdownSchema.parse(await request(`pages/${firstPage.id}/markdown`));
  if (markdown.truncated || markdown.unknown_block_ids.length || /<unknown\b/.test(markdown.markdown)) {
    throw new Error('所选文章存在缺失内容块，停止导出，请检查内容类型或授权。');
  }
  if (!markdown.markdown.trim()) throw new Error('所选文章正文为空。');

  const outputDir = '.artifacts/notion-verification';
  const markdownPath = `${outputDir}/${firstPage.id}.md`;
  const manifest = {
    capturedAt: new Date().toISOString(),
    databaseId: database.id,
    dataSourceId: source.id,
    articleCount: pages.length,
    listRequests,
    article: { id: firstPage.id, title: titleOf(firstPage), properties: firstPage.properties },
    markdown: {
      path: markdownPath,
      length: markdown.markdown.length,
      sha256: createHash('sha256').update(markdown.markdown).digest('hex'),
      truncated: markdown.truncated,
      unknownBlockIds: markdown.unknown_block_ids,
    },
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(markdownPath, markdown.markdown, 'utf8');
  await writeFile(`${outputDir}/${database.id}.json`, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(JSON.stringify({ title: titleOf(firstPage), ...manifest.markdown }, null, 2));
  console.log('正文已保存到本地忽略目录；本次只读取和验证，不会发布文章。');
}

main().catch(error => {
  console.error(error instanceof z.ZodError
    ? 'Notion 配置或响应格式不符合预期，请检查 ID 格式与 API 版本。'
    : error instanceof Error ? error.message : 'Notion 验证失败。');
  process.exitCode = 1;
});
