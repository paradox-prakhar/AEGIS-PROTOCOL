# Architecture, Modules and Algorithms

## 1. Module overview

```
                         ┌───────────┐
                         │  main.c   │  reads the user's choice, validates it
                         └─────┬─────┘
                               │ calls
                         ┌─────▼─────┐
                         │ scenarios │  pipe → fork → close ends → wait
                         └─┬───┬───┬─┘
              ┌────────────┘   │   └────────────┐
       ┌──────▼───────┐ ┌──────▼──────┐ ┌───────▼───────┐
       │ pipe_setup   │ │ parent_     │ │ child_        │
       │ create/close │ │ process     │ │ process       │
       └──────┬───────┘ └──────┬──────┘ └───────┬───────┘
              └────────────────┼────────────────┘
                         ┌─────▼─────┐
                         │ ipc_utils │  read/write loops, messages, logging
                         └───────────┘
```

Dependencies only point downwards. `parent_process` and `child_process` do
not know about each other, and neither knows how pipes are created.

| Module | Files | Single responsibility | Main functions |
|---|---|---|---|
| Utilities | `ipc_utils.c/.h` | Reliable I/O on a descriptor, message framing, validation, logging, safe close, wait | `ipc_write_all`, `ipc_read_all`, `ipc_send_msg`, `ipc_recv_msg`, `ipc_validate_text`, `ipc_close`, `ipc_wait_child`, `ipc_log` |
| Pipe setup | `pipe_setup.c/.h` | Create pipes; close the ends a process does not use | `pipe_create`, `pipe_close_both`, `duplex_create`, `duplex_parent_setup`, `duplex_child_setup`, `duplex_close_all` |
| Parent | `parent_process.c/.h` | What the parent does with its descriptors | `parent_send_messages`, `parent_receive_messages`, `parent_run_dialogue`, `parent_send_bulk`, `parent_chat` |
| Child | `child_process.c/.h` | What the child does with its descriptors | `child_receive_messages`, `child_send_report`, `child_run_service`, `child_receive_bulk` |
| Scenarios | `scenarios.c/.h` | Orchestrate one demonstration: pipe, fork, wiring, wait | `scenario_parent_to_child` … `scenario_chat` |
| Entry point | `main.c` | Command line / menu, input validation, dispatch | `main`, `run_demo`, `run_menu` |

**Why the role functions take descriptors as parameters.** They do not
fork or create pipes themselves, so a test can hand them any descriptor
and check the result. That is what makes each module independently
testable (see `tests/`).

## 2. Headers, declarations, definitions, compiling and linking

- A **declaration** tells the compiler that a function exists and what its
  types are: `int pipe_create(int fds[2]);` — it lives in the **header**
  (`.h`).
- A **definition** is the function body — it lives in the **source file**
  (`.c`).
- `#include "pipe_setup.h"` pastes the declarations into the file that
  wants to *call* the function, so the compiler can type-check the call.
- **Include guards** (`#ifndef PIPE_SETUP_H … #endif`) stop a header from
  being pasted twice into the same file.
- `static` functions (e.g. `safe_fork` in `scenarios.c`) are private to
  their `.c` file; they are deliberately *not* in the header.

Building happens in two stages:

```
 main.c ──────────► main.o ──────────┐
 pipe_setup.c ────► pipe_setup.o ────┤
 parent_process.c ► parent_process.o ┤  LINK   ┌──────────┐
 child_process.c ─► child_process.o ─┼────────►│ ipc_pipe │
 scenarios.c ─────► scenarios.o ─────┤         └──────────┘
 ipc_utils.c ─────► ipc_utils.o ─────┘
        COMPILE (gcc -c)
```

1. **Compile**: each `.c` is translated on its own into an object file.
   In `main.o` the call to `scenario_bidirectional` is only an unresolved
   symbol.
2. **Link**: the linker joins all object files and fills in the address of
   every function. A declared-but-never-defined function gives
   `undefined reference` here, not in stage 1.

```bash
# both stages in one command
gcc -Wall -Wextra -std=c11 src/*.c -o ipc_pipe

# or separately (this is what the Makefile does)
gcc -Wall -Wextra -std=c11 -c src/ipc_utils.c -o build/ipc_utils.o
gcc build/*.o -o ipc_pipe
```

`#define _POSIX_C_SOURCE 200809L` at the top of each `.c` file is required
because `-std=c11` hides everything that is not ISO C; `pipe`, `fork`,
`read`, `write` are POSIX, not ISO C.

## 3. Algorithms

### 3.1 One-way communication (demos 1, 2, 6)

```
PARENT                                     CHILD
pipe(fds)
fork() ───────────────────────────────────► (starts with copies of fds)
close(fds[READ])                           close(fds[WRITE])
write messages                             loop: read message
close(fds[WRITE])  ── causes EOF ────────► read returns 0 → leave loop
waitpid(child)  ◄──────────────────────── close(fds[READ]); _exit(0)
```

Demo 2 is the mirror image: the child writes, the parent reads.

### 3.2 Two-way communication (demos 3, 4, 8)

```
PARENT                                     CHILD
pipe(p2c); pipe(c2p)
fork()
close(p2c[READ]); close(c2p[WRITE])        close(p2c[WRITE]); close(c2p[READ])
for each message:                          loop:
   write request  → p2c ─────────────────►   read request from p2c
   read reply     ← c2p ◄─────────────────   upper-case it, write to c2p
   verify reply
close(p2c[WRITE]) ── EOF ────────────────► read returns 0 → leave loop
close(c2p[READ])                           close both; _exit(0)
waitpid(child)
```

The strict "request, then reply" order means the two processes are never
both reading or both writing a full pipe: no deadlock.

### 3.3 Message framing

```
send(text):                         receive(buf):
  validate text (not empty, ≤1024)    n = read exactly 4 bytes
  frame = [length][text]              n == 0        → return EOF
  write the frame in ONE write()      n < 4         → error EBADMSG
                                      length invalid→ error EBADMSG
                                      read exactly 'length' bytes
                                      fewer arrived → error EBADMSG
                                      append '\0'   → return message
```

### 3.4 Bulk transfer (demo 5)

The parent writes 1 MiB in 4096-byte chunks while the child reads
concurrently. The pipe holds only 64 KiB, so the parent's `write()` blocks
again and again until the child drains data — flow control by the kernel.
Closing the write end marks the end of the data. The child returns the
byte count and checksum on the second pipe and the parent compares them.

### 3.5 Broken pipe (demo 7)

The child closes its read end and exits. The parent (which closed its own
read end too) waits for the child, then writes. No read end exists, so the
kernel raises `SIGPIPE`; `main()` ignores that signal, therefore `write()`
returns -1 with `errno == EPIPE`, which the program reports.

## 4. Error-handling policy

- Every system call's return value is checked.
- Library-style functions return `-1` and leave the reason in `errno`;
  they do not print or exit. The caller decides what to do.
- Role functions print the error with `ipc_perror()` and return `-1`.
- Scenarios always close every descriptor and always wait for the child,
  including on error paths, so no descriptor or zombie leaks.
- The child ends with `_exit()`, not `exit()`, so it does not flush stdio
  buffers or run cleanup handlers that belong to the parent.
- The child's exit status (0 = success) tells the parent whether the
  child's half of the scenario worked.

## 5. Limitations

- Works only between a parent and its child (anonymous pipes).
- Messages are text of at most 1024 bytes; no binary message API.
- The length header uses the machine's native byte order — fine on one
  machine, not a network protocol.
- One child at a time; no `select()`/`poll()` multiplexing.
- Blocking I/O only.

## 6. Possible future enhancements

- Named pipes (FIFOs) so unrelated programs can communicate.
- Several children with `poll()` in the parent.
- `dup2()` + `exec()` to build a shell-style pipeline (`ls | wc -l`).
- Non-blocking pipes with `O_NONBLOCK`.
- A comparison benchmark against shared memory or message queues.
