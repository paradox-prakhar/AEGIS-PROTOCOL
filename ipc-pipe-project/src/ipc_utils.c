/*
 * ipc_utils.c - Implementation of the shared IPC helper functions.
 */
#define _POSIX_C_SOURCE 200809L /* expose POSIX functions under -std=c11 */

#include "ipc_utils.h"

#include <ctype.h>
#include <errno.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

/* Size of the length header placed in front of every message. */
#define HEADER_SIZE sizeof(uint32_t)

int ipc_write_all(int fd, const void *buf, size_t count)
{
    const char *p = buf;
    size_t left = count;

    while (left > 0) {
        /* write() may accept fewer bytes than requested (for example when
         * the pipe is almost full), so we loop until everything is sent. */
        ssize_t n = write(fd, p, left);
        if (n < 0) {
            if (errno == EINTR)
                continue;       /* interrupted by a signal: just retry */
            return -1;          /* real error, errno tells the caller why */
        }
        p += n;
        left -= (size_t)n;
    }
    return 0;
}

ssize_t ipc_read_all(int fd, void *buf, size_t count)
{
    char *p = buf;
    size_t got = 0;

    while (got < count) {
        /* read() blocks while the pipe is empty and a writer still exists.
         * It may also return fewer bytes than requested. */
        ssize_t n = read(fd, p + got, count - got);
        if (n < 0) {
            if (errno == EINTR)
                continue;
            return -1;
        }
        if (n == 0)
            break;              /* EOF: all write ends are closed */
        got += (size_t)n;
    }
    return (ssize_t)got;
}

int ipc_validate_text(const char *text)
{
    if (text == NULL || text[0] == '\0') {
        errno = EINVAL;
        return -1;
    }
    /* strnlen never looks further than IPC_MAX_MSG + 1 bytes. */
    if (strnlen(text, IPC_MAX_MSG + 1) > IPC_MAX_MSG) {
        errno = EMSGSIZE;
        return -1;
    }
    return 0;
}

int ipc_send_msg(int fd, const char *text)
{
    char frame[HEADER_SIZE + IPC_MAX_MSG];
    uint32_t len;

    if (ipc_validate_text(text) < 0)
        return -1;

    /* A pipe is a plain byte stream with no message boundaries. We add
     * our own boundary: first the length, then exactly that many bytes.
     * Header and text go out in ONE write() so the message is atomic. */
    len = (uint32_t)strlen(text);
    memcpy(frame, &len, HEADER_SIZE);
    memcpy(frame + HEADER_SIZE, text, len);

    return ipc_write_all(fd, frame, HEADER_SIZE + len);
}

/* Read and throw away 'count' bytes (used to skip a message that does
 * not fit in the caller's buffer, keeping the stream in sync). */
static int discard_bytes(int fd, size_t count)
{
    char junk[256];

    while (count > 0) {
        size_t chunk = count < sizeof(junk) ? count : sizeof(junk);
        ssize_t n = ipc_read_all(fd, junk, chunk);
        if (n < 0)
            return -1;
        if ((size_t)n < chunk) {
            errno = EBADMSG;
            return -1;
        }
        count -= chunk;
    }
    return 0;
}

int ipc_recv_msg(int fd, char *buf, size_t bufsize)
{
    uint32_t len;
    ssize_t n;

    if (buf == NULL || bufsize == 0) {
        errno = EINVAL;
        return -1;
    }

    /* Step 1: read the 4-byte length header. */
    n = ipc_read_all(fd, &len, HEADER_SIZE);
    if (n < 0)
        return -1;
    if (n == 0)
        return 0;               /* clean EOF between two messages */
    if ((size_t)n < HEADER_SIZE || len == 0 || len > IPC_MAX_MSG) {
        errno = EBADMSG;        /* writer died mid-message or bad header */
        return -1;
    }

    /* Step 2: make sure the text plus '\0' fits in the caller's buffer. */
    if ((size_t)len + 1 > bufsize) {
        if (discard_bytes(fd, len) == 0)
            errno = EMSGSIZE;
        return -1;
    }

    /* Step 3: read exactly 'len' bytes of text. */
    n = ipc_read_all(fd, buf, len);
    if (n < 0)
        return -1;
    if ((size_t)n < len) {
        errno = EBADMSG;
        return -1;
    }
    buf[len] = '\0';
    return 1;
}

int ipc_close(int *fd)
{
    int rc;

    if (fd == NULL || *fd < 0)
        return 0;               /* already closed: nothing to do */
    rc = close(*fd);
    *fd = -1;                   /* mark as closed even if close() failed */
    return rc;
}

int ipc_wait_child(pid_t pid, int *exit_code)
{
    int status;

    /* waitpid() collects the exit status of the child. Until the parent
     * does this, a finished child stays in the process table as a zombie. */
    while (waitpid(pid, &status, 0) < 0) {
        if (errno != EINTR)
            return -1;
    }

    if (exit_code != NULL) {
        if (WIFEXITED(status))
            *exit_code = WEXITSTATUS(status);     /* normal exit */
        else if (WIFSIGNALED(status))
            *exit_code = 128 + WTERMSIG(status);  /* killed by a signal */
        else
            *exit_code = -1;
    }
    return 0;
}

void ipc_str_upper(char *s)
{
    if (s == NULL)
        return;
    for (; *s != '\0'; s++)
        *s = (char)toupper((unsigned char)*s);
}

unsigned char ipc_pattern_byte(size_t offset)
{
    return (unsigned char)(offset * 31u + 7u);
}

void ipc_log(const char *role, const char *fmt, ...)
{
    va_list ap;

    printf("[%-6s %ld] ", role, (long)getpid());
    va_start(ap, fmt);
    vprintf(fmt, ap);
    va_end(ap);
    printf("\n");
    fflush(stdout);
}

void ipc_perror(const char *role, const char *what)
{
    int saved = errno;          /* fflush below could change errno */

    fflush(stdout);
    fprintf(stderr, "[%-6s %ld] ERROR %s: %s\n", role, (long)getpid(), what,
            strerror(saved));
    errno = saved;
}
