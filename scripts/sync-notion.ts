import { syncNotion } from '../src/sync/notion.ts';
import { createNotionSource } from '../src/sync/notion-client.ts';
import { join } from 'node:path';

async function main() {
  const databaseId = process.env.NOTION_DATABASE_ID?.trim();
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID?.trim();
  if (!dataSourceId && !databaseId) throw new Error('请配置 NOTION_DATA_SOURCE_ID 或 NOTION_DATABASE_ID。');
  const siteUrl = process.env.SITE_URL || 'https://0x3a0.github.io';
  const siteBase = process.env.SITE_BASE || '/my-blog/';
  console.log('开始读取 Notion；全部校验和构建成功后才更新本地快照。');
  const result = await syncNotion({
    databaseId, dataSourceId,
    source: createNotionSource(process.env.NOTION_TOKEN || ''),
    siteDir: process.env.BLOG_OUT_DIR || 'dist',
    workingCopy: { contentDir: process.env.BLOG_CONTENT_DIR || 'src/content/blog', assetsDir: join(process.env.BLOG_PUBLIC_DIR || 'public', 'article-assets') },
    siteUrl, siteBase,
  });
  console.log(`同步成功：${result.articleCount} 篇文章已写入 src/content/blog；图片位于 public/article-assets；网站位于 ${result.siteDir}。`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Notion 同步失败；旧快照保留。'); process.exitCode = 1; });
