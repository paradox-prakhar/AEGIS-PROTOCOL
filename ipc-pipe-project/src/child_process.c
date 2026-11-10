/*
 * child_process.c - Implementation of the child's side of the IPC.
 */
#define _POSIX_C_SOURCE 200809L

#include "child_process.h"

#include <errno.h>
#include <stdio.h>
#include <unistd.h>

#include "ipc_utils.h"

#define ROLE "CHILD"

int child_receive_messages(int rfd)
{
    char buf[IPC_MAX_MSG + 1];
    int count = 0;
    int rc;

    ipc_log(ROLE, "waiting for data (read() blocks while the pipe is empty)");

    while ((rc = ipc_recv_msg(rfd, buf, sizeof(buf))) == 1) {
        count++;
        ipc_log(ROLE, "received message %d: \"%s\"", count, buf);
    }
    if (rc < 0) {
        ipc_perror(ROLE, "receiving message");
        return -1;
    }
    ipc_log(ROLE, "read() returned 0 -> EOF, parent closed its write end");
    return count;
}

int child_send_report(int wfd)
{
    char msgs[3][64];
    int i;

    /* getpid() = my own process ID, getppid() = my parent's process ID. */
    snprintf(msgs[0], sizeof(msgs[0]), "Hello parent, I am child PID %ld",
             (long)getpid());
    snprintf(msgs[1], sizeof(msgs[1]), "My parent is PID %ld",
             (long)getppid());
    snprintf(msgs[2], sizeof(msgs[2]), "Child work finished");

    for (i = 0; i < 3; i++) {
        if (ipc_send_msg(wfd, msgs[i]) < 0) {
            ipc_perror(ROLE, "sending message");
            return -1;
        }
        ipc_log(ROLE, "sent message %d: \"%s\"", i + 1, msgs[i]);
    }
    return 3;
}

int child_run_service(int rfd, int wfd)
{
    char buf[IPC_MAX_MSG + 1];
    int served = 0;
    int rc;

    /* Loop: request in on pipe 1, reply out on pipe 2. The loop ends when
     * the parent closes its write end and ipc_recv_msg() reports EOF. */
    while ((rc = ipc_recv_msg(rfd, buf, sizeof(buf))) == 1) {
        ipc_log(ROLE, "received request: \"%s\"", buf);
        ipc_str_upper(buf);
        if (ipc_send_msg(wfd, buf) < 0) {
            ipc_perror(ROLE, "sending reply");
            return -1;
        }
        ipc_log(ROLE, "sent reply:       \"%s\"", buf);
        served++;
    }
    if (rc < 0) {
        ipc_perror(ROLE, "receiving request");
        return -1;
    }
    ipc_log(ROLE, "EOF on request pipe, served %d request(s)", served);
    return served;
}

int child_receive_bulk(int rfd, size_t *total, uint32_t *checksum)
{
    unsigned char chunk[4096];
    size_t received = 0;
    uint32_t sum = 0;

    for (;;) {
        /* Plain read(): takes whatever is currently in the pipe, up to
         * 4096 bytes. The chunk sizes need not match the writer's. */
        ssize_t n = read(rfd, chunk, sizeof(chunk));
        ssize_t i;

        if (n < 0) {
            if (errno == EINTR)
                continue;
            ipc_perror(ROLE, "reading bulk data");
            return -1;
        }
        if (n == 0)
            break;              /* EOF marks the end of the transfer */
        for (i = 0; i < n; i++)
            sum += chunk[i];
        received += (size_t)n;
    }
    if (total != NULL)
        *total = received;
    if (checksum != NULL)
        *checksum = sum;
    ipc_log(ROLE, "read  %zu bytes, checksum %lu", received,
            (unsigned long)sum);
    return 0;
}
