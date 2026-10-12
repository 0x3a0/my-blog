import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publishSnapshot } from '../src/sync/index.ts';
import { prepareContent } from '../src/sync/content.ts';

test('空分类与摘要通过真实构建，页面显示未分组且不自动补摘要', async t => {
  await mkdir('.artifacts', { recursive: true });
  const workspace = await mkdtemp(join(process.cwd(), '.artifacts/snapshot-test-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const outputDir = join(workspace, 'published');
  await publishSnapshot({
    outputDir, siteBase: '/my-blog/', siteUrl: 'https://example.com',
    async prepare({ contentDir }) {
      await writeFile(join(contentDir, 'article-one.md'), '---\n' + JSON.stringify({
        title: '第一篇文章', description: '', category: '',
        pubDate: '2025-12-31T16:30:00Z', updatedDate: '2026-01-02T08:00:00Z',
      }) + '\n---\n## 开始\n\n正文不会自动成为摘要。');
    },
  });
  const home = await readFile(join(outputDir, 'site/index.html'), 'utf8');
  const detail = await readFile(join(outputDir, 'site/blog/article-one/index.html'), 'utf8');
  const archive = await readFile(join(outputDir, 'site/blogs/index.html'), 'utf8');
  const article = await readFile(join(outputDir, 'content/article-one.md'), 'utf8');
  assert.match(home, /href="\/my-blog\/blog\/article-one\/"/);
  assert.match(home, /未分组/);
  assert.doesNotMatch(home, /正文不会自动成为摘要/);
  assert.match(detail, /正文不会自动成为摘要/);
  assert.match(detail, /2026年1月1日/);
  assert.match(detail, /未分组/);
  assert.match(archive, /2026/);
  assert.match(archive, /未分组/);
  assert.match(article, /"description":"","category":""/);
});

test('图片与结构保留，资源失败和构建失败均保留整个旧快照', async t => {
  await mkdir('.artifacts', { recursive: true });
  const workspace = await mkdtemp(join(process.cwd(), '.artifacts/resources-test-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const outputDir = join(workspace, 'published');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==', 'base64');
  let imageFailed = false;
  const options = {
    outputDir, siteBase: '/my-blog/', siteUrl: 'https://example.com',
    async prepare({ contentDir, publicDir }: { contentDir: string; publicDir: string }) {
      const prepared = await prepareContent({
        id: 'article-rich', publicDir, siteBase: '/my-blog/', imageCache: new Map(),
        body: '## 阅读\n\n![图片](https://images.example.com/one.png)\n\n```ts\nconst answer = 42;\n```\n\n| 项目 | 数值 |\n| --- | --- |\n| 结果 | 42 |\n\n> 引用文字',
        source: { async image() { if (imageFailed) throw new Error('资源不可用'); return { bytes: png, contentType: 'image/png' }; } },
      });
      await writeFile(join(contentDir, 'article-rich.md'), '---\n' + JSON.stringify({
        title: '结构化文章', description: '', category: '', pubDate: '2025-01-01',
      }) + '\n---\n' + prepared.body);
    },
  };
  await publishSnapshot(options);
  const detailPath = join(outputDir, 'site/blog/article-rich/index.html');
  const homePath = join(outputDir, 'site/index.html');
  const detail = await readFile(detailPath, 'utf8');
  const home = await readFile(homePath, 'utf8');
  const asset = detail.match(/src="(\/my-blog\/article-assets\/[^" ]+\.png)"/);
  assert.ok(asset);
  const assetPath = join(outputDir, 'site', asset[1].replace('/my-blog/', ''));
  assert.deepEqual(await readFile(assetPath), png);
  assert.match(detail, /href="#阅读"/);
  assert.match(detail, /<pre/);
  assert.match(detail, /<table>/);
  assert.match(detail, /<blockquote>/);
  assert.doesNotMatch(detail, /images\.example\.com/);
  imageFailed = true;
  await assert.rejects(publishSnapshot(options), /article-rich.*必需图片.*资源 1.*读取失败/);
  imageFailed = false;
  await assert.rejects(publishSnapshot({ ...options, siteUrl: 'invalid-site-url' }));
  assert.equal(await readFile(detailPath, 'utf8'), detail);
  assert.equal(await readFile(homePath, 'utf8'), home);
  assert.deepEqual(await readFile(assetPath), png);
});

test('成功提交空快照撤回详情和列表入口，准备失败不会撤回', async t => {
  await mkdir('.artifacts', { recursive: true });
  const workspace = await mkdtemp(join(process.cwd(), '.artifacts/withdrawal-test-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const outputDir = join(workspace, 'published');
  const settings = { outputDir, siteBase: '/my-blog/', siteUrl: 'https://example.com' };
  await publishSnapshot({ ...settings, async prepare({ contentDir }) {
    await writeFile(join(contentDir, 'article-old.md'), '---\n' + JSON.stringify({
      title: '即将撤回的文章', description: '', category: '', pubDate: '2025-01-01',
    }) + '\n---\n原有正文。');
  } });
  const detailPath = join(outputDir, 'site/blog/article-old/index.html');
  const detail = await readFile(detailPath, 'utf8');
  await assert.rejects(publishSnapshot({ ...settings, async prepare() { throw new Error('列表不完整'); } }), /列表不完整/);
  assert.equal(await readFile(detailPath, 'utf8'), detail);
  await publishSnapshot({ ...settings, async prepare() {} });
  await assert.rejects(readFile(detailPath), { code: 'ENOENT' });
  assert.match(await readFile(join(outputDir, 'site/index.html'), 'utf8'), /还没有发布文章/);
  assert.doesNotMatch(await readFile(join(outputDir, 'site/blogs/index.html'), 'utf8'), /即将撤回的文章/);
});
