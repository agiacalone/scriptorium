// _filter.js — shared semester-tag filter for generators.
//
// Tag form: `#used/<term>` (e.g. #used/sp26). Multi-valued — items accumulate
// term tags over their lifetime.
//
// Filter modes:
//   - no option set → return items unchanged.
//   - options.semester = 'sp26' → loose: keep items tagged #used/sp26 plus
//     items with NO #used/* tag at all (untagged = evergreen).
//   - options.strictSemester = 'sp26' → strict: keep ONLY items tagged
//     #used/sp26.
//
// `strictSemester` takes precedence if both are passed.

const USED_PREFIX = 'used/';

export function hasAnyUsedTag(item) {
  if (!item || !item.tags) return false;
  for (const t of item.tags) {
    if (typeof t === 'string' && t.startsWith(USED_PREFIX)) return true;
  }
  return false;
}

export function hasUsedTag(item, term) {
  if (!item || !item.tags || !term) return false;
  return item.tags.has(`${USED_PREFIX}${term}`);
}

export function applyTermFilter(items, options = {}) {
  if (!Array.isArray(items)) return items;
  const strict = options.strictSemester;
  const loose = options.semester;
  if (strict) {
    return items.filter((it) => hasUsedTag(it, strict));
  }
  if (loose) {
    return items.filter((it) => hasUsedTag(it, loose) || !hasAnyUsedTag(it));
  }
  return items;
}

// Convenience accessor wrappers — generators call these instead of
// `parsed.byRole.get(role)` / `parsed.bySection.get(key)` directly.
export function filteredByRole(parsed, role, options = {}) {
  const list = (parsed && parsed.byRole && parsed.byRole.get(role)) || [];
  return applyTermFilter(list, options);
}

export function filteredBySection(parsed, key, options = {}) {
  const list = (parsed && parsed.bySection && parsed.bySection.get(key)) || [];
  return applyTermFilter(list, options);
}

export default applyTermFilter;
