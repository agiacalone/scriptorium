---
title: Processes and Threads — Concurrency Foundations
course: CECS 326
topic-slug: processes_and_threads
term: su26
adversarial-thinking: false
type: lecture-main
visibility: public
tags: [cecs-326, teaching, operating-systems, lecture-main]
icon: LiGraduationCap
iconColor: var(--text-normal)
---

# Processes and Threads — Concurrency Foundations

## Learning Objectives

- Distinguish a process from a thread and explain what each owns. #objective
- Explain why unsynchronized access to shared state causes race conditions. #objective

## Vocabulary

- **process** — an instance of a running program with its own address space #vocab #section/vocab #used/sp26 [slide:: 2] [citation:: Tanenbaum Ch. 2]
- **thread** — a unit of execution within a process that shares the process address space #vocab #section/vocab #used/sp26 [slide:: 2] [citation:: Tanenbaum Ch. 2]

## I. Processes vs. Threads (15 min)

### Concepts

- A process owns an address space, open files, and other resources; threads within it share that address space. #concept #section/I #used/sp26 [slide:: 3] [citation:: Tanenbaum Ch. 2]
- A context switch saves and restores execution state so the CPU can multiplex many threads. #concept #section/I [slide:: 4] [citation:: Tanenbaum Ch. 2]

### Cornell blanks

- A process owns an address space; a _______ is a unit of execution that shares that space. #blank #section/I [slide:: 3] [answer:: thread] [citation:: Tanenbaum Ch. 2]
- A _______ switch saves and restores execution state to multiplex the CPU. #blank #section/I [slide:: 4] [answer:: context] [citation:: Tanenbaum Ch. 2]

## II. Race Conditions (15 min)

### Concepts

- A race condition occurs when the result depends on the nondeterministic interleaving of concurrent accesses to shared state. #concept #section/II [slide:: 5] [citation:: Tanenbaum Ch. 2]

### Cornell blanks

- A _______ condition occurs when the outcome depends on the interleaving of concurrent accesses to shared state. #blank #section/II [slide:: 5] [answer:: race] [citation:: Tanenbaum Ch. 2]

## Question Bank

### MC

- #question #type/mc #difficulty/1 #section/I #exam-eligible [answer:: B] [points:: 2] [slide:: 3]
  Stem: Which resource is shared by all threads within the same process?
  - A. CPU registers
  - B. The process address space
  - C. The thread's stack
  - D. The program counter

## Self-Quiz

- #self-quiz #section/I `Q1.` State one resource a process owns and one resource its threads share.
- #self-quiz #section/II `Q2.` Give a one-sentence definition of a race condition.

## Summary

A process is an instance of a running program with its own address space; threads are units of execution that share that space. Concurrency without synchronization invites race conditions, where correctness depends on interleaving.

## References

- Tanenbaum Ch. 2 — Processes and Threads

## Slide deck source

- #slide [slide:: 1] [layout:: title] **Processes and Threads** [tagline:: The foundations of concurrency.]
- #slide [slide:: 2] [layout:: vocab] **Key Terms**
  - Process, thread
- #slide [slide:: 3] [layout:: concept] **Process vs. Thread**
  - Process: owns an address space
  - Thread: shares the address space
- #slide [slide:: 4] [layout:: concept] **Context Switch**
  - Save and restore execution state
- #slide [slide:: 5] [layout:: concept] **Race Conditions**
  - Outcome depends on interleaving of shared-state access
