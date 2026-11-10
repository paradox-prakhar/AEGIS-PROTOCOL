/* Test 6: empty pipes, closed pipes and end-of-file. */
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <stdint.h>
#include <string.h>

#include "ipc_utils.h"
#include "pipe_setup.h"
#include "test_common.h"

int main(void)
{
    int fds[2];
    char buf[IPC_MAX_MSG + 1];
    uint32_t len;

    TEST_BEGIN("eof_closed_pipe");

    /* 1. Empty pipe, writer closed: read() returns 0 (EOF) at once. */
    CHECK(pipe_create(fds) == 0);
    ipc_close(&fds[PIPE_WRITE]);
    CHECK(read(fds[PIPE_READ], buf, sizeof(buf)) == 0);
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 0);
    ipc_close(&fds[PIPE_READ]);

    /* 2. Data written before the writer closed is still delivered; EOF
     *    comes only after the buffer has been emptied. */
    CHECK(pipe_create(fds) == 0);
    CHECK(ipc_send_msg(fds[PIPE_WRITE], "left in the buffer") == 0);
    ipc_close(&fds[PIPE_WRITE]);
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 1);
    CHECK(strcmp(buf, "left in the buffer") == 0);
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 0);
    ipc_close(&fds[PIPE_READ]);

    /* 3. Empty pipe, writer still OPEN: a normal read() would block. In
     *    non-blocking mode the kernel reports that as EAGAIN, which shows
     *    "empty" and "EOF" are two different situations. */
    CHECK(pipe_create(fds) == 0);
    CHECK(fcntl(fds[PIPE_READ], F_SETFL, O_NONBLOCK) == 0);
    errno = 0;
    CHECK(read(fds[PIPE_READ], buf, sizeof(buf)) == -1 && errno == EAGAIN);
    pipe_close_both(fds);

    /* 4. All read ends closed: write() fails with EPIPE. */
    CHECK(pipe_create(fds) == 0);
    ipc_close(&fds[PIPE_READ]);
    errno = 0;
    CHECK(ipc_send_msg(fds[PIPE_WRITE], "nobody listens") == -1);
    CHECK(errno == EPIPE);
    ipc_close(&fds[PIPE_WRITE]);

    /* 5. Writer disappears in the middle of a message (header promises
     *    10 bytes, only 3 arrive): reported as an error, not as EOF. */
    CHECK(pipe_create(fds) == 0);
    len = 10;
    CHECK(write(fds[PIPE_WRITE], &len, sizeof(len)) == sizeof(len));
    CHECK(write(fds[PIPE_WRITE], "abc", 3) == 3);
    ipc_close(&fds[PIPE_WRITE]);
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == -1);
    CHECK(errno == EBADMSG);
    ipc_close(&fds[PIPE_READ]);

    /* 6. Same, but the writer dies inside the 4-byte header. */
    CHECK(pipe_create(fds) == 0);
    CHECK(write(fds[PIPE_WRITE], "ab", 2) == 2);
    ipc_close(&fds[PIPE_WRITE]);
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == -1);
    CHECK(errno == EBADMSG);
    ipc_close(&fds[PIPE_READ]);

    /* 7. ipc_read_all reports a short count at EOF. */
    CHECK(pipe_create(fds) == 0);
    CHECK(ipc_write_all(fds[PIPE_WRITE], "12345", 5) == 0);
    ipc_close(&fds[PIPE_WRITE]);
    CHECK(ipc_read_all(fds[PIPE_READ], buf, 100) == 5);
    CHECK(ipc_read_all(fds[PIPE_READ], buf, 100) == 0);
    ipc_close(&fds[PIPE_READ]);

    TEST_END();
}
