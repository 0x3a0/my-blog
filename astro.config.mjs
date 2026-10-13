// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// 未提供最终域名时，仅用于本地预览；正式发布时设置 SITE_URL。
const site = process.env.SITE_URL;
const base = process.env.SITE_BASE || '/';
export default defineConfig({
  output: 'static',
  site,
  base,
  trailingSlash: 'always',
  ...(process.env.BLOG_PUBLIC_DIR ? { publicDir: process.env.BLOG_PUBLIC_DIR } : {}),
  ...(process.env.BLOG_OUT_DIR ? { outDir: process.env.BLOG_OUT_DIR } : {}),
  ...(process.env.BLOG_CACHE_DIR ? { cacheDir: process.env.BLOG_CACHE_DIR } : {}),
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
  vite: {
    plugins: [tailwindcss()],
    // Watching generated directories prevents their replacement on Windows.
    server: { watch: { ignored: ['**/.cache', '**/.cache/**', '**/.astro', '**/.astro/**', '**/src/content/blog', '**/src/content/blog/**', '**/public/article-assets', '**/public/article-assets/**'] } },
  },
});

