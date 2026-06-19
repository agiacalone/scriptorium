---
name: lecture-materials-assistant
description: >
  Alias for Scriptorium (transitional — retire once all devices are synced to the
  scriptorium skill name). Generates lecture material sets for CS professors: lecture
  notes (.pdf), Cornell note-taking handouts (.pdf), study questions (.md), pop quizzes
  (.pdf), GitHub Classroom README assignments (.md), topic-wide question banks (.md),
  reading-list companions (.md), and Slidev slide decks (.md). Use this skill whenever
  a user asks to generate, create, assemble, revise, or extend any lecture materials,
  course handouts, slides, quizzes, study questions, question banks, or GitHub Classroom
  assignments — even partial requests like "make me a Cornell handout for X", "add
  questions to the README", "write a pop quiz on Y", or "append to the question bank".
  Enforces strict style consistency, Cornell ↔ slide alignment auditing, and tiered
  difficulty question design. Always use this skill for any CS lecture content generation
  task. Exams are built by lectern's reg-exam-build, not here.
---

<!-- TRANSITIONAL ALIAS — do not update content here; update the main SKILL.md instead.
     This stub exists so that /lecture-materials-assistant continues to resolve during
     the transition period while course repos still reference the old skill name.
     Retire this alias once all devices and course repos have been updated to
     reference `scriptorium` (see docs/RENAME-RUNBOOK.md). -->

# Scriptorium (via lecture-materials-assistant alias)

> This alias delegates to Scriptorium — the workshop for course content.
> See `~/.claude/skills/scriptorium/SKILL.md` for the canonical skill definition.

<!-- BEGIN DELEGATED CONTENT — keep in sync with SKILL.md -->

Generates styled, production-ready lecture materials for CS courses. Student-facing
lecture materials are intentionally partial: they replace distributing slides, but
should expose only about 40% of slide content so attendance is still required. All
artifacts follow a strict style guide. See `references/style-guide.md` for complete specs.
Printed student handouts and instructor lecture notes should use color
intentionally as a live navigation aid that reads clearly at a glance during lecture.

**Read `references/style-guide.md` before generating any artifact.**

The full skill definition lives at `~/.claude/skills/scriptorium/SKILL.md`.
When invoked via this alias, follow the same workflow as the `scriptorium` skill.
