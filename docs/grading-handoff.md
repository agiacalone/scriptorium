# Where Authored Content Goes to Be Graded

Scriptorium is the **content workshop** of the Lectern · Scriptorium · Oracle suite. It *authors*
materials; it does **not** grade. This doc is a signpost: two of the artifacts Scriptorium produces
hand off to the grading side of the suite, and rather than re-explain grading here, this points you
to where the right information lives — so you don't go hunting.

```
   Scriptorium            Lectern                         Oracle
   (content)      →       (administration)       →        (grading)
   ─────────              ───────────────                 ─────────
   Classroom README       picks the grading type,         runs the grader:
   question bank          assembles exams                 verify-by-proof + gradebox
```

You are in the **content** box. The grading docs live in the other two repos.

---

## Handoff 1 — a Classroom README (lab/programming variant) → how it gets graded

When you generate a GitHub Classroom `readme` in its **lab/programming variant** ("build something,
with verifiable requirements"), you've authored a *student-facing assignment*. *How* that assignment
is graded — and *which* grading mechanism fits it — is documented on the lectern/oracle side:

- **Pick a grading type → lectern [`docs/grading-types.md`](https://github.com/agiacalone/lectern/blob/main/docs/grading-types.md).**
  A plain-language, use-case guide (no security/OS background assumed): manual rubric · oracle
  verify-by-proof · gradebox (code-running / exploit-verification / binary-artifact) · hybrid. Start here.
- **Author the full graders' contract → lectern [`docs/assignment-authoring.md`](https://github.com/agiacalone/lectern/blob/main/docs/assignment-authoring.md).**
  Fixed deliverable paths, the rubric, and academic-integrity patterns (forcing-functions/canaries,
  per-student individualization).
- **The engine mechanics → oracle [`docs/grading-model.md`](https://github.com/agiacalone/oracle/blob/main/docs/grading-model.md).**
  What each grading type *is*, with the deep specialist docs linked from there.

> The *reading-assignment* README variant (answer questions from a chapter) is typically hand- or
> rubric-graded — no autograder needed. The handoff above is for the lab/programming variant.

## Handoff 2 — a question bank → exams

The append-only `*_question_bank.md` you maintain here is the **source exam assembly draws from**.
Exams are controlled documents built by **lectern**, not Scriptorium:

- **lectern `reg-exam-build`** assembles an exam from the bank with per-student serials + a register,
  and **`reg-exam-verify`** checks any paper back to one student/form. See lectern's exam-build docs
  and `notes/exam-tex-doctrine`.

(The `code`-type questions in the bank are *interpretation* questions for exams — not the same thing
as a runnable lab. A runnable lab is authored as a Classroom README and graded via Handoff 1.)

---

## What stays here vs. what doesn't

- **Scriptorium owns the content** — the `_lecture_main.md` source and everything projected from it,
  including the Classroom README and the question bank. Keep authoring those here.
- **Grading lives in the grading repos** — selection and mechanics in lectern + oracle (the links
  above). Scriptorium has no grader and never runs student code.

| If you want to… | Go to |
|---|---|
| Choose how a lab gets graded | lectern `docs/grading-types.md` |
| Author an assignment's full graders' contract | lectern `docs/assignment-authoring.md` |
| Understand a grading type's mechanics | oracle `docs/grading-model.md` |
| Build/verify an exam from the question bank | lectern `reg-exam-build` / `reg-exam-verify` |
