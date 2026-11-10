# Inter-Process Communication Using the `pipe()` System Call in C

Operating Systems laboratory project. A parent process and a child process
exchange data through anonymous pipes, using only Linux system calls:
`pipe()`, `fork()`, `read()`, `write()`, `close()` and `waitpid()`.

| | |
|---|---|
| Course | Operating Systems — *fill in course code* |
| Team | *fill in names and roll numbers* |
| Language / platform | C11, GCC, Ubuntu or WSL |

## What the project demonstrates

| Demo | Topic | Pipes |
|---|---|---|
| 1 | Parent → child, one message | 1 |
| 2 | Child → parent, three messages | 1 |
| 3 | Bidirectional request and reply | 2 |
| 4 | Multiple messages in both directions (built-in or your own) | 2 |
| 5 | 1 MiB data transfer verified by checksum (pipe buffer is 64 KiB) | 2 |
| 6 | Blocking `read()`, end-of-file, `waitpid()` synchronization | 1 |
| 7 | Broken pipe: writing when no reader exists (`EPIPE`) | 1 |
| 8 | Interactive chat with input validation | 2 |

An ordinary pipe is **unidirectional**: one read end, one write end.
Full-duplex parent–child communication therefore uses **two pipes**, one
per direction.

```
            pipe 1 (parent → child)
 PARENT ──write──────────────read──► CHILD
 PARENT ◄──read──────────────write── CHILD
            pipe 2 (child → parent)
```

## Build and run

```bash
sudo apt install -y build-essential
```

```bash
make
```

```bash
./ipc_pipe
```

`./ipc_pipe` with no arguments shows a menu. Other ways to run it:

```bash
./ipc_pipe 3
```

```bash
./ipc_pipe all
```

```bash
./ipc_pipe 4 "first message" "second message"
```

Without `make`, a single command builds the program:

```bash
gcc -Wall -Wextra -std=c11 src/*.c -o ipc_pipe
```

## Example output

Real output of `./ipc_pipe 3` (the numbers in brackets are process IDs;
yours will differ):

```
===== Demo 3: Bidirectional: request and reply (two pipes) =====
[PARENT 359] pipe 1 (parent->child): read fd 3, write fd 4
[PARENT 359] pipe 2 (child->parent): read fd 5, write fd 6
[PARENT 359] sent request 1: "hello from the parent process"
[CHILD  362] received request: "hello from the parent process"
[CHILD  362] sent reply:       "HELLO FROM THE PARENT PROCESS"
[PARENT 359] got reply   1: "HELLO FROM THE PARENT PROCESS" (verified)
[CHILD  362] EOF on request pipe, served 1 request(s)
[PARENT 359] child 362 finished with exit status 0 (no zombie)
===== Demo 3 completed successfully =====
```

Complete logs of every demo are in [`results/`](results/).

## Project structure

```
ipc-pipe-project/
├── src/
│   ├── main.c              entry point: menu, argument validation, dispatch
│   ├── scenarios.c/.h      one function per demo: pipe → fork → wire → wait
│   ├── pipe_setup.c/.h     create pipes, close the unused ends
│   ├── parent_process.c/.h the parent's side of each conversation
│   ├── child_process.c/.h  the child's side of each conversation
│   └── ipc_utils.c/.h      read/write loops, message framing, logging, wait
├── tests/                  8 unit-test programs + integration script
├── results/                logs of real runs (make results)
├── screenshots/            your terminal screenshots go here
├── docs/                   concepts, architecture, guide, viva, demo script
├── Makefile
└── README.md
```

### Role of each module

| Module | Responsibility |
|---|---|
| `ipc_utils` | Works on any file descriptor: complete reads/writes, the length-header message protocol, validation, safe `close`, `waitpid` wrapper, logging. Knows nothing about parent or child. |
| `pipe_setup` | Calls `pipe()`. Models a two-way channel (`duplex_t`) and closes the ends a process does not need. |
| `parent_process` | What the parent does with its descriptors: send, receive, request/reply dialogue, bulk send, chat. |
| `child_process` | What the child does with its descriptors: receive, send a report, upper-case reply service, bulk receive. |
| `scenarios` | Orchestration. Creates pipes, forks, calls the parent and child functions, closes everything, waits for the child. |
| `main` | Integrates the modules: reads and validates the user's choice and calls the scenario. |

The parent and child functions take descriptors as parameters instead of
creating pipes themselves, so each module can be tested on its own.

## How it works

Every scenario follows the same sequence:

1. `pipe()` — create the pipe(s) **before** `fork()` so both processes
   inherit the descriptors.
2. `fork()` — create the child.
3. Each process **closes the ends it does not use**.
4. The processes communicate with `write()` and `read()`.
5. The writer closes its write end; the reader's `read()` returns 0 (EOF).
6. The parent calls `waitpid()`, which collects the child's exit status
   and prevents a zombie.

Because a pipe is a byte stream without message boundaries, each message
is sent as a 4-byte length followed by the text. That is what makes
multiple messages reliable.

Details: [`docs/02_architecture.md`](docs/02_architecture.md).

## Testing

```bash
make test
```

| Test program | What it verifies |
|---|---|
| `test_pipe_setup` | `pipe()` gives two working descriptors; direction is fixed; correct ends are closed for parent and child |
| `test_parent_to_child` | Child receives exactly what the parent sent, in order, then EOF |
| `test_child_to_parent` | Parent receives the child's messages including the correct PIDs |
| `test_bidirectional` | Request on pipe 1, reply on pipe 2; a wrong reply is detected |
| `test_multiple_messages` | 200 back-to-back messages keep their boundaries; 300 kB transfer arrives complete |
| `test_eof_closed_pipe` | EOF, empty-but-open pipe (`EAGAIN`), `EPIPE`, truncated messages |
| `test_invalid_input` | NULL, empty and over-long messages, bad buffers, corrupt headers |
| `test_syscall_errors` | Real kernel failures: `EMFILE` from `pipe()`, `EBADF`, `ECHILD`, child exit status and death by signal |
| `test_integration.sh` | Runs the real executable: every demo, the menu, invalid arguments, no hangs, no leftover or zombie processes |

Result of the last recorded run ([`results/test_log.txt`](results/test_log.txt)):
all 9 test programs passed — 166 unit checks and 32 integration checks.
The build log ([`results/build_log.txt`](results/build_log.txt)) contains
no warnings under `-Wall -Wextra -pedantic`.

Regenerate the logs on your own machine with:

```bash
make results
```

## Documentation

| File | Content |
|---|---|
| [`docs/01_concepts.md`](docs/01_concepts.md) | IPC, `fork`, file descriptors, pipes, EOF, zombies, deadlock, comparisons |
| [`docs/02_architecture.md`](docs/02_architecture.md) | Modules, headers/compiling/linking, algorithms, error handling |
| [`docs/03_development_guide.md`](docs/03_development_guide.md) | Phase-by-phase build guide with commands and troubleshooting |
| [`docs/04_viva_questions.md`](docs/04_viva_questions.md) | 50 viva questions with answers |
| [`docs/05_demo_and_submission.md`](docs/05_demo_and_submission.md) | Live demo script, professor explanation, submission checklist |

## Limitations

- Anonymous pipes work only between related processes (parent and child).
- Text messages of at most 1024 bytes.
- One child at a time; blocking I/O only.
- The length header uses the machine's byte order, so the protocol is for
  one machine only.

## Future enhancements

- Named pipes (FIFOs) for unrelated processes.
- Several children handled with `poll()`.
- `dup2()` and `exec()` to build shell-style pipelines.
- Non-blocking pipes; a speed comparison with shared memory.
