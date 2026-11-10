/* Test 5: many messages and a large data transfer. */
#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>

#include "child_process.h"
#include "ipc_utils.h"
#include "parent_process.h"
#include "pipe_setup.h"
#include "test_common.h"

#define MANY 200
#define BULK ((size_t)300 * 1000) /* larger than the 64 KiB pipe buffer */

int main(void)
{
    int fds[2];
    duplex_t ch;
    pid_t pid;
    int code = -1;
    int i;
    char buf[IPC_MAX_MSG + 1];
    char longest[IPC_MAX_MSG + 1];

    TEST_BEGIN("multiple_messages");

    memset(longest, 'x', IPC_MAX_MSG);
    longest[IPC_MAX_MSG] = '\0';

    /* Part A: 200 messages of different lengths written back to back.
     * The reader must get them one at a time, in order, unmerged: this
     * proves the length header really preserves message boundaries. */
    CHECK(pipe_create(fds) == 0);
    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0) {
        char text[64];

        ipc_close(&fds[PIPE_READ]);
        for (i = 0; i < MANY; i++) {
            snprintf(text, sizeof(text), "message number %d %.*s", i, i % 20,
                     "....................");
            if (ipc_send_msg(fds[PIPE_WRITE], text) < 0)
                _exit(1);
        }
        /* Also the longest message that is allowed. */
        _exit(ipc_send_msg(fds[PIPE_WRITE], longest) == 0 ? 0 : 1);
    }
    ipc_close(&fds[PIPE_WRITE]);
    {
        int in_order = 1;
        char expected[64];

        for (i = 0; i < MANY; i++) {
            snprintf(expected, sizeof(expected), "message number %d %.*s", i,
                     i % 20, "....................");
            if (ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) != 1 ||
                strcmp(buf, expected) != 0)
                in_order = 0;
        }
        CHECK(in_order);
    }
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 1);
    CHECK(strcmp(buf, longest) == 0);
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 0);
    ipc_close(&fds[PIPE_READ]);
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    /* Part B: bulk transfer. The writer blocks whenever the pipe is full
     * and continues when the reader drains it; nothing may be lost. */
    CHECK(duplex_create(&ch) == 0);
    pid = fork();
    CHECK(pid >= 0);
    if (pid == 0) {
        size_t total = 0;
        uint32_t sum = 0;
        char text[64];

        duplex_child_setup(&ch);
        if (child_receive_bulk(ch.p2c[PIPE_READ], &total, &sum) < 0)
            _exit(1);
        snprintf(text, sizeof(text), "%zu %lu", total, (unsigned long)sum);
        _exit(ipc_send_msg(ch.c2p[PIPE_WRITE], text) == 0 ? 0 : 1);
    }
    duplex_parent_setup(&ch);
    {
        uint32_t sum = 0;
        char expected[64];

        CHECK(parent_send_bulk(ch.p2c[PIPE_WRITE], BULK, &sum) == 0);
        ipc_close(&ch.p2c[PIPE_WRITE]);
        snprintf(expected, sizeof(expected), "%zu %lu", BULK,
                 (unsigned long)sum);
        CHECK(ipc_recv_msg(ch.c2p[PIPE_READ], buf, sizeof(buf)) == 1);
        CHECK(strcmp(buf, expected) == 0);
    }
    duplex_close_all(&ch);
    code = -1;
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    TEST_END();
}
