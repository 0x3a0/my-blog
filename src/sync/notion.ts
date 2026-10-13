import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { publishSnapshot, type WorkingCopy } from './index.ts';
import { prepareContent } from './content.ts';

export interface NotionSource {
  retrieveDatabase(id: string): Promise<unknown>;
  retrieveDataSource(id: string): Promise<unknown>;
  query(id: string, cursor?: string): Promise<unknown>;
  retrievePage(id: string): Promise<unknown>;
  readMarkdown(id: string): Promise<unknown>;
  retrieveBlock(id: string): Promise<unknown>;
  readProperty(pageId: string, propertyId: string, cursor?: string): Promise<unknown>;
  image(url: string): Promise<{ bytes: Uint8Array; contentType: string }>;
}
export interface NotionSyncOptions {
  databaseId?: string;
  dataSourceId?: string;
  source: NotionSource;
  outputDir?: string;
  siteDir?: string;
  workingCopy?: WorkingCopy;
  siteBase: string;
  siteUrl: string;
}
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform(value => value.toLowerCase());
const property = z.looseObject({ type: z.string() });
const pageSchema = z.object({
  object: z.literal('page'), id: uuid, url: z.string(), last_edited_time: z.iso.datetime({ offset: true }),
  archived: z.boolean().default(false), in_trash: z.boolean(),
  parent: z.looseObject({ type: z.string(), data_source_id: uuid.optional() }),
  properties: z.record(z.string(), property),
});
type Page = z.infer<typeof pageSchema>;
const databaseSchema = z.object({ id: uuid, data_sources: z.array(z.object({ id: uuid, name: z.string() })) });
const dataSourceSchema = z.object({
  id: uuid, parent: z.object({ type: z.literal('database_id'), database_id: uuid }),
  properties: z.record(z.string(), property),
});
const listSchema = z.object({
  results: z.array(pageSchema), has_more: z.boolean(), next_cursor: z.string().nullable(),
  request_status: z.object({ type: z.string() }).optional(),
});
const markdownSchema = z.object({ markdown: z.string(), truncated: z.boolean(), unknown_block_ids: z.array(uuid) });
const textSchema = z.array(z.object({ plain_text: z.string() }));

function publishedDate(value: unknown, id: string) {
  const date = z.object({ start: z.string(), time_zone: z.string().nullable().optional() }).safeParse(value);
  const invalid = () => new Error(`文章 ${id} 的 Published 缺失或无效。`);
  if (!date.success) throw invalid();
  const { start, time_zone: zone } = date.data;
  if (z.iso.date().safeParse(start).success) {
    if (zone) throw invalid();
    return start;
  }
  if (!zone) {
    if (!z.iso.datetime({ offset: true }).safeParse(start).success) throw invalid();
    return new Date(start).toISOString();
  }
  if (!z.iso.datetime({ local: true }).safeParse(start).success || /(?:Z|[+-]\d\d:\d\d)$/.test(start)) throw invalid();
  try {
    const format = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const wallTime = Date.parse(start + 'Z');
    let instant = wallTime;
    for (let retry = 0; retry < 4; retry++) {
      const parts = Object.fromEntries(format.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
      const represented = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
      const difference = Math.floor(wallTime / 1000) * 1000 - represented;
      if (difference === 0) return new Date(instant).toISOString();
      instant += difference;
    }
  } catch { throw invalid(); }
  throw invalid();
}
async function fullText(source: NotionSource, page: Page, value: z.infer<typeof property>, type: 'title' | 'rich_text', label: string) {
  const initial = textSchema.safeParse(value[type]);
  if (!initial.success) throw new Error(`文章 ${page.id} 的 ${label} 内容不完整。`);
  if (initial.data.length < 25) return initial.data.map(t => t.plain_text).join('').trim();
  try {
    const propertyId = z.string().min(1).parse(value.id);
    const text: string[] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    for (let count = 0; count < 100; count++) {
      const list = z.object({ results: z.array(z.looseObject({ type: z.literal(type) })), has_more: z.boolean(), next_cursor: z.string().nullable() }).parse(await source.readProperty(page.id, propertyId, cursor));
      for (const item of list.results) text.push(z.object({ plain_text: z.string() }).parse(item[type]).plain_text);
      if (!list.has_more) { if (list.next_cursor) throw new Error(); return text.join('').trim(); }
      if (!list.next_cursor || cursors.has(list.next_cursor)) throw new Error();
      cursors.add(list.next_cursor); cursor = list.next_cursor;
    }
    throw new Error();
  } catch { throw new Error(`文章 ${page.id} 的 ${label} 分页补读失败，停止同步。`); }
}
async function optionalText(source: NotionSource, page: Page) {
  const value = page.properties.description;
  if (!value) return '';
  if (value.type !== 'rich_text') throw new Error(`文章 ${page.id} 的 description 必须是文本。`);
  return fullText(source, page, value, 'rich_text', 'description');
}
function optionalCategory(page: Page) {
  const value = page.properties.category;
  if (!value) return '';
  if (value.type !== 'select') throw new Error(`文章 ${page.id} 的 category 必须是单选。`);
  const selected = z.object({ name: z.string() }).nullable().safeParse(value.select);
  if (!selected.success) throw new Error(`文章 ${page.id} 的 category 内容不完整。`);
  return selected.data?.name.trim() || '';
}

function selected(page: Page) {
  const value = page.properties['to-blog-site'];
  if (value?.type !== 'checkbox' || typeof value.checkbox !== 'boolean') throw new Error(`文章 ${page.id} 的 to-blog-site 必须是复选框。`);
  return value.checkbox && !page.in_trash && !page.archived;
}
async function metadata(source: NotionSource, page: Page) {
  const titleProperty = Object.values(page.properties).filter(p => p.type === 'title');
  if (titleProperty.length !== 1) throw new Error(`文章 ${page.id} 缺少唯一标题属性。`);
  const title = await fullText(source, page, titleProperty[0], 'title', '标题');
  if (!title) throw new Error(`文章 ${page.id} 的标题为空。`);
  const published = page.properties.Published;
  if (published?.type !== 'date') throw new Error(`文章 ${page.id} 的 Published 必须是日期。`);
  return { title, description: await optionalText(source, page), category: optionalCategory(page), pubDate: publishedDate(published.date, page.id) };
}

async function enumerate(source: NotionSource, id: string) {
  const pages = new Map<string, Page>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let count = 0; count < 100; count++) {
    const list = listSchema.parse(await source.query(id, cursor));
    if (list.request_status && list.request_status.type !== 'complete') throw new Error('Notion 文章列表不完整。');
    for (const page of list.results) {
      if (page.parent.type !== 'data_source_id' || page.parent.data_source_id !== id) throw new Error('Notion 查询返回了不属于文章库的页面。');
      const old = pages.get(page.id);
      if (old && JSON.stringify(old) !== JSON.stringify(page)) throw new Error(`文章 ${page.id} 在分页期间发生变化，请重试。`);
      selected(page);
      pages.set(page.id, page);
    }
    if (!list.has_more) {
      if (list.next_cursor) throw new Error('Notion 文章列表游标异常。');
      return pages;
    }
    if (!list.next_cursor || cursors.has(list.next_cursor)) throw new Error('Notion 文章列表分页异常。');
    cursors.add(list.next_cursor);
    cursor = list.next_cursor;
  }
  throw new Error('Notion 文章列表超过分页上限，无法确认完整性。');
}
async function completeMarkdown(source: NotionSource, id: string, articleId: string, ancestors = new Set<string>(), budget = { remaining: 200 }): Promise<string> {
  if (ancestors.has(id) || ancestors.size >= 8 || --budget.remaining < 0) throw new Error(`文章 ${articleId} 的缺失块补读超过安全上限。`);
  const response = markdownSchema.parse(await source.readMarkdown(id));
  const chain = new Set(ancestors).add(id);
  let body = response.markdown;
  const resolved = new Set<string>();
  let fence: string | undefined;
  for (const line of response.markdown.split('\n')) {
    const delimiter = line.trim().match(/^(`{3,}|~{3,})(.*)$/);
    if (fence) { if (delimiter && delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = undefined; continue; }
    if (delimiter) { fence = delimiter[1]; continue; }
    const placeholder = line.match(/^(\s*)<unknown\b([^>]*)\/>(\s*)$/);
    if (!placeholder) continue;
    const url = placeholder[2].match(/\burl="([^"]*)"/)?.[1];
    const compact = url?.match(/([0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/?$/i)?.[1]?.replaceAll('-', '');
    if (!compact) throw new Error(`文章 ${articleId} 包含无法定位的 unknown 内容。`);
    const blockId = uuid.parse(`${compact.slice(0,8)}-${compact.slice(8,12)}-${compact.slice(12,16)}-${compact.slice(16,20)}-${compact.slice(20)}`);
    let replacement: string;
    try {
      const block = z.looseObject({ object: z.literal('block'), id: uuid, type: z.string() }).parse(await source.retrieveBlock(blockId));
      if (block.id !== blockId) throw new Error('补读响应身份不匹配。');
      if (['embed', 'video', 'audio', 'pdf', 'equation', 'unsupported', 'custom_block'].includes(block.type)) throw new Error(`正文包含首版范围外的 ${block.type} 内容。`);
      if (block.type === 'child_page') {
        const child = z.object({ title: z.string() }).parse(block.child_page);
        replacement = `[${child.title.replaceAll('[', '\\[').replaceAll(']', '\\]')}](${url})`;
      } else if (['bookmark', 'link_preview'].includes(block.type)) {
        const link = z.object({ url: z.string() }).parse(block[block.type]);
        replacement = `[${link.url}](${link.url})`;
      } else replacement = await completeMarkdown(source, blockId, articleId, chain, budget);
    } catch (error) {
      throw new Error(`文章 ${articleId} 的缺失块补读失败：${error instanceof z.ZodError ? '响应不完整。' : error instanceof Error ? error.message : '读取失败。'}`);
    }
    resolved.add(blockId);
    body = body.replace(line, replacement.split('\n').map(part => placeholder[1] + part).join('\n'));
  }
  if (response.unknown_block_ids.some(block => !resolved.has(block)) || (response.truncated && !resolved.size)) throw new Error(`文章 ${articleId} 正文仍不完整，不能发布截断结果。`);
  return body;
}
async function readArticle(source: NotionSource, id: string, sourceId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = pageSchema.parse(await source.retrievePage(id));
    if (!selected(before) || before.parent.data_source_id !== sourceId) throw new Error(`文章 ${id} 的发布选择或所属文章库已变化，请重试。`);
    const data = await metadata(source, before);
    const body = await completeMarkdown(source, id, id);
    const after = pageSchema.parse(await source.retrievePage(id));
    if (before.id !== id || after.id !== id) throw new Error(`文章 ${id} 的响应身份不匹配。`);
    if (JSON.stringify(before) === JSON.stringify(after)) return { page: before, data, body };
  }
  throw new Error(`文章 ${id} 持续变化，无法取得一致的标题、属性和正文。`);
}

/** One complete read, candidate build and atomic publication; never writes to Notion. */
export async function syncNotion(options: NotionSyncOptions) {
  let articleCount = 0;
  let verify: (() => Promise<void>) | undefined;
  try {
    const configuredDatabaseId = options.databaseId ? uuid.parse(options.databaseId) : undefined;
    const configuredSourceId = options.dataSourceId ? uuid.parse(options.dataSourceId) : undefined;
    if (!configuredDatabaseId && !configuredSourceId) throw new Error('请配置 NOTION_DATA_SOURCE_ID 或 NOTION_DATABASE_ID。');
    return { ...await publishSnapshot({ ...options, verify: async () => { await verify?.(); }, async prepare({ contentDir, publicDir }) {
      let sourceId = configuredSourceId;
      if (!sourceId) {
        const database = databaseSchema.parse(await options.source.retrieveDatabase(configuredDatabaseId!));
        if (database.id !== configuredDatabaseId) throw new Error('Notion 数据库身份不匹配。');
        if (database.data_sources.length !== 1) throw new Error('请明确配置数据库所属的 NOTION_DATA_SOURCE_ID。');
        sourceId = database.data_sources[0].id;
      }
      const dataSource = dataSourceSchema.parse(await options.source.retrieveDataSource(sourceId));
      if (dataSource.id !== sourceId) throw new Error('Notion 数据源身份不匹配。');
      const databaseId = dataSource.parent.database_id;
      if (configuredDatabaseId && databaseId !== configuredDatabaseId) throw new Error('Notion 数据源不属于配置的数据库。');
      if (dataSource.properties['to-blog-site']?.type !== 'checkbox') throw new Error('Notion 文章库缺少 to-blog-site 复选框，请先配置。');
      const pages = await enumerate(options.source, dataSource.id);
      const chosen = [...pages.values()].filter(selected);
      const imageCache = new Map<string, string>();
      const published = new Map(chosen.map(p => [p.id.replaceAll('-', ''), options.siteBase.replace(/\/?$/, '/') + 'blog/' + p.id + '/']));
      const captured = new Map<string, Page>();
      for (const page of chosen) {
        const article = await readArticle(options.source, page.id, dataSource.id);
        captured.set(page.id, article.page);
        const content = await prepareContent({ id: page.id, body: article.body, published, source: options.source, publicDir, siteBase: options.siteBase, imageCache });
        await writeFile(join(contentDir, page.id + '.md'), '---\n' + JSON.stringify(article.data) + '\n---\n' + content.body);
      }
      articleCount = chosen.length;
      verify = async () => {
        const current = [...(await enumerate(options.source, dataSource.id)).values()].filter(selected);
        if (current.length !== captured.size || current.some(p => !captured.has(p.id))) throw new Error('Notion 发布集合在同步期间发生变化，请重试。');
        for (const page of captured.values()) {
          const latest = pageSchema.parse(await options.source.retrievePage(page.id));
          if (JSON.stringify(latest) !== JSON.stringify(page)) throw new Error(`文章 ${page.id} 在构建期间发生变化，请重试。`);
        }
      };
    } }), articleCount };
  } catch (error) {
    if (error instanceof z.ZodError) throw new Error('Notion 配置或响应不完整，整次同步已停止。');
    throw error;
  }
}
