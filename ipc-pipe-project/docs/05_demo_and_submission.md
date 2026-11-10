# Live Demonstration Script and Submission Checklist

## 1. Before the professor arrives

```bash
cd ipc-pipe-project
```

```bash
make clean
```

```bash
make
```

```bash
make test
```

Confirm the last line is `RESULT: all 9 test programs passed`. Increase
the terminal font size. Keep `src/scenarios.c` open in an editor.

## 2. Demonstration (about 8 minutes)

| # | Type this | Say this | Point at |
|---|---|---|---|
| 1 | `tree -I build` (or `ls -R src tests`) | "The project is modular: each `.c`/`.h` pair has one responsibility and `main.c` only integrates them." | the six modules |
| 2 | `make clean && make` | "Compiled with `-Wall -Wextra -pedantic` — zero warnings. Each file is compiled separately, then linked." | no `warning:` lines |
| 3 | `./ipc_pipe 1` | "`pipe()` returned descriptors 3 and 4 because 0, 1, 2 are stdin, stdout, stderr. After `fork()` the parent writes, the child reads." | different PIDs; identical sent/received text; EOF line |
| 4 | `./ipc_pipe 2` | "Same pipe mechanism, opposite direction. One pipe carries data one way only." | PIDs inside the messages match the brackets |
| 5 | `./ipc_pipe 3` | "For two-way communication we need two pipes — four descriptors. Request on pipe 1, reply on pipe 2." | fds 3–6; `(verified)` |
| 6 | `./ipc_pipe 4 "hello sir" "os lab"` | "Multiple messages. A pipe is a byte stream, so we send a 4-byte length before each message to keep boundaries." | custom text in upper case |
| 7 | `./ipc_pipe 5` | "1 MiB through a 64 KiB buffer: `write()` blocks when the pipe is full — the kernel does flow control." | equal checksums |
| 8 | `./ipc_pipe 6` | "The child blocks in `read()` for one second until data arrives. When the parent closes the write end, `read()` returns 0 — EOF. `waitpid()` then removes the zombie." | the pause; EOF line; exit status |
| 9 | `./ipc_pipe 7` | "Writing with no reader gives `SIGPIPE`; we ignore the signal so `write()` fails with `EPIPE`." | `EPIPE` line |
| 10 | `./ipc_pipe 8` | "Interactive: type anything." Let the professor type; also press Enter on an empty line. | validation message |
| 11 | `./ipc_pipe 99; echo $?` | "Invalid input is rejected with a non-zero exit status." | `1` |
| 12 | `make test` | "Eight unit-test programs and an integration test, including real system-call failures." | `RESULT` line |
| 13 | `ps -eo pid,stat,comm \| grep ipc_pipe` | "No process left running and no zombie." | empty output |

If asked "show me where unused ends are closed": open `src/scenarios.c`,
function `scenario_parent_to_child`, and `duplex_parent_setup` /
`duplex_child_setup` in `src/pipe_setup.c`.

## 3. Two-minute explanation for the professor

> Our project implements inter-process communication with the `pipe()`
> system call. A pipe is a kernel buffer with a read end and a write end.
> We create it before `fork()`, so parent and child both inherit the
> descriptors. Each process closes the end it does not use; this is what
> lets the reader detect end-of-file. Because a pipe is one-directional,
> we use two pipes for two-way communication. Since a pipe is a byte
> stream, we frame each message with a length header to send multiple
> messages reliably. Blocking `read`/`write` synchronizes the processes,
> and `waitpid` collects the child so no zombie remains. The code is
> split into modules — utilities, pipe setup, parent role, child role and
> scenarios — integrated by `main.c`. Every system call is checked, and
> the behaviour is covered by eight test programs plus an integration
> test.

## 4. Suggested division of work for the team

| Member | Owns | Must be able to explain |
|---|---|---|
| 1 | `ipc_utils` | read/write loops, framing, `waitpid` status |
| 2 | `pipe_setup`, `scenarios` | `pipe()`, `fork()`, closing ends, EOF, deadlock |
| 3 | `parent_process`, `child_process`, `main` | the dialogue protocol, input validation, linking |
| 4 | `tests/`, `results/`, docs | what each test proves, how failures were forced |

## 5. Submission checklist

**Code**
- [ ] `make clean && make` prints no warnings
- [ ] `make test` ends with `RESULT: all 9 test programs passed`
- [ ] `./ipc_pipe all` ends with `Summary: 7 of 7 demonstrations succeeded`
- [ ] `ps -eo pid,stat,comm | grep ipc_pipe` prints nothing afterwards

**Repository**
- [ ] `git status` shows a clean working tree
- [ ] no executable, `.o` file or `build/` folder is committed
- [ ] history shows a commit per phase with meaningful messages
- [ ] the repository on github.com shows the latest commit

**Evidence**
- [ ] `results/` regenerated on your machine with `make results`
- [ ] screenshots from your own terminal are in `screenshots/`
- [ ] team names, roll numbers and course details filled in the README

**Viva**
- [ ] every member can draw the two-pipe diagram from memory
- [ ] every member can state the four blocking/EOF/EPIPE rules
- [ ] every member can explain their own module line by line
