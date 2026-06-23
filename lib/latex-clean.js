// latex-clean.js — remove pdflatex intermediates after a successful compile.
//
// pdflatex litters the output directory with .aux/.log/.out (and, for
// beamer/nav-bearing docs, .nav/.snm/.toc) alongside the kept .tex source and
// the final .pdf. Sweep exactly those intermediates for the compiled basename,
// leaving the .tex and .pdf — and any other deck's files — untouched.

const fs = require("node:fs");
const path = require("node:path");

const AUX_EXTS = ["aux", "log", "out", "nav", "snm", "toc"];

function cleanupLatexAux(texPath, outputDir) {
  const base = path.basename(texPath).replace(/\.tex$/, "");
  const removed = [];
  for (const ext of AUX_EXTS) {
    const name = `${base}.${ext}`;
    const full = path.join(outputDir, name);
    try {
      fs.unlinkSync(full);
      removed.push(name);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  return removed;
}

module.exports = { cleanupLatexAux };
