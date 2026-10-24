import type { SearchEntry } from './types';

export function searchPosts(entries: SearchEntry[], query: string): SearchEntry[] {
  const tokens = query.normalize('NFC').trim().toLocaleLowerCase('ko').split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase('ko');
  return entries
    .map((entry) => {
      const title = normalize(entry.title),
        tags = normalize(entry.tags.join(' ')),
        description = normalize(entry.description),
        text = normalize(entry.text);
      const haystack = `${title} ${tags} ${description} ${text}`;
      if (!tokens.every((token) => haystack.includes(token))) return { entry, score: 0 };
      return {
        entry,
        score: tokens.reduce(
          (score, token) =>
            score +
            (title.includes(token) ? 20 : 0) +
            (tags.includes(token) ? 10 : 0) +
            (description.includes(token) ? 5 : 0) +
            1,
          0,
        ),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date))
    .map((result) => result.entry);
}

export function searchExcerpt(
  text: string,
  query: string,
  length = 120,
): { text: string; matched: boolean }[] | null {
  const body = text.normalize('NFC').replace(/\s+/g, ' ').trim();
  const tokens = [...new Set(query.normalize('NFC').trim().split(/\s+/).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (!tokens.length) return null;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escaped.join('|'), 'giu');
  const first = pattern.exec(body);
  if (!first) return null;
  const start = Math.max(0, Math.min(first.index - Math.floor(length / 3), body.length - length));
  const end = Math.min(body.length, Math.max(start + length, first.index + first[0].length));
  const excerpt = body.slice(start, end);
  const parts: { text: string; matched: boolean }[] = [];
  if (start > 0) parts.push({ text: '…', matched: false });
  let cursor = 0;
  pattern.lastIndex = 0;
  for (const match of excerpt.matchAll(pattern)) {
    if (match.index > cursor)
      parts.push({ text: excerpt.slice(cursor, match.index), matched: false });
    parts.push({ text: match[0], matched: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < excerpt.length) parts.push({ text: excerpt.slice(cursor), matched: false });
  if (end < body.length) parts.push({ text: '…', matched: false });
  return parts;
}
