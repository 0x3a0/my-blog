import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { syncNotion } from '../src/sync/notion.ts';

const databaseId = '11111111-1111-4111-8111-111111111111';
const sourceId = '22222222-2222-4222-8222-222222222222';
const articleId = '33333333-3333-4333-8333-333333333333';
function page(id = articleId, title = '从 Notion 写作') {
  return { object: 'page', id, url: `https://www.notion.so/${id.replaceAll('-', '')}`,
    last_edited_time: '2026-10-10T08:00:00Z', in_trash: false, archived: false,
    parent: { type: 'data_source_id', data_source_id: sourceId },
    properties: {
      Name: { type: 'title', title: [{ plain_text: title }] },
      'to-blog-site': { type: 'checkbox', checkbox: true },
      Published: { type: 'date', date: { start: '2026-10-01', end: null, time_zone: null } },
    },
  };
}
function source() {
  const pages = [page()];
  const bodies = new Map([[articleId, '## 中文标题\n\n云端保存的正文。']]);
  return {
    pages, bodies,
    async retrieveDatabase() { return { id: databaseId, data_sources: [{ id: sourceId, name: 'My blog' }] }; },
    async retrieveDataSource() { return { id: sourceId, parent: { type: 'database_id', database_id: databaseId }, properties: {
      Name: { type: 'title' }, 'to-blog-site': { type: 'checkbox' }, Published: { type: 'date' },
    } }; },
    async query() { return { results: structuredClone(pages), has_more: false, next_cursor: null }; },
    async retrievePage(id: string) { const found = pages.find(p => p.id === id); if (!found) throw new Error('HTTP 404'); return structuredClone(found); },
    async readMarkdown(id: string) { return { markdown: bodies.get(id), truncated: false, unknown_block_ids: [] }; },
    async retrieveBlock() { throw new Error('HTTP 404'); },
    async readProperty() { throw new Error('属性补读不可用'); },
    async image() { throw new Error('图片不可用'); },
  };
}
async function workspace(t: { after(fn: () => Promise<void>): void }) {
  await mkdir('.cache/tests', { recursive: true });
  const path = await mkdtemp(join(process.cwd(), '.cache/tests/notion-test-'));
  assert.ok(path.startsWith(join(process.cwd(), '.cache/tests') + (process.platform === 'win32' ? '\\' : '/')));
  t.after(() => rm(path, { recursive: true, force: true }));
  return { outputDir: join(path, 'published'), databaseId, siteUrl: 'https://example.com', siteBase: '/my-blog/' };
}

test('仅勾选文章完整同步到首页、归档、详情，改标题更新原地址', async t => {
  const options = await workspace(t);
  const notion = source();
  const privatePage = page('44444444-4444-4444-8444-444444444444', '私人草稿');
  privatePage.properties['to-blog-site'].checkbox = false;
  notion.pages.push(privatePage);
  await syncNotion({ ...options, source: notion });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const detail = await readFile(detailPath, 'utf8');
  assert.match(detail, /从 Notion 写作/);
  assert.match(detail, /云端保存的正文/);
  assert.match(detail, /href="#中文标题"/);
  assert.match(detail, /2026年10月1日/);
  for (const route of ['index.html', 'blogs/index.html']) {
    const html = await readFile(join(options.outputDir, 'site', route), 'utf8');
    assert.match(html, new RegExp(`/my-blog/blog/${articleId}/`));
    assert.doesNotMatch(html, /私人草稿/);
  }
  notion.pages[0].properties.Name.title[0].plain_text = '最新标题';
  notion.pages[0].last_edited_time = '2026-10-11T08:00:00Z';
  notion.bodies.set(articleId, '## 新段落\n\n最新保存内容');
  await syncNotion({ ...options, source: notion });
  const updated = await readFile(detailPath, 'utf8');
  assert.match(updated, /最新标题/);
  assert.match(updated, /最新保存内容/);
  assert.doesNotMatch(updated, /云端保存的正文/);
});

test('固定数据源跳过数据库读取并校验本次来源，不生成发布清单', async t => {
  const options = await workspace(t);
  const notion = source();
  await syncNotion({ ...options, source: notion });
  const statePath = join(options.outputDir, 'site/blog-publication.json');
  await assert.rejects(readFile(statePath), { code: 'ENOENT' });
  await assert.rejects(readFile(join(options.outputDir, 'manifest.json')), { code: 'ENOENT' });
  const direct = { ...notion, async retrieveDatabase() { throw new Error('不应读取数据库'); } };
  notion.bodies.set(articleId, '固定数据源读取的最新正文');
  await syncNotion({ ...options, databaseId: undefined, dataSourceId: sourceId, source: direct });
  await assert.rejects(readFile(statePath), { code: 'ENOENT' });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const latest = await readFile(detailPath, 'utf8');
  assert.match(latest, /固定数据源读取的最新正文/);
  await assert.rejects(syncNotion({ ...options, databaseId: articleId, dataSourceId: sourceId, source: direct }), /不属于/);
  await assert.rejects(syncNotion({ ...options, databaseId: undefined, dataSourceId: articleId, source: direct }), /数据源身份/);
  await assert.rejects(syncNotion({ ...options, databaseId: undefined, source: direct }), /DATA_SOURCE_ID/);
  assert.equal(await readFile(detailPath, 'utf8'), latest);
  await assert.rejects(readFile(statePath), { code: 'ENOENT' });
});

test('属性清空、缺省、未来日期及跨年时间按作者 Published 展示', async t => {
  const options = await workspace(t);
  const notion = source();
  const first = notion.pages[0];
  Object.assign(first.properties, {
    description: { type: 'rich_text', rich_text: [{ plain_text: '明确填写的摘要' }] },
    category: { type: 'select', select: { name: '技术' } },
    Tags: { type: 'multi_select', multi_select: [{ name: '不是分类' }] },
    'AI custom autofill': { type: 'rich_text', rich_text: [{ plain_text: '不要自动导入的摘要' }] },
  });
  first.properties.Published.date.start = '2025-12-31T16:30:00Z';
  const future = page('44444444-4444-4444-8444-444444444444', '未来日期也发布');
  future.properties.Published.date.start = '2030-01-01';
  const zoned = page('55555555-5555-4555-8555-555555555555', '有时区的日期区间');
  Object.assign(zoned.properties.Published.date, { start: '2025-12-31T08:30:00', end: '2035-01-01', time_zone: 'America/Los_Angeles' });
  notion.pages.push(future, zoned);
  notion.bodies.set(future.id, '未来正文'); notion.bodies.set(zoned.id, '时区正文');
  await syncNotion({ ...options, source: notion });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  assert.match(await readFile(detailPath, 'utf8'), /2026年1月1日/);
  assert.match(await readFile(detailPath, 'utf8'), /技术/);
  const zonedHtml = await readFile(join(options.outputDir, 'site/blog', zoned.id, 'index.html'), 'utf8');
  assert.match(zonedHtml, /2026年1月1日/);
  assert.doesNotMatch(zonedHtml, /2035/);
  const archive = await readFile(join(options.outputDir, 'site/blogs/index.html'), 'utf8');
  assert.ok(archive.indexOf('未来日期也发布') < archive.indexOf('从 Notion 写作'));
  assert.doesNotMatch(archive, /不是分类|不要自动导入的摘要/);
  Object.assign(first.properties, { description: { type: 'rich_text', rich_text: [] }, category: { type: 'select', select: null } });
  first.properties.Published.date.start = '2024-12-31';
  await syncNotion({ ...options, source: notion });
  const cleared = await readFile(detailPath, 'utf8');
  assert.match(cleared, /2024年12月31日/);
  assert.match(cleared, /未分组/);
  assert.doesNotMatch(cleared, /明确填写的摘要|不要自动导入的摘要/);
  const saved = await readFile(join(options.outputDir, 'content', articleId + '.md'), 'utf8');
  assert.match(saved, /"description":"","category":""/);
  for (const invalid of [null, { start: '2026-02-30' }]) {
    Object.assign(first.properties.Published, { date: invalid });
    await assert.rejects(syncNotion({ ...options, source: notion }), /Published/);
    assert.equal(await readFile(detailPath, 'utf8'), cleared);
  }
  Object.assign(first.properties.Published, { date: { start: '2026-10-01' } });
  Object.assign(first.properties, { category: { type: 'multi_select', multi_select: [] } });
  await assert.rejects(syncNotion({ ...options, source: notion }), /category/);
  assert.equal(await readFile(detailPath, 'utf8'), cleared);
});

test('图片保存为持久公开资源，签名变化去重，图片失败保留整站', async t => {
  const options = await workspace(t);
  const notion = source();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==', 'base64');
  let unavailable = false;
  const images = { ...notion, async image() { if (unavailable) throw new Error('temporary source expired'); return { bytes: png, contentType: 'image/png' }; } };
  notion.bodies.set(articleId, '## 图片\n\n![山间的日落](https://images.example.com/a.png?signature=first)\n\n图片之后的段落。');
  await syncNotion({ ...options, source: images });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const first = await readFile(detailPath, 'utf8');
  assert.match(first, /alt="山间的日落"/);
  assert.match(first, /<p>山间的日落<\/p>/);
  const asset = first.match(/src="\/my-blog\/(article-assets\/[^" ]+)"/);
  assert.ok(asset);
  assert.deepEqual(await readFile(join(options.outputDir, 'site', asset[1])), png);
  assert.doesNotMatch(first, /signature=|images\.example\.com/);
  notion.bodies.set(articleId, '## 图片\n\n![山间的日落](https://images.example.com/a.png?signature=second)\n\n![同一张图](https://images.example.com/b.png)');
  await syncNotion({ ...options, source: images });
  assert.deepEqual(await readdir(join(options.outputDir, 'site/article-assets')), [asset[1].split('/')[1]]);
  const previous = await readFile(detailPath, 'utf8');
  unavailable = true;
  await assert.rejects(syncNotion({ ...options, source: images }), /33333333.*图片/);
  assert.equal(await readFile(detailPath, 'utf8'), previous);
  assert.deepEqual(await readFile(join(options.outputDir, 'site', asset[1])), png);
  for (const bytes of [png.subarray(0, 8), Buffer.from([255, 216, 255])]) {
    const damaged = { ...notion, async image() { return { bytes, contentType: bytes.length === 8 ? 'image/png' : 'image/jpeg' }; } };
    await assert.rejects(syncNotion({ ...options, source: damaged }), /33333333.*图片.*资源 1.*校验/);
    assert.equal(await readFile(detailPath, 'utf8'), previous);
  }
});

test('提示框、分栏、表格和代码保留阅读顺序，只有选中文章转博客链接', async t => {
  const options = await workspace(t);
  const notion = source();
  const next = page('44444444-4444-4444-8444-444444444444', '另一篇公开文章');
  notion.pages.push(next); notion.bodies.set(next.id, '## 第二篇\n\n独立正文');
  notion.bodies.set(articleId, [
    '## 阅读指南 {color="blue"}', '',
    '<callout icon="💡" color="yellow_bg">', '\t提示 **重点**', '\t', '\t- 第一项', '\t- 第二项', '</callout>', '',
    '<columns>', '\t<column>', '\t\t左栏段落', '\t\t', '\t\t```ts', '\t\tconst markup = "<unknown/>";', '\t\tconst cost = "$10";', '\t\t```', '\t</column>', '\t<column>', '\t\t右栏段落', '\t</column>', '</columns>', '',
    '<table header-row="true">', '\t<tr>', '\t\t<td>项目</td>', '\t\t<td>数值</td>', '\t</tr>', '\t<tr>', '\t\t<td>答案</td>', '\t\t<td>42</td>', '\t</tr>', '</table>', '',
    `<page url="${next.url}">去另一篇</page>`, '',
    '[带锚点的文章](' + next.url + '#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa)', '',
    '<page url="https://www.notion.so/66666666666646668666666666666666">私密子页</page>', '',
    '正文中的 <span color="red" underline="true">强调</span><br>换行', '',
    'NOTIONCODE0TOKEN 与 `NOTIONCODE1TOKEN` 原样保留。', '',
    '<table_of_contents/>',
  ].join('\n'));
  await syncNotion({ ...options, source: notion });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const html = await readFile(detailPath, 'utf8');
  assert.match(html, /<blockquote>/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /<pre/);
  assert.ok(html.indexOf('左栏段落') < html.indexOf('右栏段落'));
  assert.match(html, new RegExp(`href="/my-blog/blog/${next.id}/"`));
  // Unknown Notion block anchors cannot safely map to Astro heading IDs.
  assert.match(html, new RegExp(`href="${next.url}#aaaaaaaa`));
  assert.match(html, /href="https:\/\/www.notion.so\/66666666666646668666666666666666"/);
  await assert.rejects(readFile(join(options.outputDir, 'site/blog/66666666-6666-4666-8666-666666666666/index.html')), { code: 'ENOENT' });
  assert.match(html, /href="#阅读指南"/);
  assert.match(html, /NOTIONCODE0TOKEN 与 <code>NOTIONCODE1TOKEN<\/code> 原样保留/);
  assert.doesNotMatch(html, /\{color=|<columns>|<callout>|<unknown\/>/);
  for (const unsupported of ['$$\nx^2\n$$', '<video src="https://example.com/v.mp4">视频</video>', '<pdf src="https://example.com/a.pdf">资料</pdf>', '<custom-block definition-id="123"/>']) {
    notion.bodies.set(articleId, unsupported);
    await assert.rejects(syncNotion({ ...options, source: notion }), /33333333.*(?:公式|video|pdf|custom-block)/);
    assert.equal(await readFile(detailPath, 'utf8'), html);
  }
});

test('列表内的提示框保留所属结构，日期提及保留时间、时区和区间', async t => {
  const options = await workspace(t);
  const notion = source();
  notion.bodies.set(articleId, [
    '- 第一项', '\t<callout>', '\t\t子提示', '\t</callout>', '- 第二项', '',
    '<mention-date start="2026-10-12" startTime="10:30" timeZone="Asia/Shanghai"/>', '',
    '<mention-date start="2026-10-12" end="2026-10-15"/>',
  ].join('\n'));
  await syncNotion({ ...options, source: notion });
  const html = await readFile(join(options.outputDir, 'site/blog', articleId, 'index.html'), 'utf8');
  assert.match(html, /<li>\s*<p>第一项<\/p>\s*<blockquote>\s*<p>子提示<\/p>\s*<\/blockquote>\s*<\/li>/);
  assert.match(html, /2026-10-12 10:30 \(Asia\/Shanghai\)/);
  assert.match(html, /2026-10-12 – 2026-10-15/);
});

test('全量结果替换旧站点；混合同步失败保留整站，空正文和完整空集合可提交', async t => {
  const options = await workspace(t);
  const notion = source();
  const moved = page('44444444-4444-4444-8444-444444444444', '移出的文章');
  const trashed = page('55555555-5555-4555-8555-555555555555', '删除的文章');
  notion.pages.push(moved, trashed); notion.bodies.set(moved.id, '被移出前的正文'); notion.bodies.set(trashed.id, '删除前的正文');
  await syncNotion({ ...options, source: notion });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const homePath = join(options.outputDir, 'site/index.html');
  const original = await readFile(detailPath, 'utf8');
  const home = await readFile(homePath, 'utf8');
  const unreadable = { ...notion, async query() { throw new Error('HTTP 403'); } };
  await assert.rejects(syncNotion({ ...options, source: unreadable }), /HTTP 403/);
  assert.equal(await readFile(homePath, 'utf8'), home);
  notion.pages[0].properties['to-blog-site'].checkbox = false;
  const newPage = page('66666666-6666-4666-8666-666666666666', '新文章');
  notion.pages.push(newPage); notion.bodies.set(newPage.id, '<video src="https://example.com/video">范围外</video>');
  await assert.rejects(syncNotion({ ...options, source: notion }), /video/);
  assert.equal(await readFile(detailPath, 'utf8'), original);
  assert.equal(await readFile(homePath, 'utf8'), home);
  notion.bodies.set(newPage.id, '');
  moved.parent.data_source_id = '77777777-7777-4777-8777-777777777777'; trashed.in_trash = true;
  const withdrawalSource = { ...notion, async retrievePage(id: string) {
    if ([articleId, moved.id, trashed.id].includes(id)) throw new Error('已不选中的旧文章不得请求');
    return notion.retrievePage(id);
  }, async query() { return { results: structuredClone(notion.pages.filter(p => p.parent.data_source_id === sourceId && !p.in_trash)), has_more: false, next_cursor: null }; } };
  await syncNotion({ ...options, source: withdrawalSource });
  for (const id of [articleId, moved.id, trashed.id]) await assert.rejects(readFile(join(options.outputDir, 'site/blog', id, 'index.html')), { code: 'ENOENT' });
  const emptyPath = join(options.outputDir, 'site/blog', newPage.id, 'index.html');
  assert.match(await readFile(emptyPath, 'utf8'), /新文章/);
  assert.doesNotMatch(await readFile(emptyPath, 'utf8'), /范围外/);
  const emptySource = { ...notion, async query() { return { results: [], has_more: false, next_cursor: null }; }, async retrievePage() { throw new Error('旧文章不可读也无需请求'); } };
  await syncNotion({ ...options, source: emptySource });
  assert.match(await readFile(homePath, 'utf8'), /还没有发布文章/);
  assert.match(await readFile(join(options.outputDir, 'site/blogs/index.html'), 'utf8'), /还没有发布文章/);
  await assert.rejects(readFile(emptyPath), { code: 'ENOENT' });
});

test('缺失块补读完整后才发布，表格富文本保留；未知嵌入和不可读块不被略过', async t => {
  const options = await workspace(t);
  const notion = source();
  const blockId = '88888888-8888-4888-8888-888888888888';
  let missing = false;
  let type = 'paragraph';
  const recovery = {
    ...notion,
    async readMarkdown(id: string) {
      if (id === articleId) return { markdown: `## 补读\n\n<unknown url="https://www.notion.so/${blockId.replaceAll('-', '')}" alt="not loaded"/>`, truncated: true, unknown_block_ids: [blockId] };
      if (missing) throw new Error('HTTP 404');
      return { markdown: '<table header-row="true">\n<tr><td>项目</td><td>内容</td></tr>\n<tr><td>恢复</td><td>**完整文本** 和 `code`</td></tr>\n</table>', truncated: false, unknown_block_ids: [] };
    },
    async retrieveBlock() { return { object: 'block', id: blockId, type }; },
  };
  await syncNotion({ ...options, source: recovery });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const html = await readFile(detailPath, 'utf8');
  assert.match(html, /<strong>完整文本<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.doesNotMatch(html, /not loaded/);
  missing = true;
  await assert.rejects(syncNotion({ ...options, source: recovery }), /33333333.*(?:缺失|补读|不完整)/);
  assert.equal(await readFile(detailPath, 'utf8'), html);
  missing = false; type = 'embed';
  await assert.rejects(syncNotion({ ...options, source: recovery }), /33333333.*embed/);
  assert.equal(await readFile(detailPath, 'utf8'), html);
});

test('完整分页与一致版本才可提交，缺失字段、游标异常和持续编辑保留旧站点', async t => {
  const options = await workspace(t);
  const notion = source();
  const second = page('44444444-4444-4444-8444-444444444444', '第二页的文章');
  notion.pages.push(second); notion.bodies.set(second.id, '第二页正文');
  const paginated = { ...notion, async query(_id: string, cursor?: string) {
    return cursor ? { results: [second], has_more: false, next_cursor: null } : { results: [notion.pages[0], notion.pages[0]], has_more: true, next_cursor: 'next-page' };
  } };
  await syncNotion({ ...options, source: paginated });
  const homePath = join(options.outputDir, 'site/index.html');
  const html = await readFile(homePath, 'utf8');
  assert.match(html, /第二页的文章/);
  const ambiguousSource = { ...notion, async retrieveDatabase() { return { id: databaseId, data_sources: [{ id: sourceId, name: 'blog' }, { id: articleId, name: 'other' }] }; } };
  await assert.rejects(syncNotion({ ...options, source: ambiguousSource }), /DATA_SOURCE_ID/);
  for (const query of [
    async () => ({ results: [], has_more: false, next_cursor: null, request_status: { type: 'incomplete' } }),
    async () => ({ results: [notion.pages[0]], has_more: true, next_cursor: 'repeated' }),
  ]) await assert.rejects(syncNotion({ ...options, source: { ...notion, query } }), /不完整|分页/);
  const missingSelection = { ...notion, async retrieveDataSource() { return { id: sourceId, parent: { type: 'database_id', database_id: databaseId }, properties: { Name: { type: 'title' } } }; } };
  await assert.rejects(syncNotion({ ...options, source: missingSelection }), /to-blog-site/);
  let changed = false;
  const changedOnce = { ...notion, async readMarkdown(id: string) {
    if (!changed && id === articleId) {
      changed = true; notion.pages[0].last_edited_time = '2026-10-12T08:00:00Z';
      notion.pages[0].properties.Name.title[0].plain_text = '编辑后的完整版本'; notion.bodies.set(id, '完整的新正文');
      return { markdown: '旧版本不能与新标题拼接', truncated: false, unknown_block_ids: [] };
    }
    return notion.readMarkdown(id);
  } };
  await syncNotion({ ...options, source: changedOnce });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const complete = await readFile(detailPath, 'utf8');
  assert.match(complete, /编辑后的完整版本/); assert.match(complete, /完整的新正文/);
  assert.doesNotMatch(complete, /旧版本不能与新标题拼接/);
  let edits = 0;
  const alwaysEditing = { ...notion, async readMarkdown(id: string) {
    notion.pages[0].last_edited_time = `2026-10-12T08:00:0${++edits}Z`; return notion.readMarkdown(id);
  } };
  await assert.rejects(syncNotion({ ...options, source: alwaysEditing }), /持续变化/);
  assert.equal(await readFile(detailPath, 'utf8'), complete);
  assert.doesNotMatch(html, /私人草稿/);
});

test('资源读取期间取消勾选不会发布旧选择，并发任务也不会覆盖正式输出', async t => {
  const options = await workspace(t);
  const notion = source();
  await syncNotion({ ...options, source: notion });
  const homePath = join(options.outputDir, 'site/index.html');
  const html = await readFile(homePath, 'utf8');
  notion.bodies.set(articleId, '![读取过程中取消发布](https://example.com/image.png)');
  const changing = { ...notion, async image() {
    notion.pages[0].properties['to-blog-site'].checkbox = false;
    return { bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==', 'base64'), contentType: 'image/png' };
  } };
  await assert.rejects(syncNotion({ ...options, source: changing }), /发布集合.*变化/);
  assert.equal(await readFile(homePath, 'utf8'), html);
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const slow = { ...notion, async retrieveDatabase() { started.resolve(); await release.promise; throw new Error('模拟读取失败'); } };
  const pending = syncNotion({ ...options, source: slow });
  const failed = assert.rejects(pending, /模拟读取失败/);
  await started.promise;
  await assert.rejects(syncNotion({ ...options, source: notion }), /锁定/);
  assert.equal(await readFile(homePath, 'utf8'), html);
  release.resolve(); await failed;
});

test('长标题补读全部属性分页，未获取完整属性时保留原文章', async t => {
  const options = await workspace(t);
  const notion = source();
  Object.assign(notion.pages[0].properties.Name, { id: 'title', title: Array.from({ length: 25 }, () => ({ plain_text: '长' })) });
  const complete = { ...notion, async readProperty(_page: string, _property: string, cursor?: string) {
    return cursor ? { results: [{ type: 'title', title: { plain_text: '最后一段标题' } }], has_more: false, next_cursor: null }
      : { results: Array.from({ length: 25 }, () => ({ type: 'title', title: { plain_text: '长' } })), has_more: true, next_cursor: 'property-page-2' };
  } };
  await syncNotion({ ...options, source: complete });
  const detailPath = join(options.outputDir, 'site/blog', articleId, 'index.html');
  const html = await readFile(detailPath, 'utf8');
  assert.match(html, /长{25}最后一段标题/);
  await assert.rejects(syncNotion({ ...options, source: notion }), /33333333.*标题.*补读/);
  assert.equal(await readFile(detailPath, 'utf8'), html);
});

test('首页最新五篇与跨年归档一致，同日期顺序稳定且旧年份仍有入口', async t => {
  const options = await workspace(t);
  const notion = source();
  notion.pages.length = 0;
  const dates = ['2025-01-02', '2026-01-01', '2026-05-10', '2026-05-10', '2027-01-01', '2025-12-31', '2024-12-31'];
  for (let index = 0; index < dates.length; index++) {
    const item = page(`33333333-3333-4333-8333-33333333333${index}`, '文章' + index);
    item.properties.Published.date.start = dates[index];
    notion.pages.unshift(item); notion.bodies.set(item.id, '## 开始\n\n只在详情展示的正文。');
  }
  await syncNotion({ ...options, source: notion });
  const home = await readFile(join(options.outputDir, 'site/index.html'), 'utf8');
  const archive = await readFile(join(options.outputDir, 'site/blogs/index.html'), 'utf8');
  assert.match(home, /href="\/my-blog\/blogs\/">Blogs<\/a>/);
  assert.match(home, /href="\/my-blog\/" aria-current="page">Home<\/a>/);
  for (const index of [4,2,3,1,5]) assert.match(home, new RegExp('文章' + index));
  assert.doesNotMatch(home, /文章0|文章6|只在详情展示的正文/);
  assert.ok(home.indexOf('文章2') < home.indexOf('文章3'));
  for (let index = 0; index < 7; index++) assert.match(archive, new RegExp('文章' + index));
  assert.ok(archive.indexOf('id="year-2027"') < archive.indexOf('id="year-2026"'));
  assert.ok(archive.indexOf('id="year-2026"') < archive.indexOf('id="year-2025"'));
  assert.match(archive, /未分组/);
  assert.doesNotMatch(archive, /只在详情展示的正文/);
});
