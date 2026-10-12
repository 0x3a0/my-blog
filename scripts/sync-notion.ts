import { syncNotion } from '../src/sync/notion.ts';
import { createNotionSource } from '../src/sync/notion-client.ts';
import { publicationSchema } from '../src/sync/notion-state.ts';

async function publishedState(siteUrl: string, siteBase: string) {
  const base = siteBase.replace(/\/?$/, '/');
  const url = new URL(base + 'blog-publication.json', siteUrl);
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' }); } catch { throw new Error('无法读取上次线上发布清单，停止发布。'); }
  if (response.status === 404 && process.env.NOTION_INITIALIZE === 'true') return undefined;
  if (!response.ok) throw new Error(`线上发布清单读取失败（HTTP ${response.status}）；首次接入需手动选择 initialize，其他情况请先恢复清单。`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error('线上发布清单不是有效 JSON，停止发布。'); }
  const parsed = publicationSchema.safeParse(payload);
  if (!parsed.success) throw new Error('线上发布清单无效，停止发布。');
  return parsed.data;
}

async function main() {
  const databaseId = process.env.NOTION_DATABASE_ID?.trim();
  if (!databaseId) throw new Error('请配置 NOTION_DATABASE_ID。');
  const siteUrl = process.env.SITE_URL || 'https://0x3a0.github.io';
  const siteBase = process.env.SITE_BASE || '/my-blog/';
  const previousPublication = process.argv.includes('--restore-published') ? await publishedState(siteUrl, siteBase) : undefined;
  console.log('开始读取 Notion；全部校验和构建成功后才更新本地快照。');
  const result = await syncNotion({
    databaseId, dataSourceId: process.env.NOTION_DATA_SOURCE_ID?.trim() || undefined,
    source: createNotionSource(process.env.NOTION_TOKEN || ''),
    outputDir: process.env.BLOG_SYNC_OUTPUT_DIR || '.artifacts/notion-published',
    siteUrl, siteBase, previousPublication,
  });
  console.log(`同步成功：${result.articleCount} 篇文章，网站保存在 ${result.outputDir}/site。`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Notion 同步失败；旧快照保留。'); process.exitCode = 1; });
