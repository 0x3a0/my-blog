import { cp, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
export interface WorkingCopy {
  contentDir: string;
  assetsDir: string;
}
export interface SnapshotOptions {
  outputDir?: string;
  siteDir?: string;
  siteBase: string;
  siteUrl: string;
  workingCopy?: WorkingCopy;
  prepare: (directories: { contentDir: string; publicDir: string }) => Promise<void>;
  verify?: () => Promise<void>;
}
const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function within(parent: string, path: string) {
  const child = relative(parent, path);
  return !!child && child !== '..' && !child.startsWith('../') && !child.startsWith('..\\') && !isAbsolute(child);
}

async function move(from: string, to: string) {
  // Windows scanners can briefly retain a directory handle after a build exits.
  for (let attempt = 0; ; attempt++) {
    try { await rename(from, to); return; } catch (error) {
      if (process.platform !== 'win32' || attempt >= 20 || !(error instanceof Error && 'code' in error && ['EPERM', 'EBUSY', 'EACCES'].includes(String(error.code)))) throw error;
      await delay(100);
    }
  }
}

interface Replacement { from: string; to: string; backup: string; old: boolean; installed: boolean }
async function replace(replacements: Replacement[]) {
  try {
    for (const entry of replacements) {
      try { await move(entry.to, entry.backup); entry.old = true; } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      await move(entry.from, entry.to);
      entry.installed = true;
    }
  } catch (error) {
    // Restore both the working files and the built site if any replacement fails.
    try {
      for (const entry of [...replacements].reverse()) {
        if (entry.installed) { await move(entry.to, entry.from); entry.installed = false; }
        if (entry.old) { await move(entry.backup, entry.to); entry.old = false; }
      }
    } catch {
      throw new Error('工作目录提交及回滚失败；恢复材料保留在 .cache 的 .blog-candidate-* 目录，请先恢复旧内容再同步。');
    }
    throw error;
  }
}

async function cleanup(path: string, label: string) {
  try { await rm(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  catch { console.warn(`快照${label}清理失败，目录或锁已保留，请检查后清理。`); }
}

export async function publishSnapshot(options: SnapshotOptions) {
  const output = options.outputDir && resolve(options.outputDir);
  const cacheRoot = resolve(projectRoot, '.cache');
  if (output && !within(cacheRoot, output)) {
    throw new Error('隔离快照输出必须位于项目 .cache 的子目录中。');
  }
  const site = options.siteDir && resolve(options.siteDir);
  if (site && site !== resolve(projectRoot, 'dist') && !within(cacheRoot, site)) throw new Error('网站输出必须是项目 dist，或 .cache 下的隔离测试目录。');
  if (!site && !output) throw new Error('请指定网站输出目录。');
  const working = options.workingCopy && { contentDir: resolve(options.workingCopy.contentDir), assetsDir: resolve(options.workingCopy.assetsDir) };
  if (working) {
    for (const [path, expected] of [[working.contentDir, resolve(projectRoot, 'src/content/blog')], [working.assetsDir, resolve(projectRoot, 'public/article-assets')]]) {
      if (path !== expected && !within(cacheRoot, path)) throw new Error('工作目录必须是项目文章、图片目录，或 .cache 下的隔离测试目录。');
    }
  }
  const targets = [...(output ? [output] : []), ...(site ? [site] : []), ...(working ? [working.contentDir, working.assetsDir] : [])];
  if (targets.some((path, i) => targets.some((other, j) => i !== j && (path === other || within(path, other))))) throw new Error('快照、网站输出和工作目录不能互相包含。');
  const locks: string[] = [];
  let candidate: string | undefined;
  let preserveCandidate = false;
  try {
    for (const target of targets) {
      await mkdir(dirname(target), { recursive: true });
      const lock = target + '.lock';
      try { await mkdir(lock); } catch { throw new Error('同步输出已被另一个任务锁定。'); }
      locks.push(lock);
    }
    const candidateRoot = output ? dirname(output) : join(cacheRoot, 'notion');
    await mkdir(candidateRoot, { recursive: true });
    candidate = await mkdtemp(join(candidateRoot, '.blog-candidate-'));
    const content = join(candidate, 'content');
    const publicDir = join(candidate, 'public');
    await mkdir(content);
    const assetsLock = resolve(projectRoot, 'public/article-assets.lock');
    await cp(join(projectRoot, 'public'), publicDir, { recursive: true, filter: path => resolve(path) !== assetsLock });
    // The complete new selection determines the assets; withdrawn images must disappear.
    await rm(join(publicDir, 'article-assets'), { recursive: true, force: true });
    await mkdir(join(publicDir, 'article-assets'));
    if (working) await cp(join(projectRoot, 'src/content/blog/.gitkeep'), join(content, '.gitkeep'));
    await options.prepare({ contentDir: content, publicDir });
    const astroPackage = fileURLToPath(import.meta.resolve('astro/package.json'));
    const { bin } = JSON.parse(await readFile(astroPackage, 'utf8'));
    await run(process.execPath, [join(dirname(astroPackage), bin.astro), 'build'], {
      cwd: projectRoot, timeout: 120_000, maxBuffer: 8_000_000,
      env: { ...process.env, BLOG_CONTENT_DIR: content, BLOG_PUBLIC_DIR: publicDir, BLOG_OUT_DIR: join(candidate, 'site'), BLOG_CACHE_DIR: join(candidate, 'cache'), SITE_URL: options.siteUrl, SITE_BASE: options.siteBase },
    });
    await options.verify?.();
    const destinations = [
      ...(working ? [{ from: content, to: working.contentDir }, { from: join(publicDir, 'article-assets'), to: working.assetsDir }] : []),
      ...(site ? [{ from: join(candidate, 'site'), to: site }] : []),
      ...(output ? [{ from: candidate, to: output }] : []),
    ];
    const replacements = destinations.map((entry, i) => ({ ...entry, backup: candidate + `.previous-${i}`, old: false, installed: false }));
    try { await replace(replacements); } catch (error) {
      // If rollback itself failed, retain recovery material instead of deleting it.
      preserveCandidate = replacements.some(entry => entry.old || entry.installed);
      throw error;
    }
    // Publication is committed. Housekeeping must not turn that success into a failed sync.
    for (const entry of replacements) if (entry.old) await cleanup(entry.backup, '旧备份');
    return { outputDir: output, siteDir: site || join(output!, 'site') };
  } finally {
    if (candidate && !preserveCandidate) await cleanup(candidate, '候选目录');
    for (const lock of locks) await cleanup(lock, '互斥锁');
  }
}
