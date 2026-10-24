import type { Config } from '@react-router/dev/config';
import catalog from './app/generated/catalog.json';

// React Router compares prerender paths after decodeURI (not decodeURIComponent).
const prerenderPath = (value: string) => decodeURI(value);

export default {
  ssr: false,
  routeDiscovery: { mode: 'initial' },
  prerender: [
    '/',
    '/folders',
    '/search',
    '/404',
    ...catalog.posts.map((post) => prerenderPath(`/posts/${encodeURIComponent(post.slug)}`)),
    ...catalog.folders.map((folder) =>
      prerenderPath(`/folders/${folder.split('/').map(encodeURIComponent).join('/')}`),
    ),
    ...catalog.tags.map((tag) => prerenderPath(`/tags/${encodeURIComponent(tag)}`)),
  ],
} satisfies Config;
