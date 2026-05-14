import fs from 'node:fs';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const ROLE_TAGS = new Set([
  'concept', 'vocab', 'blank', 'key-callout', 'case-study', 'diagram',
  'self-quiz', 'summary', 'discussion', 'activity', 'question',
  'objective', 'slide',
]);

const TAG_RE = /(?:^|\s)#([A-Za-z][A-Za-z0-9_/-]*)/g;
const FIELD_OPEN_RE = /\[([a-z][a-z0-9_-]*)::\s*/g;
const ROMAN_HEADING_RE = /^(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))\.\s+/;

// Balanced-bracket field extractor. Handles `[name:: value]` where `value`
// itself may contain `[` and `]` (e.g. code snippets like `inp[strcspn(...)]`).
// We walk the string, find each `[name::` opener, then scan forward tracking
// bracket depth and close at the matching depth-0 `]`. Returns the list of
// (start, end-inclusive, name, value) ranges in order so they can be removed
// from the text without rescanning.
function extractFieldRanges(rawText) {
  const ranges = [];
  FIELD_OPEN_RE.lastIndex = 0;
  let openMatch;
  while ((openMatch = FIELD_OPEN_RE.exec(rawText)) !== null) {
    const start = openMatch.index;
    const innerStart = openMatch.index + openMatch[0].length;
    let depth = 1;
    let j = innerStart;
    while (j < rawText.length && depth > 0) {
      const ch = rawText[j];
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (j >= rawText.length) {
      // unterminated field — bail this one, advance regex past the opener
      continue;
    }
    const value = rawText.slice(innerStart, j).trim();
    ranges.push({ start, end: j, name: openMatch[1], value });
    // Advance the regex past this field so we don't re-match an inner [name::
    FIELD_OPEN_RE.lastIndex = j + 1;
  }
  return ranges;
}

function extractTagsAndFields(rawText) {
  const tags = new Set();
  const fields = new Map();
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(rawText)) !== null) {
    tags.add(m[1]);
  }
  const fieldRanges = extractFieldRanges(rawText);
  for (const r of fieldRanges) fields.set(r.name, r.value);
  // Build text with fields removed (right-to-left so indices stay valid).
  let text = rawText;
  for (let i = fieldRanges.length - 1; i >= 0; i--) {
    const r = fieldRanges[i];
    text = text.slice(0, r.start) + text.slice(r.end + 1);
  }
  text = text.replace(TAG_RE, (full) => {
    return full.startsWith('#') ? '' : full[0];
  });
  text = text.replace(/\s+/g, ' ').trim();
  return { tags, fields, text };
}

function resolveSection(tags, headingStack) {
  for (const t of tags) {
    if (t.startsWith('section/')) return t.slice('section/'.length);
  }
  // headingStack[0] = current H2
  const h2 = headingStack[0];
  if (h2) {
    const m = ROMAN_HEADING_RE.exec(h2);
    if (m) return m[1];
  }
  return null;
}

export function parse({ path, source } = {}) {
  const raw = source ?? fs.readFileSync(path, 'utf8');
  const { data, content } = matter(raw);
  // Resolve symlinks on the source path so mark-used edits the underlying file.
  let sourcePath = null;
  if (path) {
    try { sourcePath = fs.realpathSync(path); } catch { sourcePath = path; }
  }
  const frontmatter = {
    title: data.title,
    course: data.course,
    topicSlug: data['topic-slug'],
    term: data.term,
    adversarialThinking: data['adversarial-thinking'] === true,
    type: data.type,
    raw: { ...data, __path: sourcePath },
    sourcePath,
  };

  const md = new MarkdownIt({ html: false });
  const tokens = md.parse(content, {});

  const bodyLineOffset = raw.slice(0, raw.indexOf(content)).split('\n').length - 1;

  const items = [];
  const byTag = new Map();
  const bySection = new Map();
  const byRole = new Map();

  // heading stack: index = headingLevel - 2 (H2 → 0)
  const headingStack = [];
  let pendingHeadingLevel = null;

  // list-item stack (depth-aware)
  const itemStack = []; // { item, level }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === 'heading_open') {
      pendingHeadingLevel = parseInt(tok.tag.slice(1), 10);
    } else if (tok.type === 'inline' && pendingHeadingLevel != null) {
      const idx = pendingHeadingLevel - 2;
      if (idx >= 0) {
        headingStack[idx] = tok.content;
        // clear deeper entries
        headingStack.length = idx + 1;
      }
      pendingHeadingLevel = null;
    } else if (tok.type === 'list_item_open') {
      // create item, will be filled when we see its inline content
      const item = {
        text: '',
        rawText: '',
        tags: new Set(),
        fields: new Map(),
        section: null,
        sourceLine: (tok.map ? tok.map[0] : 0) + 1 + bodyLineOffset,
        children: [],
        _level: tok.level,
      };
      itemStack.push(item);
    } else if (tok.type === 'list_item_close') {
      const finished = itemStack.pop();
      delete finished._level;
      // attach to parent or top-level
      const parent = itemStack[itemStack.length - 1];
      if (parent) {
        parent.children.push(finished);
      } else {
        items.push(finished);
      }
      // index it
      for (const t of finished.tags) {
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(finished);
        if (ROLE_TAGS.has(t)) {
          if (!byRole.has(t)) byRole.set(t, []);
          byRole.get(t).push(finished);
        }
      }
      if (finished.section) {
        if (!bySection.has(finished.section)) bySection.set(finished.section, []);
        bySection.get(finished.section).push(finished);
      }
    } else if (tok.type === 'inline' && itemStack.length > 0) {
      // inline content belongs to the most recent open list_item — but only the
      // first inline (paragraph_open then inline) right after list_item_open.
      const current = itemStack[itemStack.length - 1];
      // Append; multiple paragraphs/lines within an item concatenate.
      const piece = tok.content;
      if (current.rawText) {
        current.rawText += '\n' + piece;
      } else {
        current.rawText = piece;
      }
      const { tags, fields, text } = extractTagsAndFields(current.rawText);
      current.tags = tags;
      current.fields = fields;
      current.text = text;
      current.section = resolveSection(tags, headingStack);
    } else if (tok.type === 'fence' && itemStack.length > 0) {
      // Fenced code block (```lang ... ```) inside a list item. Markdown-it
      // emits these as their own block tokens, NOT as part of the inline
      // text — so without this branch, fenced code attached to a question
      // is silently dropped. Stash on the item under a `code` field; the
      // first fence wins (later fences would be unusual; if encountered,
      // append).
      const current = itemStack[itemStack.length - 1];
      const lang = tok.info ? tok.info.trim() : '';
      const existing = current.fields.get('code');
      const block = lang
        ? `\`\`\`${lang}\n${tok.content}\`\`\``
        : `\`\`\`\n${tok.content}\`\`\``;
      current.fields.set('code', existing ? `${existing}\n${block}` : block);
      // Don't try to merge into text — keep the visible stem clean. The
      // exam/quiz renderers consult fields.get('code') explicitly.
    }
  }

  function byTerm(term) {
    return byTag.get(`used/${term}`) ?? [];
  }

  return { frontmatter, body: content, items, byTag, bySection, byRole, byTerm };
}
