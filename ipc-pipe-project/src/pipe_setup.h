/*
 * pipe_setup.h - Creation and wiring of pipes.
 *
 * Responsibility: create pipes with pipe(), and close the ends that a
 * process does not use. One pipe is unidirectional, so full-duplex
 * (two-way) parent-child communication uses a pair of pipes, modelled
 * here as duplex_t.
 */
#ifndef PIPE_SETUP_H
#define PIPE_SETUP_H

/* pipe() fills an array of two descriptors: [0] is for reading and
 * [1] is for writing. These names make the code self-explaining. */
enum { PIPE_READ = 0, PIPE_WRITE = 1 };

/* Two pipes = one two-way channel between parent and child. */
typedef struct {
    int p2c[2]; /* parent writes  -> child reads  */
    int c2p[2]; /* child  writes  -> parent reads */
} duplex_t;

/* Create one pipe. Returns 0 on success, -1 on error (errno is set;
 * EINVAL if fds is NULL, otherwise whatever pipe() reported). */
int pipe_create(int fds[2]);

/* Close both ends of a pipe (ends that are already -1 are skipped). */
void pipe_close_both(int fds[2]);

/* Create both pipes of a duplex channel. If the second pipe() fails, the
 * first pipe is closed again so no descriptors leak. Returns 0 or -1. */
int duplex_create(duplex_t *d);

/* Call in the PARENT right after fork(): closes the two ends that only
 * the child uses (read end of p2c, write end of c2p). */
void duplex_parent_setup(duplex_t *d);

/* Call in the CHILD right after fork(): closes the two ends that only
 * the parent uses (write end of p2c, read end of c2p). */
void duplex_child_setup(duplex_t *d);

/* Close every descriptor of the channel that is still open. */
void duplex_close_all(duplex_t *d);

#endif /* PIPE_SETUP_H */
