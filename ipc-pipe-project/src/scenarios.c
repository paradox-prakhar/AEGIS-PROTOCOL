/*
 * scenarios.c - Implementation of the demonstration scenarios.
 *
 * All scenarios follow the same safe pattern:
 *   1. create the pipe(s)            BEFORE fork, so both processes get them
 *   2. fflush(NULL) then fork()
 *   3. child : close unused ends -> do its work -> close -> _exit()
 *   4. parent: close unused ends -> do its work -> close -> wait for child
 */
#define _POSIX_C_SOURCE 200809L

#include "scenarios.h"

#include <errno.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>

#include "child_process.h"
#include "ipc_utils.h"
#include "parent_process.h"
#include "pipe_setup.h"

#define BULK_BYTES ((size_t)1024 * 1024) /* 1 MiB, 16x the pipe buffer */

/* fork() with the two things that must always surround it.
 * fflush(NULL) empties all stdio buffers first; otherwise text still in
 * the parent's buffer would be copied into the child and printed twice. */
static pid_t safe_fork(void)
{
    pid_t pid;

    fflush(NULL);
    pid = fork();
    if (pid < 0)
        ipc_perror("PARENT", "fork");
    return pid;
}

/* Wait for the child and report how it ended.
 * Returns 0 only if the child exited normally with status 0. */
static int reap_child(pid_t pid)
{
    int code;

    if (ipc_wait_child(pid, &code) < 0) {
        ipc_perror("PARENT", "waitpid");
        return -1;
    }
    ipc_log("PARENT", "child %ld finished with exit status %d (no zombie)",
            (long)pid, code);
    return code == 0 ? 0 : -1;
}

/* ------------------------------------------------------------------ */
/* 1. Unidirectional: parent -> child                                  */
/* ------------------------------------------------------------------ */
int scenario_parent_to_child(void)
{
    static const char *const msgs[] = { "Hello child, this is your parent" };
    int fds[2];
    pid_t pid;
    int ok;

    if (pipe_create(fds) < 0) {
        ipc_perror("PARENT", "pipe");
        return -1;
    }
    ipc_log("PARENT", "pipe created: read end = fd %d, write end = fd %d",
            fds[PIPE_READ], fds[PIPE_WRITE]);

    pid = safe_fork();
    if (pid < 0) {
        pipe_close_both(fds);
        return -1;
    }

    if (pid == 0) {
        /* CHILD: reader. It must close the write end it inherited,
         * otherwise it would never see EOF (it would wait for itself). */
        int rc;

        ipc_close(&fds[PIPE_WRITE]);
        rc = child_receive_messages(fds[PIPE_READ]);
        ipc_close(&fds[PIPE_READ]);
        _exit(rc == 1 ? 0 : 1);
    }

    /* PARENT: writer. The read end is not needed here. */
    ipc_close(&fds[PIPE_READ]);
    ok = parent_send_messages(fds[PIPE_WRITE], msgs, 1) == 1;
    ipc_close(&fds[PIPE_WRITE]);    /* this close gives the child its EOF */

    if (reap_child(pid) < 0)
        ok = 0;
    return ok ? 0 : -1;
}

/* ------------------------------------------------------------------ */
/* 2. Unidirectional: child -> parent                                  */
/* ------------------------------------------------------------------ */
int scenario_child_to_parent(void)
{
    int fds[2];
    pid_t pid;
    int ok;

    if (pipe_create(fds) < 0) {
        ipc_perror("PARENT", "pipe");
        return -1;
    }

    pid = safe_fork();
    if (pid < 0) {
        pipe_close_both(fds);
        return -1;
    }

    if (pid == 0) {
        /* CHILD: this time the child is the writer. */
        int rc;

        ipc_close(&fds[PIPE_READ]);
        rc = child_send_report(fds[PIPE_WRITE]);
        ipc_close(&fds[PIPE_WRITE]);
        _exit(rc == 3 ? 0 : 1);
    }

    /* PARENT: reader. Closing its own write end is essential: while any
     * write end is open, read() will block instead of returning EOF. */
    ipc_close(&fds[PIPE_WRITE]);
    ok = parent_receive_messages(fds[PIPE_READ]) == 3;
    ipc_close(&fds[PIPE_READ]);

    if (reap_child(pid) < 0)
        ok = 0;
    return ok ? 0 : -1;
}

/* ------------------------------------------------------------------ */
/* 3 + 4. Bidirectional communication with two pipes                   */
/* ------------------------------------------------------------------ */
static int run_dialogue(const char *const msgs[], size_t count)
{
    duplex_t ch;
    pid_t pid;
    int ok;

    if (duplex_create(&ch) < 0) {
        ipc_perror("PARENT", "pipe");
        return -1;
    }
    ipc_log("PARENT", "pipe 1 (parent->child): read fd %d, write fd %d",
            ch.p2c[PIPE_READ], ch.p2c[PIPE_WRITE]);
    ipc_log("PARENT", "pipe 2 (child->parent): read fd %d, write fd %d",
            ch.c2p[PIPE_READ], ch.c2p[PIPE_WRITE]);

    pid = safe_fork();
    if (pid < 0) {
        duplex_close_all(&ch);
        return -1;
    }

    if (pid == 0) {
        int rc;

        duplex_child_setup(&ch);    /* keep p2c[READ] and c2p[WRITE] */
        rc = child_run_service(ch.p2c[PIPE_READ], ch.c2p[PIPE_WRITE]);
        duplex_close_all(&ch);
        _exit(rc == (int)count ? 0 : 1);
    }

    duplex_parent_setup(&ch);       /* keep p2c[WRITE] and c2p[READ] */
    ok = parent_run_dialogue(ch.p2c[PIPE_WRITE], ch.c2p[PIPE_READ], msgs,
                             count) == (int)count;
    /* Closing the request pipe tells the child "no more requests". */
    duplex_close_all(&ch);

    if (reap_child(pid) < 0)
        ok = 0;
    return ok ? 0 : -1;
}

int scenario_bidirectional(void)
{
    static const char *const msgs[] = { "hello from the parent process" };

    return run_dialogue(msgs, 1);
}

int scenario_multiple_messages(const char *const msgs[], size_t count)
{
    static const char *const defaults[] = {
        "operating systems",
        "inter-process communication",
        "pipes are unidirectional",
        "two pipes give two-way communication",
        "last message",
    };

    if (msgs == NULL || count == 0)
        return run_dialogue(defaults, sizeof(defaults) / sizeof(defaults[0]));
    return run_dialogue(msgs, count);
}

/* ------------------------------------------------------------------ */
/* 5. Bulk transfer: a byte stream much larger than the pipe buffer    */
/* ------------------------------------------------------------------ */
int scenario_bulk_transfer(void)
{
    duplex_t ch;
    pid_t pid;
    uint32_t sum = 0;
    char expected[64];
    char result[IPC_MAX_MSG + 1];
    int ok;

    if (duplex_create(&ch) < 0) {
        ipc_perror("PARENT", "pipe");
        return -1;
    }

    pid = safe_fork();
    if (pid < 0) {
        duplex_close_all(&ch);
        return -1;
    }

    if (pid == 0) {
        size_t total = 0;
        uint32_t csum = 0;
        char text[64];
        int rc;

        duplex_child_setup(&ch);
        rc = child_receive_bulk(ch.p2c[PIPE_READ], &total, &csum);
        if (rc == 0) {
            /* Report what was received back through the second pipe. */
            snprintf(text, sizeof(text), "bytes=%zu checksum=%lu", total,
                     (unsigned long)csum);
            rc = ipc_send_msg(ch.c2p[PIPE_WRITE], text);
        }
        duplex_close_all(&ch);
        _exit(rc == 0 ? 0 : 1);
    }

    duplex_parent_setup(&ch);
    ipc_log("PARENT", "sending %zu bytes through a 64 KiB pipe buffer",
            BULK_BYTES);
    ok = parent_send_bulk(ch.p2c[PIPE_WRITE], BULK_BYTES, &sum) == 0;
    ipc_close(&ch.p2c[PIPE_WRITE]); /* EOF = "transfer complete" */

    if (ok) {
        snprintf(expected, sizeof(expected), "bytes=%zu checksum=%lu",
                 BULK_BYTES, (unsigned long)sum);
        ok = ipc_recv_msg(ch.c2p[PIPE_READ], result, sizeof(result)) == 1;
        if (ok) {
            ok = strcmp(result, expected) == 0;
            ipc_log("PARENT", "child reports \"%s\" -> %s", result,
                    ok ? "matches, transfer verified" : "MISMATCH");
        } else {
            ipc_log("PARENT", "no result received from child");
        }
    }
    duplex_close_all(&ch);

    if (reap_child(pid) < 0)
        ok = 0;
    return ok ? 0 : -1;
}

/* ------------------------------------------------------------------ */
/* 6. Blocking read, end-of-file and wait()                            */
/* ------------------------------------------------------------------ */
int scenario_eof_and_sync(void)
{
    static const char *const msgs[] = { "first", "second", "third" };
    int fds[2];
    pid_t pid;
    int ok;

    if (pipe_create(fds) < 0) {
        ipc_perror("PARENT", "pipe");
        return -1;
    }

    pid = safe_fork();
    if (pid < 0) {
        pipe_close_both(fds);
        return -1;
    }

    if (pid == 0) {
        int rc;

        ipc_close(&fds[PIPE_WRITE]);
        rc = child_receive_messages(fds[PIPE_READ]);
        ipc_close(&fds[PIPE_READ]);
        _exit(rc == 3 ? 0 : 1);
    }

    ipc_close(&fds[PIPE_READ]);
    ipc_log("PARENT", "sleeping 1 second; the child is blocked in read()");
    sleep(1);
    ok = parent_send_messages(fds[PIPE_WRITE], msgs, 3) == 3;

    ipc_log("PARENT", "closing the write end -> child will see EOF");
    ipc_close(&fds[PIPE_WRITE]);

    ipc_log("PARENT", "calling waitpid(); blocks until the child exits");
    if (reap_child(pid) < 0)
        ok = 0;
    return ok ? 0 : -1;
}

/* ------------------------------------------------------------------ */
/* 7. Writing to a pipe that has no reader                             */
/* ------------------------------------------------------------------ */
int scenario_broken_pipe(void)
{
    int fds[2];
    pid_t pid;
    int ok = 0;

    if (pipe_create(fds) < 0) {
        ipc_perror("PARENT", "pipe");
        return -1;
    }

    pid = safe_fork();
    if (pid < 0) {
        pipe_close_both(fds);
        return -1;
    }

    if (pid == 0) {
        /* CHILD: closes everything and leaves without reading. */
        ipc_close(&fds[PIPE_WRITE]);
        ipc_close(&fds[PIPE_READ]);
        ipc_log("CHILD", "closed the read end without reading, exiting");
        _exit(0);
    }

    ipc_close(&fds[PIPE_READ]);
    /* Wait first, so we know for certain that no read end exists. */
    if (reap_child(pid) < 0) {
        ipc_close(&fds[PIPE_WRITE]);
        return -1;
    }

    ipc_log("PARENT", "writing although every read end is closed...");
    /* main() ignores SIGPIPE, so write() fails with EPIPE instead of the
     * kernel silently killing this process. */
    if (ipc_send_msg(fds[PIPE_WRITE], "is anybody there?") < 0) {
        if (errno == EPIPE) {
            ipc_log("PARENT", "write() failed with EPIPE (%s) as expected",
                    strerror(errno));
            ok = 1;
        } else {
            ipc_perror("PARENT", "write");
        }
    } else {
        ipc_log("PARENT", "unexpected: write succeeded");
    }
    ipc_close(&fds[PIPE_WRITE]);
    return ok ? 0 : -1;
}

/* ------------------------------------------------------------------ */
/* 8. Interactive chat                                                 */
/* ------------------------------------------------------------------ */
int scenario_chat(FILE *in)
{
    duplex_t ch;
    pid_t pid;
    int ok;

    if (duplex_create(&ch) < 0) {
        ipc_perror("PARENT", "pipe");
        return -1;
    }

    pid = safe_fork();
    if (pid < 0) {
        duplex_close_all(&ch);
        return -1;
    }

    if (pid == 0) {
        int rc;

        duplex_child_setup(&ch);
        rc = child_run_service(ch.p2c[PIPE_READ], ch.c2p[PIPE_WRITE]);
        duplex_close_all(&ch);
        _exit(rc >= 0 ? 0 : 1);
    }

    duplex_parent_setup(&ch);
    printf("Type a message and press Enter. The child replies in upper "
           "case.\nType 'exit' (or press Ctrl+D) to finish.\n");
    ok = parent_chat(ch.p2c[PIPE_WRITE], ch.c2p[PIPE_READ], in) >= 0;
    duplex_close_all(&ch);

    if (reap_child(pid) < 0)
        ok = 0;
    return ok ? 0 : -1;
}
