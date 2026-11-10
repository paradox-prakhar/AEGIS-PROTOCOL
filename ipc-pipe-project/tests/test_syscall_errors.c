/* Test 8: failures of real system calls are detected and reported. */
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <sys/resource.h>
#include <sys/wait.h>

#include "ipc_utils.h"
#include "pipe_setup.h"
#include "test_common.h"

/* Limit this process to descriptors 0 .. max_fds-1. */
static int set_fd_limit(rlim_t max_fds, struct rlimit *old)
{
    struct rlimit lim;

    if (getrlimit(RLIMIT_NOFILE, old) < 0)
        return -1;
    lim = *old;
    lim.rlim_cur = max_fds;
    return setrlimit(RLIMIT_NOFILE, &lim);
}

int main(void)
{
    int fds[2];
    duplex_t ch;
    struct rlimit old;
    char buf[IPC_MAX_MSG + 1];
    int fd;
    int next_fd;
    int code = 0;
    pid_t pid;

    TEST_BEGIN("syscall_errors");

    /* The lowest free descriptor number (normally 3). */
    next_fd = dup(0);
    CHECK(next_fd >= 0);
    close(next_fd);

    /* 1. pipe() itself fails: no free descriptor -> EMFILE.
     *    We make the kernel refuse by lowering the open-file limit. */
    CHECK(set_fd_limit((rlim_t)next_fd, &old) == 0);
    errno = 0;
    CHECK(pipe_create(fds) == -1);
    CHECK(errno == EMFILE);
    CHECK(fds[PIPE_READ] == -1 && fds[PIPE_WRITE] == -1);

    /* 2. duplex_create: room for the first pipe only. The second pipe()
     *    fails, and the first pipe must be closed again (no leak). */
    {
        struct rlimit lim = old;

        lim.rlim_cur = (rlim_t)next_fd + 2;
        CHECK(setrlimit(RLIMIT_NOFILE, &lim) == 0);
    }
    errno = 0;
    CHECK(duplex_create(&ch) == -1);
    CHECK(errno == EMFILE);
    CHECK(!fd_is_open(next_fd) && !fd_is_open(next_fd + 1));
    CHECK(ch.p2c[PIPE_READ] == -1 && ch.p2c[PIPE_WRITE] == -1);
    CHECK(setrlimit(RLIMIT_NOFILE, &old) == 0);

    /* 3. read()/write() on a descriptor that is not open -> EBADF. */
    errno = 0;
    CHECK(ipc_send_msg(-1, "hello") == -1 && errno == EBADF);
    errno = 0;
    CHECK(ipc_recv_msg(-1, buf, sizeof(buf)) == -1 && errno == EBADF);
    errno = 0;
    CHECK(ipc_write_all(-1, "x", 1) == -1 && errno == EBADF);
    errno = 0;
    CHECK(ipc_read_all(-1, buf, 1) == -1 && errno == EBADF);

    /* 4. Using a descriptor after it was closed -> EBADF. */
    CHECK(pipe_create(fds) == 0);
    fd = fds[PIPE_WRITE];
    pipe_close_both(fds);
    errno = 0;
    CHECK(ipc_send_msg(fd, "hello") == -1 && errno == EBADF);

    /* 5. Wrong direction: writing to the read end -> EBADF. */
    CHECK(pipe_create(fds) == 0);
    errno = 0;
    CHECK(ipc_send_msg(fds[PIPE_READ], "hello") == -1 && errno == EBADF);
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_WRITE], buf, sizeof(buf)) == -1 &&
          errno == EBADF);
    pipe_close_both(fds);

    /* 6. close() on an invalid descriptor fails; fd is still reset. */
    fd = 9999;
    errno = 0;
    CHECK(ipc_close(&fd) == -1 && errno == EBADF);
    CHECK(fd == -1);

    /* 7. waitpid() without any child -> ECHILD. */
    errno = 0;
    CHECK(ipc_wait_child(getpid(), &code) == -1 && errno == ECHILD);

    /* 8. Exit status and death-by-signal of a child are both reported. */
    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0)
        _exit(42);
    CHECK(ipc_wait_child(pid, &code) == 0 && code == 42);

    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0) {
        raise(SIGKILL);
        _exit(0);
    }
    CHECK(ipc_wait_child(pid, &code) == 0 && code == 128 + SIGKILL);

    /* After waiting, the child is gone: waiting again -> ECHILD. This is
     * the proof that no zombie is left behind. */
    errno = 0;
    CHECK(waitpid(pid, NULL, 0) == -1 && errno == ECHILD);

    TEST_END();
}
