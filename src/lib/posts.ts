import { getCollection } from 'astro:content';
export async function publishedPosts() {
  return (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime() || a.id.localeCompare(b.id));
}
export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}
export const postYear = (date: Date) => date.getUTCFullYear();
export function tagName(tag: string) {
  const labels: Record<string, string> = { ai: 'AI', astro: 'Astro', typescript: 'TypeScript', java: 'Java', agent: 'Agent', langgraph: 'LangGraph' };
  return labels[tag] ?? tag;
}

