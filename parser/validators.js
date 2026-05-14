const LAYOUT_ENUM = new Set([
  'title', 'agenda', 'concept', 'split', 'code', 'diagram',
  'vocab', 'case-study', 'key', 'summary', 'section-divider',
]);
const QUESTION_TYPES = new Set(['mc', 'tf', 'code', 'fib', 'sa']);

function flatten(item, out) {
  out.push(item);
  for (const c of item.children) flatten(c, out);
}

function pushIssue(arr, item, message) {
  arr.push({ message, line: item.sourceLine, text: item.text });
}

function typeTagsOf(item) {
  const types = [];
  for (const t of item.tags) {
    if (t.startsWith('type/')) types.push(t.slice('type/'.length));
  }
  return types;
}

function sectionTagsOf(item) {
  const secs = [];
  for (const t of item.tags) {
    if (t.startsWith('section/')) secs.push(t.slice('section/'.length));
  }
  return secs;
}

function difficultyTagsOf(item) {
  for (const t of item.tags) {
    if (t.startsWith('difficulty/')) return true;
  }
  return false;
}

export function validate(parsed) {
  const errors = [];
  const warnings = [];
  const all = [];
  for (const it of parsed.items) flatten(it, all);

  // Set of slide positions defined by #slide items
  const slidePositions = new Set();
  for (const it of all) {
    if (it.tags.has('slide') && it.fields.has('slide')) {
      slidePositions.add(String(it.fields.get('slide')).trim());
    }
  }

  for (const it of all) {
    // ── #blank rules ─────────────────────────────────────────
    if (it.tags.has('blank')) {
      if (!it.fields.has('slide')) {
        pushIssue(errors, it, '#blank without [slide:: N] — every blank must cite the slide it maps to');
      } else {
        const slideRef = String(it.fields.get('slide')).trim();
        if (!slidePositions.has(slideRef)) {
          pushIssue(errors, it, `#blank cites [slide:: ${slideRef}] but no #slide [slide:: ${slideRef}] exists in this doc`);
        }
      }
    }

    // ── #question rules ──────────────────────────────────────
    if (it.tags.has('question')) {
      const types = typeTagsOf(it);
      const sections = sectionTagsOf(it);

      // exactly one #type/*
      if (types.length === 0) {
        pushIssue(errors, it, '#question without any #type/* tag — must declare exactly one type');
      } else if (types.length > 1) {
        pushIssue(errors, it, `#question with multiple #type/* tags (${types.join(', ')}) — must declare exactly one type`);
      } else {
        const t = types[0];
        if (!QUESTION_TYPES.has(t)) {
          pushIssue(errors, it, `#question has unknown #type/${t} — must be one of ${[...QUESTION_TYPES].join(', ')}`);
        }
        // mc-specific
        if (t === 'mc') {
          if (!it.fields.has('answer')) {
            pushIssue(errors, it, '#question #type/mc without [answer::] — multiple-choice must declare the correct option');
          }
          if (!it.fields.has('options') && it.children.length < 2) {
            pushIssue(errors, it, '#question #type/mc without [options::] and fewer than 2 child bullets — provide options inline or as child bullets');
          }
        }
        // fib + #exam-eligible warning + strip
        if (t === 'fib' && it.tags.has('exam-eligible')) {
          warnings.push({
            message: '#question #type/fib carrying #exam-eligible is forbidden (fib never appears in exams) — stripping #exam-eligible',
            line: it.sourceLine,
            text: it.text,
          });
          it.tags.delete('exam-eligible');
        }
      }

      // multiple #section/*
      if (sections.length > 1) {
        pushIssue(errors, it, `#question with multiple #section/* tags (${sections.join(', ')}) — exactly one allowed`);
      }

      // resolved section presence
      if (it.section == null) {
        pushIssue(errors, it, '#question without any resolvable section — needs #section/* tag or to live under a Roman-numeral H2');
      }

      // soft: missing difficulty
      if (!difficultyTagsOf(it)) {
        warnings.push({
          message: '#question without any #difficulty/* tag',
          line: it.sourceLine,
          text: it.text,
        });
      }
    }

    // ── #diagram rules ───────────────────────────────────────
    if (it.tags.has('diagram') && !it.tags.has('slide')) {
      if (!it.fields.has('alt')) {
        pushIssue(errors, it, '#diagram without [alt::] — ADA Title II requires alt text on every diagram');
      }
    }

    // ── #slide rules ─────────────────────────────────────────
    if (it.tags.has('slide')) {
      const layout = it.fields.has('layout') ? String(it.fields.get('layout')).trim() : null;
      if (!layout) {
        pushIssue(errors, it, '#slide without [layout::] — every slide must declare a layout');
      } else if (!LAYOUT_ENUM.has(layout)) {
        pushIssue(errors, it, `#slide with unknown [layout:: ${layout}] — must be one of ${[...LAYOUT_ENUM].join(', ')}`);
      } else if (layout === 'diagram' && !it.fields.has('alt')) {
        pushIssue(errors, it, '#slide [layout:: diagram] without [alt::] — ADA Title II requires alt text on diagram slides');
      }
    }
  }

  // adversarial-thinking soft warning
  if (parsed.frontmatter.adversarialThinking === true) {
    if (!all.some(it => it.tags.has('adversarial'))) {
      warnings.push({
        message: 'frontmatter adversarial-thinking: true but no #adversarial items found in this doc',
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
