import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { publishSnapshot } from '../src/sync/index.ts';

for (const { label, base, siteUrl } of [
  { label: '本地根路径', base: '/', siteUrl: undefined },
  { label: 'Pages 项目路径', base: '/my-blog/', siteUrl: 'https://example.com' },
]) {
  test(`开发命令在${label}读取已同步文章和持久图片`, async t => {
    await mkdir('.cache/tests', { recursive: true });
    const workspace = await mkdtemp(join(process.cwd(), '.cache/tests/dev-test-'));
    assert.ok(workspace.startsWith(join(process.cwd(), '.cache/tests') + (process.platform === 'win32' ? '\\' : '/')));
    t.after(() => rm(workspace, { recursive: true, force: true, maxRetries: 3 }));
    const snapshot = join(workspace, 'published');
    const contentDir = join(workspace, 'src/content/blog');
    const publicDir = join(workspace, 'public');
    await mkdir(contentDir, { recursive: true });
    await mkdir(join(publicDir, 'article-assets'), { recursive: true });
    const id = '33333333-3333-4333-8333-333333333333';
    await writeFile(join(contentDir, id + '.md'), '---\n' + JSON.stringify({ title: '开发模式的云端文章', pubDate: '2026-10-01' }) + `\n---\n## 已同步正文\n\n![同步图片](${base}article-assets/dev.png)`);
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==', 'base64');
    await writeFile(join(publicDir, 'article-assets/dev.png'), image);
    const socket = createServer();
    await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
    const address = socket.address();
    assert.ok(address && typeof address !== 'string');
    const port = address.port;
    await new Promise<void>(resolve => socket.close(() => resolve()));
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    const [runner, ...args] = pkg.scripts.dev.split(' ');
    if (runner === 'astro') {
      const astroPackage = fileURLToPath(import.meta.resolve('astro/package.json'));
      const astro = JSON.parse(await readFile(astroPackage, 'utf8'));
      args.unshift(join(dirname(astroPackage), astro.bin.astro));
    } else assert.equal(runner, 'node');
    const env: NodeJS.ProcessEnv = { ...process.env, BLOG_CONTENT_DIR: contentDir, BLOG_PUBLIC_DIR: publicDir, BLOG_CACHE_DIR: join(workspace, 'cache') };
    delete env.SITE_URL;
    delete env.SITE_BASE;
    if (siteUrl) { env.SITE_URL = siteUrl; env.SITE_BASE = base; }
    const server = spawn(process.execPath, [...args, '--ignore-lock', '--host', '127.0.0.1', '--port', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let logs = '';
    server.stdout.on('data', value => { logs += String(value); });
    server.stderr.on('data', value => { logs += String(value); });
    t.after(async () => {
      if (server.exitCode === null) {
        const closed = new Promise<void>(resolve => server.once('exit', () => resolve()));
        server.kill(); await closed;
      }
    });
    const origin = `http://127.0.0.1:${port}`;
    let home = '';
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      assert.equal(server.exitCode, null, '开发服务提前退出：' + logs);
      try {
        const response = await fetch(origin + base, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { home = await response.text(); break; }
      } catch { /* Wait for the real development server to accept requests. */ }
      await delay(100);
    }
    assert.ok(home, '开发服务未就绪：' + logs);
    assert.equal(home.includes('还没有发布文章。'), false, '已同步文章没有接入开发首页');
    assert.match(home, /开发模式的云端文章/);
    assert.ok(home.includes(base + 'blog/' + id + '/'));
    if (siteUrl) assert.ok(home.includes(`href="${siteUrl}${base}"`));
    else assert.doesNotMatch(home, /rel="canonical"|property="og:url"/);
    const detail = await fetch(origin + base + 'blog/' + id + '/');
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), /已同步正文/);
    const asset = await fetch(origin + base + 'article-assets/dev.png');
    assert.equal(asset.status, 200);
    assert.deepEqual(Buffer.from(await asset.arrayBuffer()), image);
    // A running dev server must not lock the snapshot or candidate directories.
    await publishSnapshot({
      outputDir: snapshot, siteBase: base, siteUrl,
      workingCopy: { contentDir, assetsDir: join(publicDir, 'article-assets') },
      async prepare({ contentDir }) {
        await writeFile(join(contentDir, id + '.md'), '---\n' + JSON.stringify({ title: '开发期间同步的新文章', pubDate: '2026-10-01' }) + '\n---\n完整的新快照。');
      },
    });
    assert.ok((await readFile(join(snapshot, 'site/blog', id, 'index.html'), 'utf8')).includes('开发期间同步的新文章'));
  });
}
