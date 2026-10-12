import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import rehypeParse from 'rehype-parse';
import rehypeSanitize from 'rehype-sanitize';
import rehypeRemark from 'rehype-remark';
import type { Root, RootContent, Definition } from 'mdast';

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);
const html = unified().use(rehypeParse, { fragment: true }).use(rehypeSanitize).use(rehypeRemark).use(remarkGfm).use(remarkStringify);

function visit(node: Root | RootContent, action: (node: Root | RootContent) => void) {
  action(node);
  if ('children' in node) for (const child of node.children) visit(child, action);
}

function imageExtension(bytes: Uint8Array, contentType: string) {
  const buffer = Buffer.from(bytes);
  const mime = contentType.split(';')[0].trim().toLowerCase();
  if (mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (mime === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpg';
  if (mime === 'image/gif' && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) return 'gif';
  if (mime === 'image/webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (mime === 'image/avif' && buffer.subarray(4, 8).toString() === 'ftyp' && /^(avif|avis)$/.test(buffer.subarray(8, 12).toString())) return 'avif';
  throw new Error('必需图片格式不支持或内容校验失败。');
}

export async function prepareContent(input: { body: string; format: 'markdown' | 'html'; id: string; source: { image(url: string): Promise<{ bytes: Uint8Array; contentType: string }> }; publicDir: string; siteBase: string; imageCache: Map<string, string> }) {
  let body = input.body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (input.format === 'html') {
    if (/<(?:iframe|embed|object|script|video|audio)\b/i.test(body)) throw new Error(`文章 ${input.id} 包含无法可靠转换的嵌入内容。`);
    body = String(await html.process(body));
  }
  const tree = markdown.parse(body);
  const definitions = new Map<string, Definition>();
  visit(tree, node => { if (node.type === 'definition') definitions.set(node.identifier.toLowerCase(), node); });
  const imageUrls = new Set<string>();
  visit(tree, node => {
    if (node.type === 'html') throw new Error(`文章 ${input.id} 的 Markdown 包含尚未适配的 HTML 内容。`);
    if (node.type === 'image') imageUrls.add(node.url);
    if (node.type === 'imageReference') {
      const definition = definitions.get(node.identifier.toLowerCase());
      if (!definition) throw new Error(`文章 ${input.id} 的图片引用缺少地址。`);
      imageUrls.add(definition.url);
    }
  });
  const replacements = new Map<string, string>();
  for (const url of imageUrls) {
    let local = input.imageCache.get(url);
    if (!local) {
      let resource;
      try { resource = await input.source.image(url); } catch { throw new Error(`文章 ${input.id} 的必需图片读取失败。`); }
      const extension = imageExtension(resource.bytes, resource.contentType);
      const name = createHash('sha256').update(resource.bytes).digest('hex') + '.' + extension;
      await mkdir(join(input.publicDir, 'article-assets'), { recursive: true });
      await writeFile(join(input.publicDir, 'article-assets', name), resource.bytes);
      local = input.siteBase.replace(/\/?$/, '/') + 'article-assets/' + name;
      input.imageCache.set(url, local);
    }
    replacements.set(url, local);
  }
  visit(tree, node => {
    if (node.type === 'image') node.url = replacements.get(node.url) || node.url;
    if (node.type === 'definition' && replacements.has(node.url)) node.url = replacements.get(node.url)!;
    if (node.type === 'link' && /^(?:javascript|data|vbscript):/i.test(node.url)) throw new Error(`文章 ${input.id} 存在无法发布的链接。`);
  });
  return { body: markdown.stringify(tree) };
}
