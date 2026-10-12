import { z } from 'astro/zod';

export const notionIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).transform(value => value.toLowerCase());
export const publicationSchema = z.object({
  version: z.literal(1),
  source: z.string().regex(/^[0-9a-f]{64}$/),
  articles: z.array(notionIdSchema),
});
export type Publication = z.infer<typeof publicationSchema>;
