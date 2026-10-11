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
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
  vite: { plugins: [tailwindcss()] },
});

