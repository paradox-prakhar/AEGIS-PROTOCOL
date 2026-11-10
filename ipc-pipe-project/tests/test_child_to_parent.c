/* Test 3: child -> parent communication over one pipe. */
#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>

#include "child_process.h"
#include "ipc_utils.h"
#include "parent_process.h"
#include "pipe_setup.h"
#include "test_common.h"

int main(void)
{
    int fds[2];
    pid_t pid;
    int code = -1;
    char buf[IPC_MAX_MSG + 1];
    char expected[64];

    TEST_BEGIN("child_to_parent");

    /* Part A: read the child's report message by message and compare it
     * with what the child must have written (its PID and our PID). */
    CHECK(pipe_create(fds) == 0);
    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0) {
        ipc_close(&fds[PIPE_READ]);
        _exit(child_send_report(fds[PIPE_WRITE]) == 3 ? 0 : 1);
    }
    ipc_close(&fds[PIPE_WRITE]);

    snprintf(expected, sizeof(expected), "Hello parent, I am child PID %ld",
             (long)pid);
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 1);
    CHECK(strcmp(buf, expected) == 0);

    snprintf(expected, sizeof(expected), "My parent is PID %ld",
             (long)getpid());
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 1);
    CHECK(strcmp(buf, expected) == 0);

    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 1);
    CHECK(strcmp(buf, "Child work finished") == 0);

    /* The child has exited, so its write end is closed: EOF. */
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 0);
    ipc_close(&fds[PIPE_READ]);
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    /* Part B: the parent module's receive loop counts three messages. */
    CHECK(pipe_create(fds) == 0);
    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0) {
        ipc_close(&fds[PIPE_READ]);
        _exit(child_send_report(fds[PIPE_WRITE]) == 3 ? 0 : 1);
    }
    ipc_close(&fds[PIPE_WRITE]);
    CHECK(parent_receive_messages(fds[PIPE_READ]) == 3);
    ipc_close(&fds[PIPE_READ]);
    code = -1;
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    TEST_END();
}
