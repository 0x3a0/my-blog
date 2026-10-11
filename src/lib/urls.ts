const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const withBase = (path = '') => base + path.replace(/^\/+/, '');
export const postUrl = (id: string) => withBase('blog/' + id.split('/').map(encodeURIComponent).join('/') + '/');
export const tagUrl = (tag: string) => withBase('tags/' + encodeURIComponent(tag) + '/');

