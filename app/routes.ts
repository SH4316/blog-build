import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('posts/:slug', 'routes/post.tsx'),
  route('folders/*', 'routes/folder.tsx'),
  route('tags/:tag', 'routes/tag.tsx'),
  route('search', 'routes/search.tsx'),
  route('shorts', 'routes/shorts.tsx'),
  route('404', 'routes/not-found.tsx'),
  route('*', 'routes/missing.tsx'),
] satisfies RouteConfig;
