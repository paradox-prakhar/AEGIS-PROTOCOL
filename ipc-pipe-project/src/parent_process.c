/*
 * parent_process.c - Implementation of the parent's side of the IPC.
 */
#define _POSIX_C_SOURCE 200809L

#include "parent_process.h"

#include <errno.h>
#include <string.h>

#include "ipc_utils.h"

#define ROLE "PARENT"

int parent_send_messages(int wfd, const char *const msgs[], size_t count)
{
    size_t i;

    for (i = 0; i < count; i++) {
        if (ipc_send_msg(wfd, msgs[i]) < 0) {
            ipc_perror(ROLE, "sending message");
            return -1;
        }
        ipc_log(ROLE, "sent message %zu: \"%s\"", i + 1, msgs[i]);
    }
    return (int)count;
}

int parent_receive_messages(int rfd)
{
    char buf[IPC_MAX_MSG + 1];
    int count = 0;
    int rc;

    /* ipc_recv_msg() returns 1 per message and 0 once the child has
     * closed its write end (EOF) - that is how the loop knows to stop. */
    while ((rc = ipc_recv_msg(rfd, buf, sizeof(buf))) == 1) {
        count++;
        ipc_log(ROLE, "received message %d: \"%s\"", count, buf);
    }
    if (rc < 0) {
        ipc_perror(ROLE, "receiving message");
        return -1;
    }
    ipc_log(ROLE, "read() returned 0 -> EOF, child closed its write end");
    return count;
}

int parent_run_dialogue(int wfd, int rfd, const char *const msgs[],
                        size_t count)
{
    char reply[IPC_MAX_MSG + 1];
    char expected[IPC_MAX_MSG + 1];
    size_t i;

    for (i = 0; i < count; i++) {
        int rc;

        /* Request goes out on pipe 1 (parent -> child). */
        if (ipc_send_msg(wfd, msgs[i]) < 0) {
            ipc_perror(ROLE, "sending request");
            return -1;
        }
        ipc_log(ROLE, "sent request %zu: \"%s\"", i + 1, msgs[i]);

        /* Reply comes back on pipe 2 (child -> parent). The parent blocks
         * here until the child answers: that is the synchronization. */
        rc = ipc_recv_msg(rfd, reply, sizeof(reply));
        if (rc < 0) {
            ipc_perror(ROLE, "receiving reply");
            return -1;
        }
        if (rc == 0) {
            ipc_log(ROLE, "child closed the pipe before replying");
            return -1;
        }

        /* Verify the data really made the round trip correctly. */
        strcpy(expected, msgs[i]);
        ipc_str_upper(expected);
        if (strcmp(reply, expected) != 0) {
            ipc_log(ROLE, "reply %zu MISMATCH: got \"%s\"", i + 1, reply);
            return -1;
        }
        ipc_log(ROLE, "got reply   %zu: \"%s\" (verified)", i + 1, reply);
    }
    return (int)count;
}

int parent_send_bulk(int wfd, size_t total, uint32_t *checksum)
{
    unsigned char chunk[4096];
    size_t sent = 0;
    uint32_t sum = 0;

    while (sent < total) {
        size_t n = total - sent;
        size_t i;

        if (n > sizeof(chunk))
            n = sizeof(chunk);
        for (i = 0; i < n; i++) {
            chunk[i] = ipc_pattern_byte(sent + i);
            sum += chunk[i];
        }
        /* When the pipe buffer (64 KiB on Linux) is full, write() blocks
         * until the child has read some data: automatic flow control. */
        if (ipc_write_all(wfd, chunk, n) < 0) {
            ipc_perror(ROLE, "writing bulk data");
            return -1;
        }
        sent += n;
    }
    if (checksum != NULL)
        *checksum = sum;
    ipc_log(ROLE, "wrote %zu bytes, checksum %lu", sent, (unsigned long)sum);
    return 0;
}

/* Read one line from 'in' into line[]. Removes the '\n'.
 * Returns 1 = line read, 0 = end of input, -1 = line too long (the rest
 * of that line is skipped). */
static int read_line(FILE *in, char *line, size_t size)
{
    size_t len;

    if (fgets(line, (int)size, in) == NULL)
        return 0;
    len = strlen(line);
    if (len > 0 && line[len - 1] == '\n') {
        line[len - 1] = '\0';
        return 1;
    }
    if (feof(in))
        return 1;               /* last line without a trailing newline */

    /* No newline in the buffer: the line was longer than the buffer. */
    {
        int c;
        while ((c = fgetc(in)) != EOF && c != '\n')
            ;                   /* skip the remainder of the long line */
    }
    return -1;
}

int parent_chat(int wfd, int rfd, FILE *in)
{
    /* +2: one byte for '\n' and one for '\0'. */
    char line[IPC_MAX_MSG + 2];
    char reply[IPC_MAX_MSG + 1];
    int exchanged = 0;

    for (;;) {
        int rc;

        printf("message> ");
        fflush(stdout);

        rc = read_line(in, line, sizeof(line));
        if (rc == 0) {
            printf("\n");
            ipc_log(ROLE, "end of input");
            break;
        }
        if (rc < 0) {
            ipc_log(ROLE, "invalid input: longer than %d characters",
                    IPC_MAX_MSG);
            continue;
        }
        if (strcmp(line, "exit") == 0)
            break;
        if (ipc_validate_text(line) < 0) {
            ipc_log(ROLE, "invalid input: empty message, type some text");
            continue;
        }

        if (ipc_send_msg(wfd, line) < 0) {
            ipc_perror(ROLE, "sending chat message");
            return -1;
        }
        rc = ipc_recv_msg(rfd, reply, sizeof(reply));
        if (rc <= 0) {
            if (rc < 0)
                ipc_perror(ROLE, "receiving chat reply");
            else
                ipc_log(ROLE, "child closed the pipe unexpectedly");
            return -1;
        }
        ipc_log(ROLE, "child replied: \"%s\"", reply);
        exchanged++;
    }
    return exchanged;
}
