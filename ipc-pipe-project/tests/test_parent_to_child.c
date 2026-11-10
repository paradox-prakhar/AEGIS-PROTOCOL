/* Test 2: parent -> child communication over one pipe. */
#define _POSIX_C_SOURCE 200809L

#include <string.h>

#include "child_process.h"
#include "ipc_utils.h"
#include "parent_process.h"
#include "pipe_setup.h"
#include "test_common.h"

static const char *const msgs[] = { "alpha", "beta with spaces", "gamma!" };

int main(void)
{
    int fds[2];
    pid_t pid;
    int code = -1;

    TEST_BEGIN("parent_to_child");

    /* Part A: the child checks the exact content of what it receives and
     * reports the result through its exit status. */
    CHECK(pipe_create(fds) == 0);
    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0) {
        char buf[IPC_MAX_MSG + 1];
        int i, ok = 1;

        ipc_close(&fds[PIPE_WRITE]);
        for (i = 0; i < 3; i++) {
            if (ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) != 1 ||
                strcmp(buf, msgs[i]) != 0)
                ok = 0;
        }
        /* After the three messages the next read must report EOF. */
        if (ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) != 0)
            ok = 0;
        _exit(ok ? 0 : 1);
    }
    ipc_close(&fds[PIPE_READ]);
    CHECK(parent_send_messages(fds[PIPE_WRITE], msgs, 3) == 3);
    ipc_close(&fds[PIPE_WRITE]);
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    /* Part B: the child module's own receive loop counts the messages. */
    CHECK(pipe_create(fds) == 0);
    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0) {
        ipc_close(&fds[PIPE_WRITE]);
        _exit(child_receive_messages(fds[PIPE_READ]) == 3 ? 0 : 1);
    }
    ipc_close(&fds[PIPE_READ]);
    CHECK(parent_send_messages(fds[PIPE_WRITE], msgs, 3) == 3);
    ipc_close(&fds[PIPE_WRITE]);
    code = -1;
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    TEST_END();
}
