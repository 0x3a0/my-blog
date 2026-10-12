import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { pathToFileURL } from 'node:url';

const blog = defineCollection({
  loader: glob({
    base: process.env.BLOG_CONTENT_DIR ? pathToFileURL(process.env.BLOG_CONTENT_DIR + '/') : './src/content/blog', pattern: '**/*.md',
    generateId: ({ entry }) => {
      const id = entry.replace(/\\/g, '/').replace(/\.md$/, '');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(id)) {
        throw new Error('文章文件名必须使用小写 kebab-case：' + entry);
      }
      return id;
    },
  }),
  schema: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().default(''),
    category: z.string().trim().default(''),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).default([]).transform(tags => [...new Set(tags)]),
    draft: z.boolean().default(false),
    cover: z.string().regex(/^\/(?!\/)[^?#]+$/).optional(),
    coverAlt: z.string().trim().min(1).optional(),
  }).refine(data => !data.cover || !!data.coverAlt, { message: '封面必须提供 coverAlt', path: ['coverAlt'] }),
});
export const collections = { blog };

