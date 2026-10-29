import { unified } from 'unified';
import remarkParse from 'remark-parse';

function textOf(node) {
  return typeof node.value === 'string' ? node.value : (node.children || []).map(textOf).join('');
}

export function textSourceOffsets(original) {
  const offsets = [];
  for (let index = 0; index < original.length;) {
    let raw = original[index];
    let decoded = raw;
    if (raw === '\\' && /[\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]/.test(original[index + 1] || '')) {
      raw = original.slice(index, index + 2);
      decoded = raw[1];
    } else if (raw === '&') {
      const entity = /^&(?:#(?:[xX][\da-fA-F]+|\d+)|[A-Za-z][A-Za-z\d]+);/.exec(original.slice(index));
      if (entity) {
        raw = entity[0];
        decoded = textOf(unified().use(remarkParse).parse(raw));
      }
    }
    offsets.push(...Array(decoded.length).fill(index));
    index += raw.length;
  }
  offsets.push(original.length);
  return offsets;
}

// The caller decides which wiki forms are supported and resolves their destinations.
// Returning null keeps an unsupported form literal in the original text node.
export function markdownWiki(source, resolve) {
  return () => tree => {
    function transform(parent) {
      if (!parent.children || ['link', 'linkReference'].includes(parent.type)) return;
      parent.children = parent.children.flatMap(node => {
        if (node.type !== 'text') { transform(node); return [node]; }
        const original = source.slice(node.position.start.offset, node.position.end.offset);
        const offsets = textSourceOffsets(original);
        const parts = [];
        let cursor = 0;
        for (const match of node.value.matchAll(/(!?)\[\[([^\[\]\n]+)\]\]/g)) {
          // Markdown has decoded escapes/entities; verify the raw source before transforming.
          if (original.slice(offsets[match.index], offsets[match.index + match[0].length]) !== match[0]) continue;
          const [destination, ...aliases] = match[2].split('|');
          const replacement = resolve({ destination, alias: aliases.join('|'), hasAlias: aliases.length > 0, embed: match[1] === '!' });
          if (!replacement) continue;
          parts.push({ type: 'text', value: node.value.slice(cursor, match.index) }, replacement);
          cursor = match.index + match[0].length;
        }
        if (!cursor) return [node];
        parts.push({ type: 'text', value: node.value.slice(cursor) });
        return parts;
      });
    }
    transform(tree);
  };
}
