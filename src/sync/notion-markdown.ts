import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import type { Root, RootContent } from 'mdast';

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);
const table = unified().use(rehypeParse, { fragment: true }).use(rehypeRemark).use(remarkGfm).use(remarkStringify);

function inline(text: string) {
  const literal: string[] = [];
  let marker = 'NOTIONCODE';
  while (text.includes(marker)) marker += '_';
  text = text.replace(/(`+)([\s\S]*?)\1/g, value => { literal.push(value); return `${marker}${literal.length - 1}TOKEN`; });
  if (/(?<!\\)\$/.test(text)) throw new Error('正文包含首版范围外的公式。');
  text = text.replace(/\s*\{(?:color|toggle)="[^"]*"(?:\s+(?:color|toggle)="[^"]*")*\}/g, '');
  text = text.replace(/<(page|mention-(?:page|database|data-source|user|agent)|database)\b([^>]*)>([\s\S]*?)<\/\1>/g, (_whole, _tag: string, attributes: string, label: string) => {
    const url = attributes.match(/\burl="([^"]*)"/)?.[1];
    if (!url) throw new Error('页面引用缺少 URL。');
    return `[${label.replaceAll('[', '\\[').replaceAll(']', '\\]')}](${url})`;
  });
  text = text.replace(/<mention-[\w-]+\b[^>]*\/>/g, tag => {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
    if (tag.startsWith('<mention-date')) {
      if (!attributes.start) throw new Error('日期提及缺少开始日期。');
      const start = attributes.start + (attributes.startTime ? ' ' + attributes.startTime : '');
      const end = attributes.end ? ' – ' + attributes.end + (attributes.endTime ? ' ' + attributes.endTime : '') : '';
      return start + end + (attributes.timeZone ? ` (${attributes.timeZone})` : '');
    }
    const url = tag.match(/\burl="([^"]*)"/)?.[1];
    if (url) return `[${url}](${url})`;
    throw new Error('提及内容不完整。');
  });
  text = text.replace(/<span\b[^>]*>([\s\S]*?)<\/span>/g, '$1').replace(/<br\s*\/?\s*>/gi, '  \n');
  const unsupported = text.match(/(?<!\\)<\/?([a-z][\w-]*)\b/i);
  if (unsupported) throw new Error(`正文包含尚未支持的 ${unsupported[1]} 内容。`);
  return text.replace(new RegExp(marker + '(\\d+)TOKEN', 'g'), (_all, index: string) => literal[Number(index)]);
}

async function normalMarkdown(body: string) {
  const lines = body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  const wrappers: { tag: string; indent: number }[] = [];
  let fence: { character: string; length: number } | undefined;
  const emit = (text: string) => {
    output.push(...text.split('\n').map(line => {
      const indent = line.match(/^\t*/)?.[0].length || 0;
      let prefix = '';
      let previousIndent = 0;
      for (const wrapper of wrappers.filter(wrapper => wrapper.tag === 'callout')) {
        prefix += '\t'.repeat(Math.max(0, wrapper.indent - previousIndent)) + '> ';
        previousIndent = wrapper.indent;
      }
      return prefix + '\t'.repeat(Math.max(0, indent - previousIndent)) + line.slice(indent);
    }));
  };
  for (let index = 0; index < lines.length; index++) {
    // Notion uses one tab per parent; retain remaining list/code indentation.
    let raw = lines[index];
    for (const wrapper of wrappers) raw = raw.replace(new RegExp(`^(\\t{${wrapper.indent}})\\t`), '$1');
    const trimmed = raw.trim();
    const delimiter = raw.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      emit(raw);
      if (delimiter && delimiter[1][0] === fence.character && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = undefined;
      continue;
    }
    if (delimiter) { fence = { character: delimiter[1][0], length: delimiter[1].length }; emit(raw); continue; }
    const open = trimmed.match(/^<(callout|columns|column|details|synced_block|synced_block_reference)\b[^>]*>$/);
    if (open) { wrappers.push({ tag: open[1], indent: raw.match(/^\t*/)?.[0].length || 0 }); emit(''); continue; }
    const close = trimmed.match(/^<\/(callout|columns|column|details|synced_block|synced_block_reference)>$/);
    if (close) {
      if (wrappers.pop()?.tag !== close[1]) throw new Error('正文分栏或提示框标签不完整。');
      emit(''); continue;
    }
    if (/^<(?:empty-block|table_of_contents)\b[^>]*\/>$/.test(trimmed)) { emit(''); continue; }
    if (/^<summary>.*<\/summary>$/.test(trimmed)) { emit('**' + inline(trimmed.slice(9, -10)) + '**\n'); continue; }
    if (/^<table\b/.test(trimmed)) {
      const parts = [raw];
      while (!parts[parts.length - 1].includes('</table>') && index + 1 < lines.length) parts.push(lines[++index]);
      let html = parts.join('\n');
      if (!html.includes('</table>')) throw new Error('正文表格不完整。');
      const tags = [...html.matchAll(/<\/?([\w-]+)\b/g)].map(m => m[1]);
      if (tags.some(tag => !['table', 'colgroup', 'col', 'tr', 'td', 'th', 'span', 'br'].includes(tag))) throw new Error('正文表格包含尚未支持的内容。');
      const cells: string[] = [];
      let marker = 'NOTIONTABLECELL' + index + 'TOKEN';
      while (html.includes(marker)) marker += '_';
      html = html.replace(/(<t[dh]\b[^>]*>)([\s\S]*?)(<\/t[dh]>)/g, (_all, start: string, content: string, end: string) => {
        cells.push(inline(content).replaceAll('|', '\\|').replace(/\n/g, ' '));
        return start + marker + (cells.length - 1) + 'END' + end;
      });
      if (/header-row="true"/.test(html)) html = html.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/, row => row.replace(/<td\b[^>]*>/g, '<th>').replaceAll('</td>', '</th>'));
      emit(String(await table.process(html)).replace(new RegExp(marker + '(\\d+)END', 'g'), (_all, cell: string) => cells[Number(cell)])); continue;
    }
    emit(inline(raw));
  }
  if (wrappers.length || fence) throw new Error('正文标签或代码块未闭合。');
  return output.join('\n');
}

function rewriteLinks(node: Root | RootContent, published: Map<string, string>) {
  if (node.type === 'link' || node.type === 'definition') {
    try {
      const url = new URL(node.url);
      if (/^(?:www\.)?notion\.(?:so|site)$/.test(url.hostname) && !url.hash) {
        const id = url.pathname.match(/([0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/?$/i)?.[1]?.replaceAll('-', '').toLowerCase();
        const route = id && published.get(id);
        if (route) node.url = route;
      }
    } catch { /* Relative and non-web references keep their original meaning. */ }
  }
  if ('children' in node) for (const child of node.children) rewriteLinks(child, published);
}
function captions(node: Root | RootContent) {
  if (!('children' in node)) return;
  for (let i = node.children.length - 1; i >= 0; i--) {
    const child = node.children[i];
    captions(child);
    if (child.type === 'paragraph' && child.children.length === 1 && (child.children[0].type === 'image' || child.children[0].type === 'imageReference') && child.children[0].alt) {
      const caption = child.children[0].alt;
      if (node.type === 'root' || node.type === 'blockquote' || node.type === 'listItem') {
        node.children.splice(i + 1, 0, { type: 'paragraph', children: [{ type: 'text', value: caption }] });
      }
    }
  }
}
export async function convertNotionMarkdown(body: string, published: Map<string, string>) {
  const tree = markdown.parse(await normalMarkdown(body));
  rewriteLinks(tree, published);
  captions(tree);
  return markdown.stringify(tree);
}
