/* Test 1: basic pipe creation and wiring (pipe_setup module). */
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <string.h>

#include "ipc_utils.h"
#include "pipe_setup.h"
#include "test_common.h"

int main(void)
{
    int fds[2];
    duplex_t ch;
    char buf[8];

    TEST_BEGIN("pipe_setup");

    /* A new pipe has two different, open descriptors. */
    CHECK(pipe_create(fds) == 0);
    CHECK(fds[PIPE_READ] >= 0 && fds[PIPE_WRITE] >= 0);
    CHECK(fds[PIPE_READ] != fds[PIPE_WRITE]);
    CHECK(fd_is_open(fds[PIPE_READ]) && fd_is_open(fds[PIPE_WRITE]));

    /* Bytes written into the write end come out of the read end. */
    CHECK(write(fds[PIPE_WRITE], "abc", 3) == 3);
    CHECK(read(fds[PIPE_READ], buf, sizeof(buf)) == 3);
    CHECK(memcmp(buf, "abc", 3) == 0);

    /* The direction is fixed: the read end cannot be written to and the
     * write end cannot be read from. */
    errno = 0;
    CHECK(write(fds[PIPE_READ], "x", 1) == -1 && errno == EBADF);
    errno = 0;
    CHECK(read(fds[PIPE_WRITE], buf, 1) == -1 && errno == EBADF);

    /* pipe_close_both closes both ends and marks them as -1. */
    {
        int r = fds[PIPE_READ], w = fds[PIPE_WRITE];

        pipe_close_both(fds);
        CHECK(!fd_is_open(r) && !fd_is_open(w));
        CHECK(fds[PIPE_READ] == -1 && fds[PIPE_WRITE] == -1);
        pipe_close_both(fds); /* second call must be harmless */
    }

    /* A duplex channel has four distinct open descriptors. */
    CHECK(duplex_create(&ch) == 0);
    CHECK(fd_is_open(ch.p2c[PIPE_READ]) && fd_is_open(ch.p2c[PIPE_WRITE]));
    CHECK(fd_is_open(ch.c2p[PIPE_READ]) && fd_is_open(ch.c2p[PIPE_WRITE]));
    CHECK(ch.p2c[PIPE_READ] != ch.c2p[PIPE_READ]);

    /* The parent keeps only p2c[WRITE] and c2p[READ]. */
    duplex_parent_setup(&ch);
    CHECK(ch.p2c[PIPE_READ] == -1 && ch.c2p[PIPE_WRITE] == -1);
    CHECK(fd_is_open(ch.p2c[PIPE_WRITE]) && fd_is_open(ch.c2p[PIPE_READ]));
    duplex_close_all(&ch);
    CHECK(ch.p2c[PIPE_WRITE] == -1 && ch.c2p[PIPE_READ] == -1);

    /* The child keeps only p2c[READ] and c2p[WRITE]. */
    CHECK(duplex_create(&ch) == 0);
    duplex_child_setup(&ch);
    CHECK(ch.p2c[PIPE_WRITE] == -1 && ch.c2p[PIPE_READ] == -1);
    CHECK(fd_is_open(ch.p2c[PIPE_READ]) && fd_is_open(ch.c2p[PIPE_WRITE]));
    duplex_close_all(&ch);

    TEST_END();
}
