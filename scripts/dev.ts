import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.BLOG_CONTENT_DIR) {
  const articles = readdirSync(join(root, 'src/content/blog')).filter(name => name.endsWith('.md'));
  console.log(articles.length ? '开发模式读取 src/content/blog 的文章；更新云端内容后运行 pnpm notion:sync，再重启开发服务。' : 'src/content/blog 尚无文章，请先运行 pnpm notion:sync。');
}
process.env.SITE_BASE ||= '/my-blog/';

// Run Astro in this process so Ctrl+C and its dev-server commands keep working.
const astroPackage = fileURLToPath(import.meta.resolve('astro/package.json'));
const { bin } = JSON.parse(readFileSync(astroPackage, 'utf8'));
const cli = join(dirname(astroPackage), bin.astro);
process.argv = [process.execPath, cli, 'dev', ...process.argv.slice(2)];
await import(pathToFileURL(cli).href);
