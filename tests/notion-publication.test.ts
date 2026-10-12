import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);

test('发布命令仅提交完整成功结果，读取失败退出且保留产物；线上清单缺失不默认为首次发布', async t => {
  await mkdir('.artifacts', { recursive: true });
  const workspace = await mkdtemp(join(process.cwd(), '.artifacts/publication-test-'));
  assert.ok(workspace.startsWith(join(process.cwd(), '.artifacts') + (process.platform === 'win32' ? '\\' : '/')));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const outputDir = join(workspace, 'published');
  const fixture = join(workspace, 'notion-http-fixture.mjs');
  await writeFile(fixture, `
const id='33333333-3333-4333-8333-333333333333';
const database='11111111-1111-4111-8111-111111111111';
const source='22222222-2222-4222-8222-222222222222';
const page={object:'page',id,url:'https://www.notion.so/'+id,last_edited_time:'2026-10-01T08:00:00Z',in_trash:false,parent:{type:'data_source_id',data_source_id:source},properties:{Name:{type:'title',title:[{plain_text:'完整发布的文章'}]},'to-blog-site':{type:'checkbox',checkbox:true},Published:{type:'date',date:{start:'2026-10-01'}}}};
globalThis.fetch=async (url,options)=>{
  const path=new URL(url).pathname;
  const json=data=>Response.json(data);
  if(path.endsWith('blog-publication.json'))return process.env.TEST_PREVIOUS ? json(JSON.parse(process.env.TEST_PREVIOUS)) : new Response('',{status:404});
  if(process.env.TEST_READ_FAILURE==='true')return new Response('DO-NOT-LOG-REMOTE-SECRET',{status:403});
  if(path==='/v1/databases/'+database)return json({id:database,data_sources:[{id:source,name:'blog'}]});
  if(path==='/v1/data_sources/'+source)return json({id:source,properties:{'to-blog-site':{type:'checkbox'}}});
  if(path.endsWith('/query'))return json({results:[page],has_more:false,next_cursor:null});
  if(path.endsWith('/markdown'))return json({markdown:'## 可读正文\\n\\n完整成功后才发布。',truncated:false,unknown_block_ids:[]});
  if(path==='/v1/pages/'+id)return json(page);
  throw new Error('Unexpected external API endpoint');
};
`);
  const env = { ...process.env, NOTION_TOKEN: 'TEST-SECRET-NEVER-PUBLISH', NOTION_DATABASE_ID: '11111111-1111-4111-8111-111111111111', NOTION_DATA_SOURCE_ID: '', SITE_URL: 'https://example.com', SITE_BASE: '/my-blog/', BLOG_SYNC_OUTPUT_DIR: outputDir, NOTION_INITIALIZE: 'true', TEST_PREVIOUS: '', TEST_READ_FAILURE: 'false' };
  const args = ['--import', pathToFileURL(fixture).href, 'scripts/sync-notion.ts', '--restore-published'];
  const initial = await run(process.execPath, args, { env, timeout: 90_000 });
  assert.match(initial.stdout, /同步成功：1/);
  const homePath = join(outputDir, 'site/index.html');
  const home = await readFile(homePath, 'utf8');
  const state = await readFile(join(outputDir, 'site/blog-publication.json'), 'utf8');
  assert.match(home, /完整发布的文章/);
  assert.doesNotMatch(home + state + initial.stdout, /TEST-SECRET|NOTION_TOKEN/);
  await assert.rejects(run(process.execPath, args, { env: { ...env, NOTION_INITIALIZE: 'false' }, timeout: 90_000 }), error => {
    assert.ok(error instanceof Error && 'stderr' in error);
    assert.match(String(error.stderr), /线上发布清单读取失败/); return true;
  });
  await assert.rejects(run(process.execPath, args, { env: { ...env, NOTION_INITIALIZE: 'false', TEST_PREVIOUS: state, TEST_READ_FAILURE: 'true' }, timeout: 90_000 }), error => {
    assert.ok(error instanceof Error && 'stderr' in error);
    assert.match(String(error.stderr), /HTTP 403/);
    assert.doesNotMatch(String(error.stderr), /DO-NOT-LOG|TEST-SECRET/); return true;
  });
  assert.equal(await readFile(homePath, 'utf8'), home);
  assert.equal(await readFile(join(outputDir, 'site/blog-publication.json'), 'utf8'), state);
});
