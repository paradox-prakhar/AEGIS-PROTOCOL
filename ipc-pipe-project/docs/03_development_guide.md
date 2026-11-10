# Step-by-Step Development Guide (Phases 1–10)

Work through this in order as a team. Lines in a `bash` block are typed in
the **Ubuntu/WSL terminal**. C code goes **inside files** — the complete
files are in `src/` and `tests/`; open each one and read its comments when
the guide reaches it.

After every command, **look at the output** before going on. The expected
result is stated each time.

---

## Phase 1 — Understand the project

Read [`01_concepts.md`](01_concepts.md). Do not continue until everyone
can answer, without notes:

1. Why can't parent and child share a variable after `fork()`?
2. Which array index is the read end of a pipe?
3. When does `read()` on a pipe return 0?
4. Why are two pipes needed for two-way communication?

**Checkpoint:** nothing to commit yet.

---

## Phase 2 — Project setup

Install the tools and check them:

```bash
sudo apt update
```

```bash
sudo apt install -y build-essential git
```

```bash
gcc --version
```

Expected: a line starting with `gcc (Ubuntu ...`. If you see
`command not found`, the install step failed — read its output.

> WSL users: work inside the Linux home directory (`cd ~`), not under
> `/mnt/c/...`. Files there can have wrong permissions and slow builds.

Get the project folder. If you are working in this repository:

```bash
cd ipc-pipe-project
```

To build it as its **own** GitHub repository instead, create an empty
repository on github.com (no README), then:

```bash
mkdir -p ~/ipc-pipe-project/{src,tests,results,screenshots,docs}
```

```bash
cd ~/ipc-pipe-project
```

```bash
git init -b main
```

```bash
git remote add origin https://github.com/<your-user>/ipc-pipe-project.git
```

Create `.gitignore` (so executables are never committed) with the content
of [`../.gitignore`](../.gitignore), and a short first `README.md`. Check
what Git sees:

```bash
git status
```

Expected: `.gitignore` and `README.md` listed as untracked.

```bash
git add .gitignore README.md
```

```bash
git commit -m "Phase 2: project structure, .gitignore and initial README"
```

```bash
git push -u origin main
```

**Verify** on github.com that both files are visible.

---

## Phase 3 — Implement the modules (bottom-up)

Build the lowest layer first so each new module can be compiled as soon as
it is written. `-c` means "compile only, do not link" — it lets you check
one module before the others exist.

### 3.1 `ipc_utils` — helper functions

Create `src/ipc_utils.h` and `src/ipc_utils.c`. Points to understand:

- `ipc_write_all` / `ipc_read_all`: loops, because `write()`/`read()` may
  transfer fewer bytes than asked, and may be interrupted (`EINTR`).
- `ipc_send_msg` / `ipc_recv_msg`: the length-header protocol.
- `ipc_close(int *fd)`: closes and sets the variable to `-1`, so a double
  close is impossible.
- `ipc_wait_child`: `waitpid()` plus decoding of the status.

```bash
gcc -Wall -Wextra -std=c11 -c src/ipc_utils.c -o /tmp/ipc_utils.o
```

Expected: **no output at all**. Any `warning:` must be fixed now.

### 3.2 `pipe_setup` — creating and wiring pipes

Create `src/pipe_setup.h` and `src/pipe_setup.c`. Note `enum { PIPE_READ
= 0, PIPE_WRITE = 1 }` and the `duplex_t` struct holding the two pipes.

```bash
gcc -Wall -Wextra -std=c11 -c src/pipe_setup.c -o /tmp/pipe_setup.o
```

### 3.3 `parent_process` and `child_process`

Create the four files. Each function receives descriptors and performs
one side of a conversation.

```bash
gcc -Wall -Wextra -std=c11 -c src/parent_process.c -o /tmp/parent.o
```

```bash
gcc -Wall -Wextra -std=c11 -c src/child_process.c -o /tmp/child.o
```

### 3.4 `scenarios` and `main` — integration

Create `src/scenarios.h`, `src/scenarios.c` and `src/main.c`. Study the
pattern every scenario follows: **pipe → fflush → fork → close unused
ends → work → close → wait**.

Now compile and link everything:

```bash
gcc -Wall -Wextra -std=c11 src/*.c -o ipc_pipe
```

Expected: no output, and a new file:

```bash
ls -l ipc_pipe
```

Or simply use the Makefile:

```bash
make
```

**Commit and push** (`git add src Makefile`, then commit
`"Phase 3: implement modules"`, then `git push`). Check `git status`
first: `ipc_pipe` and `build/` must **not** be listed.

---

## Phase 4 — Parent → child

```bash
./ipc_pipe 1
```

Verify in the output:
- the pipe's descriptor numbers are 3 and 4,
- the text after `received message 1:` is identical to the text after
  `sent message 1:`,
- the two lines show **different PIDs** — two processes really exist,
- the child reports EOF, and the parent reports exit status 0.

**Commit and push.**

---

## Phase 5 — Child → parent and bidirectional

```bash
./ipc_pipe 2
```

The child's messages contain its PID and its parent's PID; compare them
with the PIDs in the square brackets.

```bash
./ipc_pipe 3
```

Verify four descriptors (3, 4, 5, 6) and that the reply is the upper-case
form of the request, marked `(verified)`.

**Commit and push.**

---

## Phase 6 — Advanced functionality

```bash
./ipc_pipe 4
```

```bash
./ipc_pipe 4 "my own message" "another one"
```

```bash
./ipc_pipe 5
```

Both checksums must be equal.

```bash
./ipc_pipe 6
```

Watch the one-second pause: the child prints `waiting for data` and
then nothing — it is blocked in `read()` until the parent writes.

```bash
./ipc_pipe 7
```

```bash
./ipc_pipe 8
```

Type a few lines, an empty line, then `exit`.

Input validation — each of these must print an error and exit with
status 1 (check with `echo $?` straight after):

```bash
./ipc_pipe 99
```

```bash
./ipc_pipe 4 ""
```

**Commit and push.**

---

## Phase 7 — Testing

Read `tests/test_common.h` first, then each `tests/test_*.c`. Every test
is a separate program linked with the modules but *without* `main.c`.

```bash
make test
```

Expected last line: `RESULT: all 9 test programs passed`.

To convince yourself the tests are real, temporarily break something
(e.g. change `toupper` to `tolower` in `ipc_utils.c`), run `make test`,
see the `FAIL` lines with file and line number, then undo the change.

**Commit and push.**

---

## Phase 8 — Integration and verification

Clean build with all warnings:

```bash
make clean
```

```bash
make
```

Expected: only `gcc ...` command lines, no `warning:`.

Check for leftover or zombie processes after a run:

```bash
./ipc_pipe all
```

```bash
ps -eo pid,stat,comm | grep ipc_pipe
```

Expected: **no output** (nothing running, nothing in state `Z`).

Optional, if you want to check for memory and descriptor leaks:

```bash
sudo apt install -y valgrind
```

```bash
valgrind --leak-check=full --track-fds=yes ./ipc_pipe all
```

Save the logs:

```bash
make results
```

```bash
cat results/test_log.txt
```

**Commit and push** the `results/` folder.

---

## Phase 9 — Documentation and evidence

- Complete `README.md`.
- Take the screenshots listed in
  [`../screenshots/README.md`](../screenshots/README.md) from **your own**
  terminal and put them in `screenshots/`.
- Re-read `02_architecture.md` and make sure every team member can explain
  their module.

**Commit and push.**

---

## Phase 10 — Final evaluation

Use [`05_demo_and_submission.md`](05_demo_and_submission.md) for the live
demonstration script and checklist, and practise with
[`04_viva_questions.md`](04_viva_questions.md).

---

## If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `implicit declaration of function 'pipe'` | missing `#include <unistd.h>` or `_POSIX_C_SOURCE` | add them at the top of the `.c` file |
| `undefined reference to 'pipe_create'` | a `.c` file was left out when linking | compile with `src/*.c` or use `make` |
| `Makefile:NN: *** missing separator` | spaces instead of a TAB before a command | replace the leading spaces with one TAB |
| Program hangs | an unused write end was not closed, so EOF never arrives | check the `close` calls after `fork()`; press Ctrl+C |
| Every line printed twice | stdio buffer copied by `fork()` | `fflush(NULL)` before `fork()` |
| `Permission denied` running `./tests/run_tests.sh` | script not executable | `chmod +x tests/*.sh` |
| `git push` rejected | remote has commits you do not have | `git pull --rebase origin main`, then push |
