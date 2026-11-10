/*
 * pipe_setup.c - Implementation of pipe creation and wiring.
 */
#define _POSIX_C_SOURCE 200809L

#include "pipe_setup.h"

#include <errno.h>
#include <unistd.h>

#include "ipc_utils.h"

int pipe_create(int fds[2])
{
    if (fds == NULL) {
        errno = EINVAL;
        return -1;
    }
    /* Mark both ends as "not open" first, so that after a failure the
     * caller can safely pass the array to pipe_close_both(). */
    fds[PIPE_READ] = -1;
    fds[PIPE_WRITE] = -1;

    /* pipe() asks the kernel for a buffer and returns two descriptors:
     * fds[0] to read from the buffer, fds[1] to write into it. */
    return pipe(fds);
}

void pipe_close_both(int fds[2])
{
    if (fds == NULL)
        return;
    ipc_close(&fds[PIPE_READ]);
    ipc_close(&fds[PIPE_WRITE]);
}

int duplex_create(duplex_t *d)
{
    if (d == NULL) {
        errno = EINVAL;
        return -1;
    }
    d->p2c[PIPE_READ] = d->p2c[PIPE_WRITE] = -1;
    d->c2p[PIPE_READ] = d->c2p[PIPE_WRITE] = -1;

    if (pipe_create(d->p2c) < 0)
        return -1;

    if (pipe_create(d->c2p) < 0) {
        int saved = errno;      /* keep the reason of the real failure */
        pipe_close_both(d->p2c);
        errno = saved;
        return -1;
    }
    return 0;
}

void duplex_parent_setup(duplex_t *d)
{
    /* The parent only WRITES to p2c and only READS from c2p. */
    ipc_close(&d->p2c[PIPE_READ]);
    ipc_close(&d->c2p[PIPE_WRITE]);
}

void duplex_child_setup(duplex_t *d)
{
    /* The child only READS from p2c and only WRITES to c2p. */
    ipc_close(&d->p2c[PIPE_WRITE]);
    ipc_close(&d->c2p[PIPE_READ]);
}

void duplex_close_all(duplex_t *d)
{
    if (d == NULL)
        return;
    pipe_close_both(d->p2c);
    pipe_close_both(d->c2p);
}
