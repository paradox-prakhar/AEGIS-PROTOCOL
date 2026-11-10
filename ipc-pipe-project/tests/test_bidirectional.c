/* Test 4: bidirectional communication using two pipes. */
#define _POSIX_C_SOURCE 200809L

#include <string.h>

#include "child_process.h"
#include "ipc_utils.h"
#include "parent_process.h"
#include "pipe_setup.h"
#include "test_common.h"

/* Fork a child that runs the upper-case service on channel 'ch'. */
static pid_t start_service(duplex_t *ch, int expected_requests)
{
    pid_t pid = fork();

    if (pid == 0) {
        int served;

        duplex_child_setup(ch);
        served = child_run_service(ch->p2c[PIPE_READ], ch->c2p[PIPE_WRITE]);
        duplex_close_all(ch);
        _exit(served == expected_requests ? 0 : 1);
    }
    if (pid > 0)
        duplex_parent_setup(ch);
    return pid;
}

/* Fork a child that answers every request with a WRONG reply. */
static pid_t start_faulty_service(duplex_t *ch)
{
    pid_t pid = fork();

    if (pid == 0) {
        char buf[IPC_MAX_MSG + 1];

        duplex_child_setup(ch);
        while (ipc_recv_msg(ch->p2c[PIPE_READ], buf, sizeof(buf)) == 1)
            ipc_send_msg(ch->c2p[PIPE_WRITE], "wrong answer");
        _exit(0);
    }
    if (pid > 0)
        duplex_parent_setup(ch);
    return pid;
}

int main(void)
{
    static const char *const msgs[] = { "hello", "Mixed Case 123" };
    duplex_t ch;
    pid_t pid;
    int code = -1;
    char reply[IPC_MAX_MSG + 1];

    TEST_BEGIN("bidirectional");

    /* Part A: manual round trip - request on pipe 1, reply on pipe 2. */
    CHECK(duplex_create(&ch) == 0);
    pid = start_service(&ch, 1);
    CHECK(pid > 0);
    CHECK(ipc_send_msg(ch.p2c[PIPE_WRITE], "ping pong") == 0);
    CHECK(ipc_recv_msg(ch.c2p[PIPE_READ], reply, sizeof(reply)) == 1);
    CHECK(strcmp(reply, "PING PONG") == 0);
    /* Closing our write end ends the service; then its pipe gives EOF. */
    ipc_close(&ch.p2c[PIPE_WRITE]);
    CHECK(ipc_recv_msg(ch.c2p[PIPE_READ], reply, sizeof(reply)) == 0);
    duplex_close_all(&ch);
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    /* Part B: the parent module's dialogue against the child's service. */
    CHECK(duplex_create(&ch) == 0);
    pid = start_service(&ch, 2);
    CHECK(pid > 0);
    CHECK(parent_run_dialogue(ch.p2c[PIPE_WRITE], ch.c2p[PIPE_READ], msgs,
                              2) == 2);
    duplex_close_all(&ch);
    code = -1;
    CHECK(ipc_wait_child(pid, &code) == 0);
    CHECK(code == 0);

    /* Part C: the dialogue must DETECT a wrong reply, not just accept
     * whatever comes back. */
    CHECK(duplex_create(&ch) == 0);
    pid = start_faulty_service(&ch);
    CHECK(pid > 0);
    CHECK(parent_run_dialogue(ch.p2c[PIPE_WRITE], ch.c2p[PIPE_READ], msgs,
                              2) == -1);
    duplex_close_all(&ch);
    CHECK(ipc_wait_child(pid, &code) == 0);

    TEST_END();
}
