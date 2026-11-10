/*
 * ipc_utils.h - Shared helper functions used by every other module.
 *
 * Responsibility: reliable byte I/O on file descriptors, the message
 * "framing" protocol (length header + text), input validation, logging,
 * safe close() and waiting for a child.
 *
 * This module knows nothing about parents, children or how pipes were
 * created. It only works on file descriptors that somebody hands to it.
 */
#ifndef IPC_UTILS_H
#define IPC_UTILS_H

#include <stddef.h>     /* size_t  */
#include <stdint.h>     /* uint32_t */
#include <sys/types.h>  /* ssize_t, pid_t */

/* Longest text message (without the terminating '\0') we accept.
 * header (4 bytes) + 1024 is far below PIPE_BUF (4096 on Linux), so every
 * message is written to the pipe atomically in one write() call. */
#define IPC_MAX_MSG 1024

/* ---- raw byte I/O ------------------------------------------------- */

/* Write exactly 'count' bytes. Retries on partial writes and EINTR.
 * Returns 0 on success, -1 on error (errno is set, e.g. EPIPE, EBADF). */
int ipc_write_all(int fd, const void *buf, size_t count);

/* Read up to 'count' bytes, retrying on partial reads and EINTR.
 * Returns the number of bytes read. A value smaller than 'count' means
 * end-of-file was reached. Returns -1 on error (errno is set). */
ssize_t ipc_read_all(int fd, void *buf, size_t count);

/* ---- message protocol --------------------------------------------- */

/* Check that 'text' may be sent as a message.
 * Returns 0 if valid. Returns -1 and sets errno to
 *   EINVAL   - text is NULL or empty
 *   EMSGSIZE - text is longer than IPC_MAX_MSG                         */
int ipc_validate_text(const char *text);

/* Send one text message: [4-byte length][text bytes].
 * Returns 0 on success, -1 on error (errno is set). */
int ipc_send_msg(int fd, const char *text);

/* Receive one text message into buf (always '\0'-terminated on success).
 * Returns  1 - a complete message was received
 *          0 - end-of-file: every write end is closed, no more messages
 *         -1 - error (errno is set):
 *                EBADMSG  - broken/truncated message or bad length header
 *                EMSGSIZE - buf is too small (the message is discarded)
 *                EINVAL   - buf is NULL or bufsize is 0                 */
int ipc_recv_msg(int fd, char *buf, size_t bufsize);

/* ---- small helpers ------------------------------------------------ */

/* Close *fd (if it is open) and set it to -1 so it cannot be closed or
 * used twice by mistake. Returns 0 on success, -1 on error. */
int ipc_close(int *fd);

/* Wait for child 'pid' to terminate (this is what prevents zombies).
 * *exit_code receives the child's exit status, or 128+signal number if
 * it was killed by a signal. Returns 0 on success, -1 on error. */
int ipc_wait_child(pid_t pid, int *exit_code);

/* Convert a string to upper case in place (the "work" done by the child
 * in the bidirectional demos). */
void ipc_str_upper(char *s);

/* Deterministic test data for bulk transfers: the byte at 'offset'. */
unsigned char ipc_pattern_byte(size_t offset);

/* printf-style log line prefixed with the role and PID, e.g.
 * "[PARENT 4242] message". Flushed immediately so that the output of
 * two processes does not get mixed up or duplicated after fork(). */
void ipc_log(const char *role, const char *fmt, ...)
#ifdef __GNUC__
    __attribute__((format(printf, 2, 3)))
#endif
    ;

/* Like perror(): prints "[ROLE pid] ERROR what: <reason>" to stderr. */
void ipc_perror(const char *role, const char *what);

#endif /* IPC_UTILS_H */
