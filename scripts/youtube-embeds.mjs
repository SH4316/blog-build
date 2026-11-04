import { visit } from 'unist-util-visit';

const videoId = /^[\w-]{11}$/;
const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const embedHosts = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com']);

function startSeconds(value) {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number.isSafeInteger(Number(value)) ? Number(value) : null;
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!parts) return null;
  const seconds = Number(parts[1] || 0) * 3600 + Number(parts[2] || 0) * 60 + Number(parts[3] || 0);
  return Number.isSafeInteger(seconds) ? seconds : null;
}

function embedUrl(source) {
  let url;
  try { url = new URL(source); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  let id;
  if (url.hostname === 'youtu.be') id = /^\/([\w-]+)\/?$/.exec(url.pathname)?.[1];
  else if (youtubeHosts.has(url.hostname)) {
    id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:embed|shorts|live)\/([\w-]+)\/?$/.exec(url.pathname)?.[1];
  } else if (embedHosts.has(url.hostname)) id = /^\/embed\/([\w-]+)\/?$/.exec(url.pathname)?.[1];
  if (!id || !videoId.test(id)) return null;
  const result = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  const start = startSeconds(url.searchParams.get('start') ?? url.searchParams.get('t') ?? new URLSearchParams(url.hash.slice(1)).get('t'));
  if (start !== null && start > 0) result.searchParams.set('start', String(start));
  return result.href;
}

// Run after sanitization: only validated image URLs can create an iframe.
// Raw HTML and arbitrary iframe sources remain subject to the default sanitizer.
export function youtubeEmbeds() {
  return tree => visit(tree, 'element', node => {
    if (node.tagName !== 'img' || typeof node.properties?.src !== 'string') return;
    const src = embedUrl(node.properties.src);
    if (!src) return;
    const title = node.properties.alt?.trim() || node.properties.title?.trim() || 'YouTube 동영상';
    node.tagName = 'iframe';
    node.properties = {
      src, title, width: 560, height: 315, loading: 'lazy',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
      allowFullScreen: true, referrerPolicy: 'strict-origin-when-cross-origin',
    };
    node.children = [];
  });
}
