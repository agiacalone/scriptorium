// out-dir.js — resolve where generated artifacts are written.
//
// Default: a `products/` subdirectory beside the `_lecture_main.md` source, so
// generated artifacts + LaTeX intermediates never litter the topic root (which
// holds the kept source). An explicit `--out` overrides and is used verbatim.

const path = require("node:path");

function resolveOutDir(outFlag, mainPath) {
  if (outFlag) return outFlag;
  return path.join(path.dirname(path.resolve(mainPath)), "products");
}

module.exports = { resolveOutDir };
