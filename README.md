# lecture-materials-assistant

A [Claude Code](https://claude.ai/code) skill and reusable generator toolchain for
production-ready lecture materials for university CS courses.

Student-facing lecture materials are intentionally partial replacements for
distributing slides. They should carry roughly 40% of slide content and omit key
elements so students still need to attend lecture.
Printed student handouts and instructor lecture notes should also use color
intentionally so both documents are easy to navigate at a glance during a live lecture.

This repo now contains the stable JavaScript generators directly. In a course repo,
Claude should gather topic and content, write or update a lecture spec JSON, and use
the checked-in generator scripts to produce the lecture materials.

## Current Status

The end-to-end workflow is working:
- freeform or structured request -> lecture spec JSON
- lecture spec JSON -> compiled lecture documents

It has been exercised successfully with a `Virtual Memory and Paging` example.

Current limitation: the prompt parser still needs refinement. It produces usable
specs, but some extracted fields and generated phrasing still need cleanup before
the outputs should be treated as production-ready without review.

## What It Generates

| Artifact | Format | Description |
|---|---|---|
| Lecture notes | `.docx` | Instructor copy with speaker notes, timing, and callout boxes |
| Cornell handout | `.docx` | Pre-distributed guided notes with roughly 40% slide coverage; students fill omitted key elements from projected slides |
| Study questions | `.docx` | 10 tiered questions (Recall / Apply / Analyze) that reinforce lecture rather than restate slides |
| Pop quiz | `.docx` | 5-question in-class quiz with instructor answer key |
| Slide deck | `.pptx` | 14–18 slides, CS Modern dark slate theme |
| GitHub README | `.md` | GitHub Classroom assignment (reading or lab variant) |
| Question bank | `.md` | Persistent tagged question pool (mc / tf / code / fib / sa) |
| Exam | `.pdf` + `.tex` | Assembled from question bank(s); produces student and key versions |

## Installation

Choose the platform path that matches your Claude Code machine.

### macOS

Install the base tools:

```bash
brew install git node
```

For exam PDF generation, install a LaTeX distribution:

```bash
brew install --cask mactex-no-gui

# or a smaller install
brew install basictex
sudo tlmgr install enumitem listings geometry
```

### Fedora Server

Install the base tools:

```bash
sudo dnf install -y git nodejs npm
```

For exam PDF generation, install LaTeX:

```bash
sudo dnf install -y texlive-scheme-basic texlive-enumitem texlive-listings texlive-geometry
```

### Fedora Kinoite with Distrobox

Install and use the skill inside your Distrobox container rather than on the immutable host.

Create a container if needed:

```bash
distrobox create --name lecture-materials-assistant --image fedora:latest
```

Enter the container and install the base tools:

```bash
distrobox enter lecture-materials-assistant
sudo dnf install -y git nodejs npm
```

For exam PDF generation inside the container:

```bash
sudo dnf install -y texlive-scheme-basic texlive-enumitem texlive-listings texlive-geometry
```

### Ubuntu / Debian

Install the base tools:

```bash
sudo apt update
sudo apt install -y git nodejs npm
```

For exam PDF generation, install LaTeX:

```bash
sudo apt install -y texlive-latex-base texlive-latex-recommended texlive-latex-extra
```

### Skill Setup

**1. Install the skill into Claude's skills directory:**

```bash
mkdir -p ~/.claude/skills
git clone <this-repo> ~/.claude/skills/lecture-materials-assistant
```

**2. In your course repo, create `CLAUDE.md` from the example template:**

```bash
cp ~/.claude/skills/lecture-materials-assistant/CLAUDE.md.example ./CLAUDE.md
```

Fill in the five course context fields in `CLAUDE.md`.

**3. Reference the installed skill from your course repo's `CLAUDE.md`:**

```markdown
## Skills
- Use the lecture-materials-assistant skill at ~/.claude/skills/lecture-materials-assistant/SKILL.md
  for all lecture content generation requests.
```

## Dependencies

Install the JS dependencies once in this repo:

```bash
npm install
```

Manual equivalent:

```bash
npm install docx pptxgenjs
npm install markdown-it
```

## Course Context

Before generating, provide these five fields in your initial prompt or in
`CLAUDE.md` when they matter for the requested artifact:

| Field | Example |
|---|---|
| Course code + name | `CECS 326 — Operating Systems` |
| Student level | `Upper-division CS majors; strong C/systems background` |
| Lecture length | `~75 minutes` |
| Assessment format | `GitHub Classroom (Markdown), in-class activities` |
| Adversarial thinking | `yes` (Security courses) / `no` (default) |

`Adversarial thinking` defaults to `no`, so it should not block generation by itself.

## Usage

Typical flow:

1. Put the skill on Claude's path and reference it from your course repo's `CLAUDE.md`.
2. Provide course context once.
3. Ask Claude to generate or update a lecture spec JSON from your topic and content.
4. Run the checked-in generator CLI with that spec.

### Scaffolding a lecture spec

You do not need to start from raw JSON. Use the included scaffold command:

```bash
node init-spec.js --prompt "Generate lecture materials for Virtual Memory and Paging in CECS 326 Operating Systems. Student level: upper-division CS majors. ~75 minutes. Cover: virtual address space, page table translation, TLB locality, page faults. Sections: Why virtual memory exists|Page translation and the TLB|Page faults and thrashing. Case studies: single-level page table overhead|thrashing under poor locality. Questions: When is a larger page size a net win?|How should an OS respond to thrashing?"
```

Or use explicit flags:

```bash
node init-spec.js \
  --topic "Virtual Memory and Paging" \
  --course-code "CECS 326" \
  --course-name "Operating Systems" \
  --student-level "Upper-division CS majors with systems background" \
  --minutes 75 \
  --concepts "virtual address space|page table translation|TLB locality|page faults" \
  --sections "Why virtual memory exists|Page translation and the TLB|Page faults and thrashing" \
  --questions "When is a larger page size a net win?|How should an OS respond to thrashing?"
```

That produces a starter spec JSON which Claude can then refine before generation.

### Generating lecture materials

> Generate lecture materials for [TOPIC] in [COURSE]. Cover: [KEY CONCEPTS]. Case studies: [EXAMPLES]. ~[N] minutes.

The skill should not regenerate JavaScript source on each run. It should use the
existing generator code in this repo and feed it a structured config file.

```
generate.js              # CLI orchestrator for the standard lecture set
examples/
  file_systems_abstraction_lecture_main.md   # self-contained sample source
  README.md                                   # how to compile the sample
parser/                  # tagged-Markdown → validated lecture model
lib/                     # shared LaTeX preamble + Cornell palette helpers
generators/
  lecture-notes.js
  cornell-handout.js
  study-questions.js
  quiz.js
  readme.js
  slides.js
  question-bank.js
  exam.js
```

Run the standard lecture set at once, or generate a single artifact, against the
bundled sample (see [`examples/README.md`](examples/README.md)):

```bash
npm install
node generate.js --main examples/file_systems_abstraction_lecture_main.md --no-pdf --out ./out
node generate.js --main examples/file_systems_abstraction_lecture_main.md --artifact slides --out ./out
node generate.js --main examples/file_systems_abstraction_lecture_main.md --artifact cornell --out ./out
```

### Generating a question bank

> Generate a question bank for [TOPIC] in [COURSE]. Sessions covered: [SUBTOPIC 1], [SUBTOPIC 2], [SUBTOPIC 3].

Question banks are topic-wide and append-only. Claude should read the existing bank
first, avoid duplicates, and assign the next sequence number per question type.

```bash
node generate.js --main examples/file_systems_abstraction_lecture_main.md --artifact bank --out ./out
```

### Assembling an exam

> Assemble an exam for [COURSE] [TERM], Exam [N], [X] pts. Draw from: [bank1.md], [bank2.md]. MC: 20 questions × 2 pts. Essay: 2 questions × 5 pts. Difficulty: ★ 40%, ★★ 35%, ★★★ 25%. Randomize: yes.

Exam assembly reads 2–3 bank files, weights question selection by topic coverage if
needed, writes `[course_num]-exam-[n]-[term].tex`, compiles the student PDF, then
toggles `\answerstrue` and recompiles to produce the key PDF.

```bash
node generate.js exam --spec ./your-exam-spec.json --out ./out
```

## References

- `examples/lecture-spec.json` — sample structured lecture input
- `init-spec.js` — scaffold a lecture spec from prompt-like inputs
- `references/style-guide.md` — complete style specifications for all artifacts
- `references/reference_exam.tex` — structural LaTeX template for exam generation

Generated code, generated course materials, and other outputs created by using this
repository are owned by the user who generates them. Those outputs are not required
to be licensed under this repository's license unless they copy substantial portions
of this repository itself.

## License

[MIT](LICENSE)
