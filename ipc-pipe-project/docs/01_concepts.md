# Phase 1 — Concepts: IPC using `pipe()`

Read this before touching the code. Each topic follows the same order:
definition, purpose, how it works, syntax, example, common errors, viva
questions.

---

## 1. Inter-Process Communication (IPC)

**Definition.** IPC is the set of mechanisms an operating system provides
so that separate processes can exchange data and coordinate.

**Purpose.** Every process has its own private virtual address space. A
variable in process A simply does not exist in process B. After `fork()`
the child gets a *copy* of the parent's memory, so changing a variable in
one does not change it in the other. To cooperate, processes must ask the
kernel to carry data between them.

**How it works.** The kernel owns an object (a pipe buffer, a message
queue, a shared memory segment, a socket) and gives each process a handle
to it. Processes use system calls on that handle.

| Mechanism | Data goes through kernel? | Related processes only? | Direction |
|---|---|---|---|
| Pipe (anonymous) | yes, copied | yes | one-way |
| FIFO (named pipe) | yes, copied | no | one-way |
| Message queue | yes, copied | no | messages with types |
| Shared memory | no, direct access | no | both, needs own locking |
| Socket | yes | no, even across machines | two-way |

**Viva.** *Why can't two processes just share a global variable?* Because
each has its own address space; `fork()` copies memory, it does not share it.

---

## 2. Processes and `fork()`

**Definition.** `fork()` creates a new process (the child) that is a
duplicate of the calling process (the parent).

**How it works.** The kernel copies the process: memory (lazily, using
copy-on-write), program counter, and the **file descriptor table**. Both
processes continue from the line after `fork()`. The only difference is
the return value.

```c
pid_t pid = fork();
if (pid < 0)       { /* error: no child was created        */ }
else if (pid == 0) { /* this code runs in the CHILD        */ }
else               { /* this code runs in the PARENT; pid = child's PID */ }
```

The copied descriptor table is the key to pipes: a pipe created *before*
`fork()` is open in *both* processes afterwards.

**Common errors.**
- Creating the pipe *after* `fork()`: each process gets its own separate
  pipe and they cannot talk.
- Not checking `pid < 0`.
- Forgetting `fflush()` before `fork()`: text still in the stdio buffer is
  duplicated and printed twice (see `safe_fork()` in `scenarios.c`).

**`fork()` vs `exec()`.** `fork()` creates a *new process* running the
*same program*. `exec()` creates *no* process; it replaces the program in
the *current* process with a different one (same PID, open descriptors are
kept). A shell runs `ls` by doing `fork()` and then `exec("ls")` in the
child. This project needs only `fork()`.

---

## 3. File descriptors 0, 1 and 2

**Definition.** A file descriptor (fd) is a small non-negative integer
that indexes the process's table of open files. `read()`, `write()` and
`close()` all take an fd.

| fd | Name | Macro | Default |
|---|---|---|---|
| 0 | standard input | `STDIN_FILENO` | keyboard |
| 1 | standard output | `STDOUT_FILENO` | terminal |
| 2 | standard error | `STDERR_FILENO` | terminal |

The kernel always hands out the **lowest free number**. Since 0–2 are
taken, the first `pipe()` in a program normally returns 3 and 4 — you can
see exactly that in the program's output (`read end = fd 3, write end = fd 4`).

---

## 4. Anonymous pipes and `pipe()`

**Definition.** A pipe is a kernel buffer with two ends: bytes written to
the write end can be read, in the same order (FIFO), from the read end.
"Anonymous" means it has no name in the file system.

**Syntax.**

```c
#include <unistd.h>
int fds[2];
if (pipe(fds) == -1) { perror("pipe"); }
/* fds[0] = read end,  fds[1] = write end */
```

Returns 0 on success, -1 on error (`EMFILE`: process has too many open
descriptors; `ENFILE`: system-wide limit).

**How it works internally.**

```
            write(fds[1])                      read(fds[0])
 writer ───────────────►  [ kernel buffer ] ───────────────► reader
                           64 KiB on Linux
```

- The buffer lives in kernel memory. On Linux its default capacity is
  65,536 bytes.
- `write()` copies bytes from the process into the buffer; `read()` copies
  them out and removes them. Data can be read only once.
- **Buffer empty** → `read()` blocks (sleeps) until data arrives.
- **Buffer full** → `write()` blocks until the reader makes room.
- This blocking is what synchronizes the two processes automatically.
- A pipe is a **byte stream**: it does not remember where one `write()`
  ended and the next began.

**Why is a pipe unidirectional?** It is a single buffer with exactly one
read end and one write end; data flows only write-end → read-end. If both
processes read and wrote the same pipe, a process could read back its own
message, and nobody could tell whose data is whose.

**Why two pipes for two-way communication?** Use one pipe per direction:

```
            pipe 1 (p2c)
 PARENT ──write──────────read──► CHILD
 PARENT ◄──read──────────write── CHILD
            pipe 2 (c2p)
```

**Limitations of ordinary pipes.**
1. One-way only.
2. Only between related processes (they must inherit the descriptors
   through `fork()`).
3. No name; cannot be opened by an unrelated program.
4. Byte stream, no message boundaries.
5. Limited capacity; exists only in memory, only on one machine.
6. Disappears when the last descriptor is closed.

---

## 5. `write()`, `read()` and `close()`

```c
ssize_t write(int fd, const void *buf, size_t count);
ssize_t read (int fd,       void *buf, size_t count);
int     close(int fd);
```

| Call | Returns | Notes |
|---|---|---|
| `write` | bytes written, or -1 | May write *fewer* than `count` → loop (`ipc_write_all`). Writes of ≤ `PIPE_BUF` (4096) bytes are atomic. |
| `read` | bytes read, **0 = EOF**, or -1 | May return *fewer* than `count` → loop (`ipc_read_all`). |
| `close` | 0 or -1 | Releases the descriptor. The pipe end is really closed only when *every* process has closed its copy. |

### The four rules you must know

| Situation | Result |
|---|---|
| Read, pipe empty, a write end still open | `read()` **blocks** |
| Read, pipe empty, **all write ends closed** | `read()` returns **0 (EOF)** |
| Write, pipe full, a read end still open | `write()` **blocks** |
| Write, **all read ends closed** | `SIGPIPE` signal; if ignored, `write()` returns -1 with `errno = EPIPE` |

### Why unused ends must be closed

After `fork()` each end of the pipe is open **twice** (once per process).
The reader gets EOF only when the write end is closed in **all** processes.
If the reading child keeps its own inherited write end open, the count of
writers never reaches zero, `read()` never returns 0, and the child waits
forever for data from *itself*. So immediately after `fork()`:

- the writer closes the read end,
- the reader closes the write end.

Additional reasons: descriptors are a limited resource, and a write to a
pipe whose reader has gone must fail with `EPIPE` instead of filling the
buffer and blocking.

**Common errors.** Ignoring return values; assuming one `read()` returns
one whole message; forgetting the `'\0'` terminator after `read()`; using
a descriptor after closing it (`EBADF`).

---

## 6. `wait()` / `waitpid()` and zombies

**Definition.** `wait()` blocks the parent until a child terminates and
returns the child's exit status. `waitpid(pid, &status, 0)` does the same
for one specific child.

**Why.** When a process exits, the kernel keeps a small record (PID, exit
status) until the parent collects it. A process in that state is a
**zombie** (`Z` / `<defunct>` in `ps`). `wait()` collects the record and
removes the zombie. It also *synchronizes*: the parent continues only
after the child is really finished.

```c
int status;
waitpid(pid, &status, 0);
if (WIFEXITED(status))   printf("exit code %d\n", WEXITSTATUS(status));
if (WIFSIGNALED(status)) printf("killed by signal %d\n", WTERMSIG(status));
```

An **orphan** is the opposite case: the parent dies first; the child is
adopted by `init`/`systemd`, which waits for it.

---

## 7. Message boundaries (framing)

Because a pipe is a byte stream, three quick `write()` calls of
`"one"`, `"two"`, `"three"` may arrive in a single `read()` as
`"onetwothree"`. To send *multiple messages* we need our own protocol.
This project puts a 4-byte length in front of each message:

```
 ┌────────────┬─────────────────────────┐
 │ length (4) │ text (length bytes)     │   one message
 └────────────┴─────────────────────────┘
```

The receiver reads exactly 4 bytes, learns the length, then reads exactly
that many bytes (`ipc_send_msg` / `ipc_recv_msg` in `ipc_utils.c`).
EOF *between* two messages is a normal end; EOF *inside* a message is an
error (`EBADMSG`).

---

## 8. Deadlock with pipes and how this project avoids it

A deadlock is two processes each waiting for the other, forever.

| Cause | Prevention used here |
|---|---|
| Both sides call `read()` first; nobody writes | Fixed protocol: parent sends a request, *then* reads; child reads, *then* replies |
| Reader waits for EOF but a write end is still open somewhere | Close unused ends right after `fork()` (`duplex_parent_setup`, `duplex_child_setup`) |
| Both sides write large data at once, both buffers fill, both block in `write()` | Only one side sends bulk data at a time; replies are small |
| Parent calls `wait()` before closing its write end; child waits for EOF, parent waits for child | Always close the write end *before* `waitpid()` |

---

## 9. Comparisons often asked in the viva

**Pipe vs FIFO (named pipe).**

| | Pipe | FIFO |
|---|---|---|
| Created by | `pipe()` | `mkfifo()` / `mkfifo` command |
| Name in file system | no | yes (a path) |
| Who can use it | related processes | any process with permission |
| Lifetime | until last fd is closed | file name stays until `unlink()` |
| Behaviour of data | identical: one-way byte stream in the kernel |

**Pipe vs shared memory.**

| | Pipe | Shared memory |
|---|---|---|
| Data transfer | copied user→kernel→user | no copy, both map the same pages |
| Speed | slower | fastest IPC |
| Synchronization | built in (blocking read/write) | none — programmer must add semaphores/mutexes |
| Access pattern | sequential stream, read once | random access, data stays |
| Ease of use | simple | harder, race conditions possible |
