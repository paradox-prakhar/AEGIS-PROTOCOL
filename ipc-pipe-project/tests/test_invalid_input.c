/* Test 7: invalid input is rejected with the documented errno. */
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
    char small[4];
    char too_long[IPC_MAX_MSG + 2];
    char longest[IPC_MAX_MSG + 1];
    uint32_t len;
    int fd;

    TEST_BEGIN("invalid_input");

    memset(too_long, 'a', IPC_MAX_MSG + 1);
    too_long[IPC_MAX_MSG + 1] = '\0';
    memset(longest, 'a', IPC_MAX_MSG);
    longest[IPC_MAX_MSG] = '\0';

    /* Validation of message text. */
    CHECK(ipc_validate_text("ok") == 0);
    CHECK(ipc_validate_text(longest) == 0);
    errno = 0;
    CHECK(ipc_validate_text(NULL) == -1 && errno == EINVAL);
    errno = 0;
    CHECK(ipc_validate_text("") == -1 && errno == EINVAL);
    errno = 0;
    CHECK(ipc_validate_text(too_long) == -1 && errno == EMSGSIZE);

    /* Invalid messages are rejected AND nothing is written to the pipe. */
    CHECK(pipe_create(fds) == 0);
    errno = 0;
    CHECK(ipc_send_msg(fds[PIPE_WRITE], NULL) == -1 && errno == EINVAL);
    errno = 0;
    CHECK(ipc_send_msg(fds[PIPE_WRITE], "") == -1 && errno == EINVAL);
    errno = 0;
    CHECK(ipc_send_msg(fds[PIPE_WRITE], too_long) == -1 &&
          errno == EMSGSIZE);
    CHECK(fcntl(fds[PIPE_READ], F_SETFL, O_NONBLOCK) == 0);
    errno = 0;
    CHECK(read(fds[PIPE_READ], buf, sizeof(buf)) == -1 && errno == EAGAIN);
    pipe_close_both(fds);

    /* Invalid receive buffer. */
    CHECK(pipe_create(fds) == 0);
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_READ], NULL, 10) == -1 && errno == EINVAL);
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, 0) == -1 && errno == EINVAL);

    /* Buffer too small: error, the message is skipped, and the NEXT
     * message can still be read correctly (stream stays in sync). */
    CHECK(ipc_send_msg(fds[PIPE_WRITE], "too big for four bytes") == 0);
    CHECK(ipc_send_msg(fds[PIPE_WRITE], "next") == 0);
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_READ], small, sizeof(small)) == -1);
    CHECK(errno == EMSGSIZE);
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == 1);
    CHECK(strcmp(buf, "next") == 0);
    pipe_close_both(fds);

    /* Corrupt length headers (too large, zero) are rejected. */
    CHECK(pipe_create(fds) == 0);
    len = IPC_MAX_MSG + 1;
    CHECK(write(fds[PIPE_WRITE], &len, sizeof(len)) == sizeof(len));
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == -1);
    CHECK(errno == EBADMSG);
    len = 0;
    CHECK(write(fds[PIPE_WRITE], &len, sizeof(len)) == sizeof(len));
    errno = 0;
    CHECK(ipc_recv_msg(fds[PIPE_READ], buf, sizeof(buf)) == -1);
    CHECK(errno == EBADMSG);
    pipe_close_both(fds);

    /* NULL arguments to the setup functions. */
    errno = 0;
    CHECK(pipe_create(NULL) == -1 && errno == EINVAL);
    errno = 0;
    CHECK(duplex_create(NULL) == -1 && errno == EINVAL);

    /* ipc_close on -1 / NULL is a harmless no-op. */
    fd = -1;
    CHECK(ipc_close(&fd) == 0);
    CHECK(ipc_close(NULL) == 0);

    /* ipc_str_upper: letters change, everything else is untouched. */
    strcpy(buf, "abc XYZ 123 -_!");
    ipc_str_upper(buf);
    CHECK(strcmp(buf, "ABC XYZ 123 -_!") == 0);
    ipc_str_upper(NULL); /* must not crash */

    TEST_END();
}
