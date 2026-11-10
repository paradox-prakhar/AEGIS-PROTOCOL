# Viva Questions and Answers

Short answers you can say aloud. Where useful, the file that proves the
answer is named so you can open it during the viva.

## A. IPC and processes

**1. What is IPC and why is it needed?**
Mechanisms provided by the OS for processes to exchange data. Needed
because each process has a private address space.

**2. Name the IPC mechanisms in Linux.**
Pipes, FIFOs, message queues, shared memory, semaphores, signals, sockets.

**3. What does `fork()` return?**
`0` in the child, the child's PID in the parent, `-1` on failure (no child
created).

**4. What does the child inherit?**
A copy of the parent's memory, and copies of all open file descriptors —
which refer to the *same* kernel objects, including the pipe.

**5. Difference between `fork()` and `exec()`?**
`fork()` makes a new process running the same program. `exec()` replaces
the program in the current process; no new process, same PID.

**6. What is copy-on-write?**
After `fork()` parent and child share physical pages read-only; a page is
copied only when one of them writes to it.

**7. Which process runs first after `fork()`?**
Not defined; the scheduler decides. Our program does not depend on the
order — blocking `read()` makes the result correct either way.

## B. Pipes

**8. What is a pipe?**
A unidirectional, FIFO-ordered byte stream held in a kernel buffer, with a
read end and a write end.

**9. What does `pipe(fds)` put in the array?**
`fds[0]` = read end, `fds[1]` = write end. (Memory aid: 0 = stdin = read,
1 = stdout = write.)

**10. Why is a pipe unidirectional?**
It is one buffer with one read end and one write end. If both processes
used it in both directions, a process could read its own data.

**11. How do you get two-way communication?**
Two pipes, one per direction (`duplex_t` in `pipe_setup.h`).

**12. Why must the pipe be created before `fork()`?**
The child can obtain the descriptors only by inheriting them.

**13. What is the capacity of a pipe?**
65,536 bytes by default on Linux. `PIPE_BUF` (4096) is something else:
the largest write that is guaranteed to be atomic.

**14. What happens on `read()` from an empty pipe?**
If a write end is open: it blocks. If all write ends are closed: returns 0
(EOF). (Demo 6; `tests/test_eof_closed_pipe.c`.)

**15. What happens on `write()` to a full pipe?**
It blocks until the reader removes data. (Demo 5 relies on this.)

**16. What happens when all write ends are closed?**
The reader first receives any data still in the buffer, then `read()`
returns 0.

**17. What happens when all read ends are closed and you write?**
The kernel sends `SIGPIPE`, which by default kills the writer. If the
signal is ignored, `write()` returns -1 and `errno` is `EPIPE`. (Demo 7.)

**18. Why must unused ends be closed?**
(a) EOF is delivered only when *every* copy of the write end is closed —
otherwise the reader hangs. (b) `EPIPE` is raised only when every copy of
the read end is closed. (c) Descriptors are a limited resource.

**19. Is data in a pipe stored on disk?**
No, only in kernel memory. It disappears when read, or when the pipe is
destroyed.

**20. Does a pipe preserve message boundaries?**
No. It is a byte stream. We add a 4-byte length header in front of each
message (`ipc_send_msg`, `ipc_recv_msg`).

**21. Why do you loop around `read()` and `write()`?**
Both may transfer fewer bytes than requested and may be interrupted by a
signal (`EINTR`). (`ipc_read_all`, `ipc_write_all`.)

**22. Can two unrelated processes use an anonymous pipe?**
No; use a FIFO (named pipe).

**23. Pipe vs FIFO?**
A FIFO has a name in the file system (`mkfifo`), can be opened by
unrelated processes and its name persists. The data behaviour is the same.

**24. Pipe vs shared memory?**
A pipe copies data through the kernel and synchronizes automatically.
Shared memory needs no copying (fastest) but the programmer must
synchronize with semaphores.

**25. Pipe vs message queue?**
A message queue keeps message boundaries and types and can be used by
unrelated processes; a pipe is a plain byte stream between relatives.

**26. How does the shell implement `ls | wc -l`?**
`pipe()`, two `fork()`s; the first child `dup2`s the write end onto fd 1
and `exec`s `ls`; the second `dup2`s the read end onto fd 0 and `exec`s
`wc`. The shell closes both ends and waits.

## C. File descriptors

**27. What is a file descriptor?**
A small integer index into the process's table of open files.

**28. What are 0, 1, 2?**
Standard input, standard output, standard error.

**29. Why did our pipe get 3 and 4?**
The kernel gives the lowest free number, and 0–2 are in use.

**30. Do parent and child share the file offset/pipe?**
Yes — the descriptor tables are separate copies, but the entries point to
the same open file description in the kernel.

## D. `wait()` and synchronization

**31. What is a zombie process?**
A terminated child whose exit status has not yet been collected by its
parent. Shown as `Z`/`<defunct>` in `ps`.

**32. How does `wait()` prevent zombies?**
It collects the exit status, after which the kernel removes the child's
process-table entry.

**33. What is an orphan process?**
A child whose parent has exited; it is adopted by `init`/`systemd`.

**34. `wait()` vs `waitpid()`?**
`wait()` waits for any child. `waitpid()` can wait for a specific PID and
accepts options such as `WNOHANG`.

**35. How do you read the exit status?**
`WIFEXITED(status)` / `WEXITSTATUS(status)`; `WIFSIGNALED` / `WTERMSIG`
for death by signal (`ipc_wait_child`).

**36. How are parent and child synchronized without semaphores?**
By blocking I/O: `read()` sleeps until data exists, `write()` sleeps while
the pipe is full, `waitpid()` sleeps until the child exits.

**37. How can a deadlock occur with two pipes, and how do you prevent it?**
(a) Both read first. (b) A leftover write end prevents EOF. (c) Both write
more than the buffer holds. (d) Parent waits before closing its write end.
Prevention: fixed request→reply order, close unused ends immediately,
close the write end before `waitpid()`.

## E. This project's code

**38. Why `_exit()` in the child instead of `exit()` or `return`?**
`exit()` flushes stdio buffers and runs `atexit` handlers inherited from
the parent, which could print output twice. `return` would let the child
continue running the parent's code (e.g. the menu loop).

**39. Why `fflush(NULL)` before `fork()`?**
Unflushed stdio data is in the process's memory, so `fork()` duplicates it
and both processes would print it.

**40. Why do you ignore `SIGPIPE`?**
So a write to a closed pipe is reported as an error (`EPIPE`) that the
program can handle, instead of silently killing the process.

**41. Why is `ipc_close()` given a pointer?**
So it can set the variable to `-1`. A second close of the same variable is
then a harmless no-op instead of possibly closing an unrelated, reused
descriptor.

**42. Why is the header written together with the text in one `write()`?**
A write of at most `PIPE_BUF` bytes is atomic, so a message can never be
interleaved with another writer's data.

**43. What is `_POSIX_C_SOURCE` for?**
With `-std=c11` the headers expose only ISO C. This macro additionally
enables POSIX declarations such as `pipe`, `fork`, `sigaction`.

**44. What is the role of each module?**
See the table in `02_architecture.md` §1.

**45. What is the difference between compiling and linking?**
Compiling turns one `.c` into one `.o`, using headers to check calls.
Linking joins the `.o` files and resolves function addresses.

**46. Why include guards?**
To prevent the same header being included twice in one translation unit,
which would redefine types such as `duplex_t`.

**47. How did you test system-call failures?**
By making the kernel really fail: lowering `RLIMIT_NOFILE` so `pipe()`
returns `EMFILE`, using closed descriptors for `EBADF`, closing read ends
for `EPIPE`, waiting with no child for `ECHILD`
(`tests/test_syscall_errors.c`).

**48. How do you know the program has no zombies or hangs?**
Every scenario calls `waitpid()`. The tests use `alarm()`/`timeout` to
catch hangs, and the integration test checks `ps` for leftover processes.

**49. What are the limitations of your project?**
Related processes only, text messages ≤ 1024 bytes, one child, blocking
I/O, same-machine byte order.

**50. How would you extend it?**
FIFOs for unrelated processes, several children with `poll()`, `dup2` +
`exec` pipelines, non-blocking mode.
