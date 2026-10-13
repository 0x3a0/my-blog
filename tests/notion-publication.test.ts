import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

test('无历史状态的发布命令完整读取并替换站点；接口失败保留旧内容，空集合撤回全部文章', async t => {
  await mkdir('.cache/tests', { recursive: true });
  const workspace = await mkdtemp(join(process.cwd(), '.cache/tests/publication-test-'));
  assert.ok(workspace.startsWith(join(process.cwd(), '.cache/tests') + (process.platform === 'win32' ? '\\' : '/')));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const siteDir = join(workspace, 'dist');
  const fixture = join(workspace, 'notion-http-fixture.mjs');
  await writeFile(fixture, `
const id='33333333-3333-4333-8333-333333333333';
const database='11111111-1111-4111-8111-111111111111';
const source='22222222-2222-4222-8222-222222222222';
const page={object:'page',id,url:'https://www.notion.so/'+id,last_edited_time:'2026-10-01T08:00:00Z',in_trash:false,parent:{type:'data_source_id',data_source_id:source},properties:{Name:{type:'title',title:[{plain_text:'完整发布的文章'}]},'to-blog-site':{type:'checkbox',checkbox:true},Published:{type:'date',date:{start:'2026-10-01'}}}};
globalThis.fetch=async (url,options)=>{
  const path=new URL(url).pathname;
  const json=data=>Response.json(data);
  if(new URL(url).hostname!=='api.notion.com')throw new Error('Publication must not request the old website');
  if(process.env.TEST_READ_FAILURE==='true')return new Response('DO-NOT-LOG-REMOTE-SECRET',{status:403});
  if(path==='/v1/databases/'+database)throw new Error('Fixed data source must not retrieve a database');
  if(path==='/v1/data_sources/'+source)return json({id:source,parent:{type:'database_id',database_id:database},properties:{'to-blog-site':{type:'checkbox'}}});
  if(path.endsWith('/query')){
    const body=JSON.parse(options.body);
    if(body.filter?.property!=='to-blog-site'||body.filter?.checkbox?.equals!==true)throw new Error('Query must filter selected articles');
    if(process.env.TEST_EMPTY==='true')return json({results:[],has_more:false,next_cursor:null});
    return json({results:[page],has_more:!body.start_cursor,next_cursor:body.start_cursor?null:'next-page'});
  }
  if(path.endsWith('/markdown'))return json({markdown:'## 可读正文\\n\\n完整成功后才发布。',truncated:false,unknown_block_ids:[]});
  if(path==='/v1/pages/'+id)return json(page);
  throw new Error('Unexpected external API endpoint');
};
`);
  const contentDir = join(workspace, 'src/content/blog');
  const env = { ...process.env, NOTION_TOKEN: 'TEST-SECRET-NEVER-PUBLISH', NOTION_DATABASE_ID: '', NOTION_DATA_SOURCE_ID: '22222222-2222-4222-8222-222222222222', SITE_URL: 'https://example.com', SITE_BASE: '/my-blog/', BLOG_OUT_DIR: siteDir, BLOG_CONTENT_DIR: contentDir, BLOG_PUBLIC_DIR: join(workspace, 'public'), TEST_EMPTY: 'false', TEST_READ_FAILURE: 'false' };
  const args = ['--import', pathToFileURL(fixture).href, 'scripts/sync-notion.ts'];
  const initial = await run(process.execPath, args, { env, timeout: 90_000 });
  assert.match(initial.stdout, /同步成功：1/);
  const homePath = join(siteDir, 'index.html');
  const home = await readFile(homePath, 'utf8');
  await assert.rejects(readFile(join(siteDir, 'blog-publication.json')), { code: 'ENOENT' });
  assert.match(home, /完整发布的文章/);
  const markdownPath = join(contentDir, '33333333-3333-4333-8333-333333333333.md');
  const markdown = await readFile(markdownPath, 'utf8');
  assert.match(markdown, /可读正文/);
  assert.doesNotMatch(home + initial.stdout, /TEST-SECRET|NOTION_TOKEN/);
  await assert.rejects(run(process.execPath, args, { env: { ...env, TEST_READ_FAILURE: 'true' }, timeout: 90_000 }), error => {
    assert.ok(error instanceof Error && 'stderr' in error);
    assert.match(String(error.stderr), /HTTP 403/);
    assert.doesNotMatch(String(error.stderr), /DO-NOT-LOG|TEST-SECRET/); return true;
  });
  assert.equal(await readFile(homePath, 'utf8'), home);
  assert.equal(await readFile(markdownPath, 'utf8'), markdown);
  const empty = await run(process.execPath, args, { env: { ...env, TEST_EMPTY: 'true' }, timeout: 90_000 });
  assert.match(empty.stdout, /同步成功：0/);
  assert.match(await readFile(homePath, 'utf8'), /还没有发布文章/);
  await assert.rejects(readFile(markdownPath), { code: 'ENOENT' });
  await assert.rejects(readFile(join(siteDir, 'blog/33333333-3333-4333-8333-333333333333/index.html')), { code: 'ENOENT' });
});
