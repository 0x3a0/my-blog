import { cp, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
export interface SnapshotOptions {
  outputDir: string;
  siteBase: string;
  siteUrl: string;
  prepare: (directories: { contentDir: string; publicDir: string }) => Promise<void>;
  verify?: () => Promise<void>;
}
const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

async function cleanup(path: string, label: string) {
  try { await rm(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  catch { console.warn(`快照${label}清理失败，临时文件保留于 .artifacts，请检查后清理。`); }
}

export async function publishSnapshot(options: SnapshotOptions) {
  const output = resolve(options.outputDir);
  const target = relative(resolve(projectRoot, '.artifacts'), output);
  if (!target || target === '..' || target.startsWith('../') || target.startsWith('..\\') || isAbsolute(target)) {
    throw new Error('候选快照输出必须位于项目 .artifacts 的子目录中。');
  }
  await mkdir(dirname(output), { recursive: true });
  const lock = output + '.lock';
  try { await mkdir(lock); } catch { throw new Error('同步输出已被另一个任务锁定。'); }
  let candidate: string | undefined;
  try {
    candidate = await mkdtemp(join(dirname(output), '.blog-candidate-'));
    const backup = candidate + '.previous';
    const content = join(candidate, 'content');
    await mkdir(content);
    await cp(join(projectRoot, 'public'), join(candidate, 'public'), { recursive: true });
    await options.prepare({ contentDir: content, publicDir: join(candidate, 'public') });
    const astroPackage = fileURLToPath(import.meta.resolve('astro/package.json'));
    const { bin } = JSON.parse(await readFile(astroPackage, 'utf8'));
    await run(process.execPath, [join(dirname(astroPackage), bin.astro), 'build'], {
      cwd: projectRoot, timeout: 120_000, maxBuffer: 8_000_000,
      env: { ...process.env, BLOG_CONTENT_DIR: content, BLOG_PUBLIC_DIR: join(candidate, 'public'), BLOG_OUT_DIR: join(candidate, 'site'), BLOG_CACHE_DIR: join(candidate, 'cache'), SITE_URL: options.siteUrl, SITE_BASE: options.siteBase },
    });
    await options.verify?.();
    let movedOld = false;
    try { await rename(output, backup); movedOld = true; } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    try { await rename(candidate, output); } catch (error) {
      if (movedOld) await rename(backup, output);
      throw error;
    }
    // Publication is committed. Housekeeping must not turn that success into a failed sync.
    if (movedOld) await cleanup(backup, '旧备份');
    return { outputDir: output };
  } finally {
    if (candidate) await cleanup(candidate, '候选目录');
    await cleanup(lock, '互斥锁');
  }
}
