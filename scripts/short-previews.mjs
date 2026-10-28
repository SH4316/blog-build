import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import sharp from 'sharp';

const denied4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) denied4.addSubnet(address, prefix, 'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::', 3, 'ipv6');
const denied6 = new BlockList();
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) denied6.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !denied4.check(address, 'ipv4')
    : family === 6 && global6.check(address, 'ipv6') && !denied6.check(address, 'ipv6');
}

function publicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || (url.port && !['80', '443'].includes(url.port))) throw new Error('Preview URL is not public HTTP(S)');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!hostname || /(?:^|\.)(?:localhost|local|internal|home|lan|invalid|test|example)$/.test(hostname)
    || !isIP(hostname) && !hostname.includes('.')) throw new Error('Preview hostname is not public');
  url.hash = '';
  return { url, hostname };
}

function withSignal(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

// Pin the validated DNS answer into the socket lookup so a second resolution
// cannot redirect the actual connection to a private address (DNS rebinding).
async function requestPinned(url, { address, family, signal, maxBytes, kind }) {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'GET', agent: false, signal, family, autoSelectFamily: false,
      lookup: (_hostname, options, callback) => options.all
        ? callback(null, [{ address, family }]) : callback(null, address, family),
      headers: {
        accept: kind === 'html' ? 'text/html, application/xhtml+xml' : 'image/avif, image/webp, image/png, image/jpeg, image/gif',
        'accept-encoding': 'identity',
        'user-agent': 'SoohyukBlog/1.0 (+https://blog.soohyuk.dev)',
      },
    }, response => {
      const status = response.statusCode || 0;
      const headers = response.headers;
      if (status < 200 || status >= 300) {
        response.destroy();
        resolve({ status, headers, body: Buffer.alloc(0) });
        return;
      }
      if (Number(headers['content-length']) > maxBytes) {
        response.destroy();
        reject(new Error('Preview response is too large'));
        return;
      }
      let length = 0;
      const chunks = [];
      response.on('data', chunk => {
        length += chunk.length;
        if (length > maxBytes) response.destroy(new Error('Preview response is too large'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status, headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.end();
  });
}

async function publicResource(value, { resolveHost, request, signal, kind, maxBytes }) {
  let destination = value;
  for (let redirects = 0; redirects <= 4; redirects++) {
    const { url, hostname } = publicUrl(destination);
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }]
      : await withSignal(Promise.resolve().then(() => resolveHost(hostname)), signal);
    if (!Array.isArray(addresses) || !addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('Preview DNS resolved to a nonpublic address');
    const chosen = addresses.find(({ address }) => isIP(address) === 4) || addresses[0];
    const response = await withSignal(Promise.resolve().then(() => request(url, {
      address: chosen.address, family: isIP(chosen.address), signal, maxBytes, kind,
    })), signal);
    const headers = Object.fromEntries(Object.entries(response.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (!headers.location || redirects === 4) throw new Error('Invalid or excessive preview redirects');
      destination = new URL(headers.location, url).href;
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error('Preview request failed');
    if (headers['content-encoding'] && headers['content-encoding'].toLowerCase() !== 'identity') throw new Error('Compressed preview responses are not supported');
    const body = Buffer.from(response.body);
    if (body.length > maxBytes || Number(headers['content-length']) > maxBytes) throw new Error('Preview response is too large');
    const contentType = (headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (kind === 'html' && !['text/html', 'application/xhtml+xml'].includes(contentType)) throw new Error('Preview response is not HTML');
    const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(headers['content-type'] || '')?.[1] || 'utf-8';
    return { url: url.href, body, contentType, charset };
  }
  throw new Error('Excessive preview redirects');
}

const plain = (value, length) => typeof value === 'string'
  ? [...value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/gu, ' ').trim()].slice(0, length).join('') || null : null;

export function parsePreviewMetadata(html, pageUrl) {
  const document = parse(html);
  const head = document.childNodes.find(node => node.tagName === 'html')?.childNodes.find(node => node.tagName === 'head');
  const metadata = new Map();
  let title = null;
  let baseUrl = pageUrl;
  let baseSeen = false;
  for (const node of head?.childNodes || []) {
    const attributes = Object.fromEntries((node.attrs || []).map(attribute => [attribute.name.toLowerCase(), attribute.value]));
    if (node.tagName === 'meta') {
      const key = (attributes.property || attributes.name || '').toLowerCase();
      if (key && !metadata.has(key)) metadata.set(key, attributes.content);
    }
    if (node.tagName === 'title' && title === null) title = node.childNodes.map(child => child.value || '').join('');
    if (node.tagName === 'base' && attributes.href && !baseSeen) {
      baseSeen = true;
      try { baseUrl = new URL(attributes.href, pageUrl).href; } catch { /* Ignore invalid bases. */ }
    }
  }
  const first = (keys, length) => keys.map(key => plain(metadata.get(key), length)).find(Boolean) || null;
  let image = null;
  for (const key of ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) {
    if (!metadata.get(key)) continue;
    try { image = publicUrl(new URL(metadata.get(key), baseUrl).href).url.href; break; }
    catch { /* Try the next declared image; DNS is checked before downloading. */ }
  }
  return {
    title: first(['og:title', 'twitter:title'], 200) || plain(title, 200),
    description: first(['og:description', 'twitter:description', 'description'], 500),
    image,
  };
}

function rasterSignature(body, contentType) {
  if (contentType === 'image/png') return body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === 'image/jpeg') return body[0] === 255 && body[1] === 216 && body[2] === 255;
  if (contentType === 'image/webp') return body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
  if (contentType === 'image/gif') return /^GIF8[79]a$/.test(body.toString('ascii', 0, 6));
  if (contentType === 'image/avif') return body.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(body.toString('ascii', 8, 40));
  return false;
}

async function previewImage(resource) {
  if (!rasterSignature(resource.body, resource.contentType)) throw new Error('Preview image format is unsupported');
  const decoder = sharp(resource.body, { limitInputPixels: 20_000_000, failOn: 'warning' });
  const metadata = await decoder.metadata();
  if (!['jpeg', 'png', 'webp', 'gif', 'heif'].includes(metadata.format) || !metadata.width || !metadata.height
    || metadata.width > 12_000 || metadata.height > 12_000 || metadata.width * metadata.height > 20_000_000) throw new Error('Preview image dimensions are unsupported');
  const bytes = await decoder.resize({ width: 1200, height: 800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80, effort: 3 }).toBuffer();
  if (bytes.length > 4 * 1024 * 1024) throw new Error('Preview image is too large');
  const filename = `${createHash('sha256').update(bytes).digest('hex')}.webp`;
  return { filename, bytes };
}

export function createShortPreviewResolver({
  resolveHost = hostname => lookup(hostname, { all: true, verbatim: true }),
  request = requestPinned,
  timeoutMs = 6000,
} = {}) {
  const documents = new Map();
  const images = new Map();
  const assets = new Map();
  let active = 0;
  const waiting = [];
  async function limited(task) {
    if (active >= 4) await new Promise(resolve => waiting.push(resolve));
    active++;
    try { return await task(); }
    finally { active--; waiting.shift()?.(); }
  }
  async function resolvePreview(link) {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const resource = await publicResource(link, { resolveHost, request, signal, kind: 'html', maxBytes: 2 * 1024 * 1024 });
      let html;
      try { html = new TextDecoder(resource.charset).decode(resource.body); }
      catch { html = resource.body.toString('utf8'); }
      const metadata = parsePreviewMetadata(html, resource.url);
      let image = null;
      if (metadata.image) {
        if (!images.has(metadata.image)) images.set(metadata.image, (async () => {
          try {
            const downloaded = await publicResource(metadata.image, { resolveHost, request, signal, kind: 'image', maxBytes: 4 * 1024 * 1024 });
            const image = await withSignal(previewImage(downloaded), signal);
            assets.set(image.filename, image.bytes);
            return `/short-previews/${image.filename}`;
          } catch { return null; }
        })());
        try { image = await withSignal(images.get(metadata.image), signal); }
        catch { /* A shared image download must not outlive this entry's deadline. */ }
      }
      return metadata.title || metadata.description || image ? { title: metadata.title, description: metadata.description, image } : null;
    } catch { return null; }
  }
  return {
    assets,
    resolve(link) {
      let key;
      try { key = publicUrl(link).url.href; } catch { return Promise.resolve(null); }
      if (!documents.has(key)) documents.set(key, limited(() => resolvePreview(key)));
      return documents.get(key);
    },
  };
}
