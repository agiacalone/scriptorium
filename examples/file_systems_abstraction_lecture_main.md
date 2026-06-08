---
title: File Systems — Abstraction and Naming
course: CECS 326
topic-slug: file_systems_abstraction
term: sp26
adversarial-thinking: false
type: lecture-main
visibility: public
tags: [cecs-326, teaching, operating-systems, file-systems, lecture-main, example]
icon: LiGraduationCap
iconColor: var(--text-normal)
created: 2026-05-07T10:35:00-07:00
updated: 2026-05-17T11:35:00-07:00
---

# File Systems — Abstraction and Naming

## Learning Objectives

- Explain the file system as an abstract data structure layered over a flat block device. #objective
- Distinguish file attributes, file operations, and the storage layer they touch. #objective
- Trace path resolution through a hierarchical directory tree from root to inode. #objective
- Distinguish hard links from symbolic links by mechanism and lifetime semantics. #objective
- Connect single-directory designs to hierarchical designs via concrete simulation. #objective

## Vocabulary

- **file** — a name plus a sequence of bytes plus metadata, layered on top of a block device #vocab #section/vocab [slide:: 3] [citation:: Tanenbaum 4.1]
- **block device** — storage hardware exposing a flat array of fixed-size, numbered blocks #vocab #section/vocab [slide:: 3] [citation:: Tanenbaum 4.1]
- **directory** — a structure mapping names to inodes; itself a file in UNIX #vocab #section/vocab [slide:: 6] [citation:: Tanenbaum 4.2]
- **inode** — fixed-size on-disk metadata structure: type, size, owner, perms, timestamps, block pointers, link count #vocab #section/vocab [slide:: 10] [citation:: Tanenbaum 4.2]
- **directory entry (dentry)** — a (filename → inode-number) pair stored inside a directory #vocab #section/vocab [slide:: 10] [citation:: Tanenbaum 4.2]
- **path resolution** — the per-component walk that maps a path string to an inode #vocab #section/vocab [slide:: 14] [citation:: Tanenbaum 4.2.4]
- **absolute path** — path starting at the root inode #vocab #section/vocab [slide:: 14] [citation:: Tanenbaum 4.2.4]
- **relative path** — path starting at the process's current working-directory inode #vocab #section/vocab [slide:: 14] [citation:: Tanenbaum 4.2.4]
- **working directory** — the inode each process resolves relative paths against #vocab #section/vocab [slide:: 14] [citation:: POSIX getcwd(3)]
- **hard link** — directory entry pointing to an existing inode; bumps link count #vocab #section/vocab [slide:: 11] [citation:: Tanenbaum 4.2.3]
- **symbolic link (soft link / symlink)** — small file whose contents are a path string, resolved at access time #vocab #section/vocab [slide:: 11] [citation:: Tanenbaum 4.2.3]
- **link count (reference count)** — count of directory entries pointing at an inode; inode freed when it hits zero #vocab #section/vocab [slide:: 11] [citation:: Tanenbaum 4.2.3]
- **mount point** — directory at which another filesystem's root is grafted into the namespace #vocab #section/vocab [slide:: 12] [citation:: Tanenbaum 4.3.1]
- **file descriptor** — small integer handle returned by open() that indexes a per-process open-file table #vocab #section/vocab [slide:: 4] [citation:: POSIX open(2)]

## I. Files as Abstraction (15 min)

### Concepts

- A block device exposes a flat array of fixed-size blocks, addressed by number — nothing more. #concept #section/I [slide:: 3] [citation:: Tanenbaum 4.1]
- A file is the abstraction we layer on top: a name, a type, attributes, and a sequence of bytes of arbitrary length. #concept #section/I [slide:: 3] [citation:: Tanenbaum 4.1.1]
- File attributes: name, type, size, owner, permissions, timestamps, link count. #concept #section/I [slide:: 4] [citation:: Tanenbaum 4.1.3]
- File operations: open, close, read, write, seek, stat, link, unlink, rename, truncate. #concept #section/I [slide:: 4] [citation:: Tanenbaum 4.1.6]
- Some operations touch FS metadata (link, rename); others touch data (read, write). The split matters for performance and correctness. #concept #section/I [slide:: 5] [citation:: Tanenbaum 4.1.6]
- Stress the abstraction layering — students often treat 'file' as primitive. It is not. The block device is primitive. #concept #notes-only #section/I [slide:: 3]
- Tanenbaum Q1 prompt: is open() essential? Without open(), every read/write would need a full path resolution. open() is a one-time path resolution that returns a handle. Not theoretically necessary; profoundly practical. #concept #notes-only #section/I [slide:: 4] [citation:: Tanenbaum Q1]

### Cornell blanks

- A block device exposes a flat array of fixed-size _______. A file system layers an abstraction of named, variably-sized _______ on top. #blank #section/I [slide:: 3] [answer:: blocks; files] [citation:: Tanenbaum 4.1]
- Some file operations touch the FS metadata (e.g., _______, rename); others touch the data (e.g., _______, write). The split matters for performance and correctness. #blank #section/I [slide:: 5] [answer:: link; read] [citation:: Tanenbaum 4.1.6]
- open() is not theoretically essential, but without it every read or write must pay the full _______ cost. open() amortizes that cost across all subsequent operations on the returned _______. #blank #section/I [slide:: 4] [answer:: path-resolution; file descriptor] [citation:: Tanenbaum 4.1.6]
- A block device exposes a flat array of fixed-size blocks, addressed by number. Nothing more: _______. #blank #section/I [slide:: 3] [answer:: the file-system abstraction is layered on top]
- A file is the abstraction we layer on top: a name, a type, attributes, and a sequence of bytes of arbitrary length: _______. #blank #section/I [slide:: 3] [answer:: not a hardware primitive — a software construct]
- File attributes: name, type, size, owner, permissions, timestamps, link count: _______. #blank #section/I [slide:: 4] [answer:: each attribute lives in the inode]

### KEY

- A file system is an abstract data structure laid over a flat block device. Every concept that follows is implementation strategy and trade-offs. #key-callout #section/I [slide:: 5]

### Case studies

- UNIX: hierarchical FS with i-nodes; everything-is-a-file philosophy. #case-study #section/I [slide:: 5] [citation:: Ritchie & Thompson 1974]
- MS-DOS / FAT: single-volume hierarchical with no inode layer (FAT entries are the metadata). #case-study #section/I [slide:: 5] [citation:: Tanenbaum 4.3.2]

### Discussion / activity

- Is the open() system call absolutely essential? What would the consequences be of not having it? #discussion #section/I [citation:: Tanenbaum Q1]
- Live shell demo: stat, ls -li, ln, ln -s. Inspect inode numbers; delete originals; observe what happens to each link type. #activity #section/I

## II. Directory Structures — Single-Level to DAG (20 min)

### Concepts

- Single-level: one global namespace. Simple, but every name must be unique across the whole system. #concept #section/II [slide:: 6] [citation:: Tanenbaum 4.2.1]
- Two-level: per-user namespace. Solves user collision; doesn't solve sharing or per-user organization. #concept #section/II [slide:: 7] [citation:: Tanenbaum 4.2.1]
- Hierarchical (tree): nested directories. Scales to arbitrary structure, supports per-user organization, no inherent sharing. #concept #section/II [slide:: 7] [citation:: Tanenbaum 4.2.1]
- DAG (hierarchical + links): tree plus links. Same file accessible under multiple names. Two link mechanisms: hard and symbolic. #concept #section/II [slide:: 8] [citation:: Tanenbaum 4.2.3]
- Path resolution walks the structure component by component, from the root or from the current working directory. #concept #section/II [slide:: 9] [citation:: Tanenbaum 4.2.4]
- Single-directory simulation (Tanenbaum Q2): encode the path INTO the filename. `/usr/local/bin/foo` becomes a flat key — exactly how S3 and R2 work. #concept #notes-only #section/II [slide:: 6] [citation:: Tanenbaum Q2]
- Every level of the path requires a metadata read. Deep directory trees have a real performance cost, not just an aesthetic one. #concept #notes-only #section/II [slide:: 9]

### Cornell blanks

- Directory designs evolved through four phases: single-level → _______ → hierarchical → _______. Each transition solved a problem the previous design could not. #blank #section/II [slide:: 7] [answer:: two-level; DAG] [citation:: Tanenbaum 4.2.1]
- Resolving `/a/b/c` requires a sequence of _______ reads — one per path component — unless the result is _______. #blank #section/II [slide:: 9] [answer:: directory; cached] [citation:: Tanenbaum 4.2.4]
- A single-directory OS with arbitrarily long filenames can simulate a hierarchy by encoding the _______ into the filename. Object stores like S3 work exactly this way. #blank #section/II [slide:: 6] [answer:: path] [citation:: Tanenbaum Q2]
- Single-level: one global namespace. Simple, but every name must be unique across the whole system: _______. #blank #section/II [slide:: 6] [answer:: collision under multi-user systems killed it]
- Two-level: per-user namespace. Solves user collision, doesn't solve sharing or per-user organization: _______. #blank #section/II [slide:: 7] [answer:: still no sub-organization within a user]
- Hierarchical (tree): nested directories. Scales to arbitrary structure, supports per-user organization, no inherent sharing: _______. #blank #section/II [slide:: 7] [answer:: tree alone cannot share a file under multiple names]

### KEY

- Each directory-design transition solved a problem the previous one could not. The DAG (hierarchical + links) is the current default because nothing simpler covers both organization and sharing. #key-callout #section/II [slide:: 8]

### Case studies

- iOS / Android app sandboxes: per-app rooted hierarchies — directories as namespace boundaries. #case-study #section/II [slide:: 8]
- S3 / R2 object stores: no real directories — only flat keys with `/` as a convention. Cloud-scale Tanenbaum-Q2. #case-study #section/II [slide:: 6]

### Discussion / activity

- A simple OS supports only a single directory. Can a hierarchical file system be simulated within it? How? #discussion #section/II [citation:: Tanenbaum Q2]
- S3 and R2 buckets have no real directories — only flat keys. Tanenbaum's Q2 says simulate a hierarchy in a single-directory OS. Cloud object stores already do this. What's the hidden cost? #discussion #section/II
- Whiteboard: trace path resolution for `/usr/local/bin/foo` step by step. Mark every disk read. #activity #section/II

## III. Hard Links vs Symbolic Links (25 min)

### Concepts

- An inode is a fixed-size metadata structure on disk: type, size, owner, permissions, timestamps, block pointers, link count. #concept #section/III [slide:: 10] [citation:: Tanenbaum 4.2.2]
- A directory entry is (filename → inode number). Many directory entries can point to the same inode. #concept #section/III [slide:: 10] [citation:: Tanenbaum 4.2.2]
- Hard link: a directory entry pointing to an existing inode. Increments link count. Same file, multiple names. #concept #section/III [slide:: 11] [citation:: Tanenbaum 4.2.3]
- Symbolic link: a small special file whose contents are a path string. Resolution follows the path at access time. #concept #section/III [slide:: 11] [citation:: Tanenbaum 4.2.3]
- Hard link survives deletion of any other name; only when link count hits zero is the inode freed. #concept #section/III [slide:: 12] [citation:: Tanenbaum 4.2.3]
- Symlink can dangle (point to a deleted target), can cross filesystems, can point to directories. #concept #section/III [slide:: 12] [citation:: Tanenbaum 4.2.3]
- Hard links cannot cross filesystem boundaries (inode numbers are filesystem-scoped) and traditionally cannot point to directories (would create cycles). #concept #section/III [slide:: 13] [citation:: Tanenbaum 4.2.3]
- A file with link count > 1 has no 'original'. All names are equally valid. There is no operation to ask 'what was the first name?' #concept #notes-only #section/III [slide:: 12]
- If you `rm` the only directory entry of an inode but a process still has it open, the inode lives until the last reference closes. This is how Unix temp files often work. #concept #notes-only #section/III [slide:: 13]

### Cornell blanks

- An inode contains type, size, owner, permissions, timestamps, block pointers, and a _______ count tracking how many directory entries reference it. #blank #section/III [slide:: 10] [answer:: link] [citation:: Tanenbaum 4.2.2]
- A symbolic link is a small special file whose contents are a _______. Resolution follows it at access time. #blank #section/III [slide:: 11] [answer:: path string] [citation:: Tanenbaum 4.2.3]
- When you `rm` a file, you're really removing a _______. The inode is freed only when its link count reaches _______. #blank #section/III [slide:: 12] [answer:: directory entry; zero] [citation:: Tanenbaum 4.2.3]
- Hard links cannot cross filesystems because inode numbers are scoped to a _______. Symlinks can cross because they store a _______. #blank #section/III [slide:: 13] [answer:: single filesystem; path string]
- An inode is a fixed-size metadata structure on disk: type, size, owner, permissions, timestamps, block pointers, LINK COUNT: _______. #blank #section/III [slide:: 10] [answer:: it is the file's identity, separate from any name]
- A directory entry is (filename → inode number). Many directory entries can point to the same inode: _______. #blank #section/III [slide:: 10] [answer:: that's exactly how hard links work]
- Hard link: a directory entry pointing to an existing inode. Increments link count. Same file, multiple names: _______. #blank #section/III [slide:: 11] [answer:: deletion is link removal, not file destruction]

### KEY

- A hard link IS the file (one of its names). A symlink POINTS TO a path. The lifetime semantics fall out of that one distinction. #key-callout #section/III [slide:: 12]

### Case studies

- Windows NTFS: hierarchical with the Master File Table — i-node-equivalent for NTFS. #case-study #section/III [slide:: 13] [citation:: Tanenbaum 4.5.4]

### Discussion / activity

- Name one advantage of hard links over symbolic links and vice versa. #discussion #section/III [citation:: Tanenbaum Q5]
- What happens to a hard link when its referenced file is deleted? What about a symlink? #discussion #section/III
- Why doesn't the disk just store filenames directly, instead of using inodes plus directory entries? #discussion #section/III
- Pair drill: a simple OS supports only a SINGLE directory but allows arbitrarily long filenames. Sketch a scheme that approximates a hierarchical file system. #activity #section/III [citation:: Tanenbaum Q2]

## IV. Path Resolution and Live Demo (15 min)

### Concepts

- Absolute path: starts at the root inode (typically inode 2 on ext family). Resolved component by component. #concept #section/IV [slide:: 14] [citation:: Tanenbaum 4.2.4]
- Relative path: starts at the current working directory inode (kernel keeps a per-process pointer). #concept #section/IV [slide:: 14] [citation:: Tanenbaum 4.2.4]
- `stat` shows everything in the inode — type, size, owner, mode, link count, inode number. #concept #section/IV [slide:: 15] [citation:: stat(2)]
- `ls -li` lists directory entries with their inode numbers. Hard links share; symlinks differ. #concept #section/IV [slide:: 15] [citation:: ls(1)]
- Bridge to next session: now that we can NAME a file and FIND its inode, how does the inode tell us where the data is on disk? — three allocation strategies (next session). #concept #section/IV [slide:: 16]
- Live demo flow: `cd /tmp; mkdir demo; cd demo; echo hello > a; ln a b; ln -s a c; ls -li`. Three entries, two distinct inode numbers, one with link count 2. #concept #notes-only #section/IV [slide:: 15]
- `rm a; cat b` works (hard link survives). `cat c` fails (symlink dangles). The data lives in the inode (link count was 2, now 1, still alive). #concept #notes-only #section/IV [slide:: 15]

### Cornell blanks

- An absolute path starts at the _______ inode. A relative path starts at the inode of the current _______. #blank #section/IV [slide:: 14] [answer:: root; working directory] [citation:: Tanenbaum 4.2.4]
- After `ln a b; ln -s a c; rm a`, attempting `cat b` _______ and attempting `cat c` _______. #blank #section/IV [slide:: 15] [answer:: succeeds; fails (dangling symlink)]
- We now know how to find a file's _______. Next session: how the inode itself points to the file's _______ on disk. #blank #section/IV [slide:: 16] [answer:: inode; data blocks]
- Absolute path: starts at the root inode (typically inode 2 on ext family). Resolved component by component: _______. #blank #section/IV [slide:: 14] [answer:: each component is one directory read]
- Relative path: starts at the current working directory inode (kernel keeps a per-process pointer): _______. #blank #section/IV [slide:: 14] [answer:: chdir() updates that pointer]
- `stat` shows everything in the inode — type, size, owner, mode, link count, inode number: _______. #blank #section/IV [slide:: 15] [answer:: it is the user-space window onto the inode]

### KEY

- Path resolution is a per-component sequence: read directory, look up name, fetch inode, repeat. Every component is a metadata read unless cached. #key-callout #section/IV [slide:: 14]

### Discussion / activity

- Live shell demo: stat, ls -li, ln, ln -s — verify link-count semantics. #activity #section/IV

## Question Bank

### MC

- #question #type/mc #difficulty/1 #section/I #exam-eligible [answer:: B] [points:: 2] [slide:: 3]
  Stem: A block device exposes which of the following to the file system?
  - A. A tree of named files
  - B. A flat array of fixed-size, numbered blocks
  - C. A stream of bytes with no addressing
  - D. A graph of inodes connected by directory entries

- #question #type/mc #difficulty/1 #section/I #exam-eligible [answer:: C] [points:: 2] [slide:: 4]
  Stem: Which file operation is a metadata operation, not a data operation?
  - A. read
  - B. write
  - C. rename
  - D. seek

- #question #type/mc #difficulty/2 #section/II #exam-eligible [answer:: D] [points:: 2] [slide:: 7]
  Stem: Why did directory designs evolve from two-level to hierarchical?
  - A. Hierarchical directories are faster to traverse than two-level
  - B. Two-level designs cannot store more than 1024 files per user
  - C. Hierarchical directories require less disk space
  - D. Two-level designs cannot organize files within a single user's namespace

- #question #type/mc #difficulty/2 #section/III #exam-eligible [answer:: A] [points:: 2] [slide:: 13]
  Stem: After `echo hi > a; ln a b; rm a`, what does `cat b` produce?
  - A. The contents "hi"
  - B. An error: no such file or directory
  - C. An empty file (link count became zero)
  - D. The literal string "a"

- #question #type/mc #difficulty/2 #section/III #exam-eligible [answer:: B] [points:: 2] [slide:: 13]
  Stem: Why can a hard link not cross filesystem boundaries?
  - A. The kernel forbids it for security reasons
  - B. Inode numbers are scoped to a single filesystem and cannot disambiguate across filesystems
  - C. Hard links require the target inode to be in RAM
  - D. The link count field cannot hold more than 32,767 entries cross-filesystem

- #question #type/mc #difficulty/3 #section/III #exam-eligible [answer:: C] [points:: 3] [slide:: 13] [covers:: Tanenbaum 4.2.3]
  Stem: A process holds a file open. Another process `rm`s the only directory entry. What happens?
  - A. The open process immediately gets EBADF on its next read
  - B. The kernel blocks the rm until the file is closed
  - C. The directory entry is removed; the inode is kept alive by the open file descriptor and freed when it closes
  - D. The file's data is zeroed but the inode is preserved

- #question #type/mc #difficulty/2 #section/IV #exam-eligible [answer:: B] [points:: 2] [slide:: 9]
  Stem: Resolving `/usr/local/bin/foo` cold (no cache) requires roughly how many directory reads?
  - A. One — the path is a single string lookup
  - B. Four — one per path component after root
  - C. One per byte in the path string
  - D. None — modern filesystems precompute path lookups

- #question #type/mc #difficulty/2 #section/I #exam-eligible [answer:: B] [points:: 2] [slide:: 11]
  Stem: Which inode field is updated by `chmod` but not by `write`?
  - A. mtime (data modification time)
  - B. ctime (inode change time) only
  - C. atime (access time)
  - D. size

- #question #type/mc #difficulty/2 #section/II #exam-eligible [answer:: C] [points:: 2] [slide:: 11]
  Stem: A directory entry maps a name to:
  - A. The byte offset within the parent directory
  - B. A copy of the file's data blocks
  - C. An inode number
  - D. A path string back to the root

- #question #type/mc #difficulty/3 #section/III #exam-eligible [answer:: D] [points:: 3] [slide:: 13] [covers:: Tanenbaum 4.2.3]
  Stem: Why does Unix forbid hard links to directories (outside `.` and `..`)?
  - A. Directory inodes cannot have a link count greater than two
  - B. The kernel's directory cache cannot handle two paths to the same directory
  - C. Mount points would become ambiguous
  - D. Arbitrary directory hard links could create cycles, breaking tree-walking tools and orphaning data on `rm -r`

- #question #type/mc #difficulty/2 #section/IV #exam-eligible [answer:: A] [points:: 2] [slide:: 12]
  Stem: A path lookup encounters a symlink mid-resolution. The kernel:
  - A. Substitutes the symlink's path string and re-resolves from that point
  - B. Returns ELOOP and aborts
  - C. Uses the symlink's inode number directly as the next component
  - D. Skips the symlink and continues with the next component

### TF / code

- #question #type/tf #difficulty/1 #section/I #exam-eligible [answer:: T] [points:: 1] [slide:: 4]
  open() is a practical optimization rather than a theoretical necessity — a system without open() could function but would pay path-resolution cost on every read or write.

- #question #type/tf #difficulty/1 #section/III #exam-eligible [answer:: F] [points:: 1] [slide:: 12]
  A symbolic link increments the link count of its target inode.

- #question #type/tf #difficulty/2 #section/III #exam-eligible [answer:: T] [points:: 1] [slide:: 15]
  Two hard links to the same file have the same inode number when shown by `ls -li`.

- #question #type/code #difficulty/2 #section/IV #exam-eligible [answer:: F] [points:: 2] [slide:: 15]
  Consider: `echo hi > a; ln -s a c; rm a; cat c`. The final `cat c` succeeds because the symlink stores the contents.

- #question #type/tf #difficulty/2 #section/II #exam-eligible [answer:: T] [points:: 2] [slide:: 7]
  In a hierarchical filesystem, two files in different directories may share the same filename without conflict because uniqueness is enforced per-directory, not globally. (True — the (parent inode, name) pair is the uniqueness key.)

- #question #type/tf #difficulty/2 #section/III #exam-eligible [answer:: F] [points:: 2] [slide:: 12]
  Removing a symlink decrements the link count of its target inode. (False — `rm` on a symlink only removes the symlink's own directory entry; the target inode is untouched.)

- #question #type/code #difficulty/3 #section/III #exam-eligible [answer:: T] [points:: 3] [slide:: 12] [covers:: Tanenbaum 4.2.3]
  Consider: `echo hi > a; ln a b; echo bye > a; cat b` prints `bye` (not `hi`). (True — `ln a b` creates a second hardlink to the same inode; `echo bye > a` is shell redirection that opens-truncates-writes the same inode, so `cat b` sees the new contents.)

### Short answer

- #question #type/sa #difficulty/2 #section/I #exam-eligible [answer:: A file system layers a name+attributes+byte-stream abstraction on top of a flat array of fixed-size, numbered blocks. The block device is primitive; everything else is convention.] [points:: 4] [slide:: 3]
  In one sentence each, define a block device and define a file. Make the layering relationship explicit.

- #question #type/sa #difficulty/2 #section/II #exam-eligible [answer:: Encode the path into the filename — `/usr/local/bin/foo` becomes a flat key `usr/local/bin/foo`. Object stores like S3 do exactly this. The hidden cost is that every "directory" operation (rename, list-contents) becomes a key-prefix scan rather than a single inode read.] [points:: 5] [slide:: 8]
  Tanenbaum Q2: an OS supports only a single directory but arbitrarily long filenames. Describe a scheme that simulates a hierarchical file system. Name a real-world system that works this way and identify the hidden cost.

- #question #type/sa #difficulty/3 #section/III #exam-eligible [answer:: Hard link advantage: survives target deletion (link count > 0 keeps the inode alive); zero per-link overhead beyond the directory entry. Symlink advantage: can cross filesystems, can point to directories, the path is human-readable and inspectable with readlink.] [points:: 4] [slide:: 13] [covers:: Tanenbaum 4.2.3]
  Name one advantage of a hard link over a symlink, and one advantage of a symlink over a hard link.

- #question #type/sa #difficulty/3 #section/III #exam-eligible [answer:: A hard link is another directory entry pointing to the existing inode (same file, two names — link count goes from 1 to 2). A symlink is a new inode whose data is the path string "a"; its own link count is 1, the target's is unchanged. After rm a, the hard link succeeds (inode still alive, link count 1). The symlink dangles (its path string still points to a non-existent name).] [points:: 5] [slide:: 15] [covers:: Tanenbaum 4.2.3] #used/sp26 [used-on:: final sp26-A as 15-pt SA, reframed prompt — see exams-sp26/326-final-sp26-a.tex Q24]
  Walk through what happens at the inode level when you run `echo hi > a; ln a b; ln -s a c; rm a`. For each step, state what changes in inode and link-count terms. Then predict the result of `cat b` and `cat c`.

- #question #type/sa #difficulty/2 #section/I #exam-eligible [answer:: An *inode* stores the file's metadata and pointers to data blocks: type, size, owner/group, permissions, timestamps (atime/mtime/ctime), link count, and direct/indirect block pointers. A *directory entry* stores only a name and an inode number — it is the (name → inode) mapping. The split lets a single inode have multiple names (hard links): each link is a directory entry, but they all share one inode (one set of metadata, one set of data blocks).] [points:: 5] [slide:: 11]
  Distinguish an inode from a directory entry. Why does this split enable hard links?

- #question #type/sa #difficulty/3 #section/IV #exam-eligible [answer:: A `..` entry in every directory points to its parent inode. The kernel resolves a relative path like `../../foo` by chasing `..` upward (each lookup is a normal directory read) until the path is consumed, then resolving `foo` in that final directory. The cost is the same as an absolute path of equivalent depth — one directory read per component. The shell's `cd ..` is therefore not a special case; it is a normal lookup of a normal directory entry that the filesystem maintains.] [points:: 5] [slide:: 9] [covers:: Tanenbaum 4.2.4]
  Explain how the kernel resolves a path containing `..` (e.g., `../../foo`). What metadata makes this possible, and how does the cost compare to resolving an equivalent absolute path?

### Fill-in-blank

- #question #type/fib #difficulty/1 #section/I [answer:: link count] [slide:: 11]
  An inode contains type, size, owner, permissions, timestamps, block pointers, and a _______ tracking how many directory entries reference it.

- #question #type/fib #difficulty/1 #section/III [answer:: path string] [slide:: 12]
  A symbolic link is a small special file whose contents are a _______; resolution follows it at access time.

- #question #type/fib #difficulty/2 #section/IV [answer:: directory] [slide:: 9]
  Resolving `/a/b/c` requires a sequence of _______ reads — one per path component — unless cached.

## Self-Quiz

- #self-quiz #section/I `Q1.` Why is a block device "primitive" in the layering sense, while a file is not? Use one sentence each.
- #self-quiz #section/I `Q2.` Give one example of a file operation that touches metadata only and one that touches data only.
- #self-quiz #section/II `Q3.` Sketch the four directory designs in order. For each transition, name the limitation that drove it.
- #self-quiz #section/II `Q4.` Trace `/usr/local/bin/foo` resolution. How many directory reads in the cold case?
- #self-quiz #section/III `Q5.` Draw the inode + two hard links + one symlink picture. Mark the link counts.
- #self-quiz #section/III `Q6.` After `ln a b; ln -s a c; rm a`, predict and justify the result of `cat b` and `cat c`.
- #self-quiz #section/III `Q7.` Why can hard links not cross filesystems? Why can symlinks?
- #self-quiz #section/III `Q8.` Why are hard links to directories traditionally disallowed? What invariant of the directory graph would they break?
- #self-quiz #section/IV `Q9.` What does `stat` print, and where does each field come from?
- #self-quiz #section/IV `Q10.` Bridge: now that we have an inode in hand, what's the next problem the file system has to solve?

## Summary

A file system is an abstract data structure laid over a flat block device. The block device exposes only numbered blocks; the file system layers names, attributes, and byte streams on top. Directory designs evolved single-level → two-level → hierarchical → DAG, each step solving a sharing or organization problem the previous design couldn't. Path resolution is a per-component walk: read directory, look up name, fetch inode, repeat. Hard links share an inode (same file, multiple names, ref-counted); symlinks are pointer-files containing a path string. The lifetime semantics — hard links survive any other name's deletion; symlinks dangle — fall out of that one mechanical distinction. Next session: now that we can find an inode, how does the inode point to the data?

## References

- Tanenbaum & Bos, *Modern Operating Systems*, 4th ed. — Ch 4 §4.1 Files, §4.2 Directories
- POSIX.1-2017 — open(), stat(), link(), symlink() system calls
- Ritchie & Thompson (1974) — *The UNIX Time-Sharing System*, CACM 17(7) — original i-node design
- Linux man pages: stat(2), inode(7), symlink(7)

## Slide deck source

- #slide [slide:: 1] [layout:: title] **File Systems — Abstraction and Naming** [tagline:: Where does that file actually live, in bytes, on the disk?]
- #slide [slide:: 2] [layout:: agenda] **Today**
  - Files as Abstraction (15)
  - Directory Structures (20)
  - Hard Links vs Symlinks (25)
  - Path Resolution + Live Demo (15)
- #slide [slide:: 3] [layout:: concept] **Layering — blocks vs files**
  - Block device: flat array of fixed-size, numbered blocks. Primitive.
  - File: name + type + attributes + arbitrary-length byte stream. Layered.
- #slide [slide:: 4] [layout:: split] **Operations split: metadata vs data**
  - Metadata: open, close, link, unlink, rename, stat, truncate
  - Data: read, write, lseek
- #slide [slide:: 5] [layout:: key] **A file system is an abstract data structure laid over a flat block device.**
- #slide [slide:: 6] [layout:: section-divider] **§II — Directory Structures**
- #slide [slide:: 7] [layout:: concept] **Four directory designs**
  - Single-level → Two-level → Hierarchical → DAG (hierarchical + links)
  - Each step solves a problem the previous one couldn't
- #slide [slide:: 8] [layout:: case-study] **Cloud object stores ARE Tanenbaum's Q2**
  - S3, R2: no real directories — only flat keys with `/` as a convention
  - Path encoded into filename; the directory IS flat
- #slide [slide:: 9] [layout:: code] **Path resolution — `/usr/local/bin/foo`**
  - read(/) → find usr → read(usr) → find local → read(local) → find bin → read(bin) → find foo → return inode
  - Cold case: 4 directory reads. Caches make this fast in practice.
- #slide [slide:: 10] [layout:: section-divider] **§III — Hard Links vs Symlinks**
- #slide [slide:: 11] [layout:: concept] **Inodes + directory entries**
  - Inode: on-disk metadata. type/size/owner/perms/timestamps/blocks/link-count.
  - Directory entry: (filename → inode number). Many entries can point to one inode.
- #slide [slide:: 12] [layout:: split] **Hard link vs Symlink — mechanism**
  - Hard link: directory entry → existing inode. Bumps link count.
  - Symlink: small file whose contents are a path string. Resolved at access.
- #slide [slide:: 13] [layout:: key] **A hard link IS the file. A symlink POINTS TO a path.**
- #slide [slide:: 14] [layout:: section-divider] **§IV — Path Resolution + Live Demo**
- #slide [slide:: 15] [layout:: code] **Live demo: ln, ln -s, rm**
  - `echo hi > a; ln a b; ln -s a c; ls -li`
  - `rm a; cat b` ✓ ; `cat c` ✗ (dangling)
- #slide [slide:: 16] [layout:: summary] **Path resolution is a per-component sequence: read dir, look up name, fetch inode, repeat. Next: how does the inode point to the data?**
