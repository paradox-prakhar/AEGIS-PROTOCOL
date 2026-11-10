/*
 * test_common.h - Tiny test helper shared by all test programs.
 *
 * Every test file is an independent program:
 *     int main(void) { TEST_BEGIN("name"); CHECK(...); ...; TEST_END(); }
 * Exit status 0 = all checks passed, 1 = at least one check failed.
 */
#ifndef TEST_COMMON_H
#define TEST_COMMON_H

#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <unistd.h>

static int t_checks = 0;
static int t_failed = 0;
static const char *t_name = "";

/* Count one check; print file and line if the condition is false. */
#define CHECK(cond)                                                       \
    do {                                                                  \
        t_checks++;                                                       \
        if (!(cond)) {                                                    \
            t_failed++;                                                   \
            fprintf(stderr, "  FAIL %s:%d: %s\n", __FILE__, __LINE__,     \
                    #cond);                                               \
        }                                                                 \
    } while (0)

/* - alarm(15): if a test deadlocks, the kernel kills it after 15 seconds
 *   so a hang is reported as a failure instead of blocking forever.
 * - SIGPIPE ignored: writing to a closed pipe returns EPIPE.
 * - stdout -> /dev/null: hides the modules' log lines; test results are
 *   printed on stderr. */
#define TEST_BEGIN(name)                                                  \
    do {                                                                  \
        t_name = (name);                                                  \
        alarm(15);                                                        \
        signal(SIGPIPE, SIG_IGN);                                         \
        if (freopen("/dev/null", "w", stdout) == NULL)                    \
            return 2;                                                     \
    } while (0)

#define TEST_END()                                                        \
    do {                                                                  \
        fprintf(stderr, "%s %-24s (%d checks, %d failed)\n",              \
                t_failed == 0 ? "PASS" : "FAIL", t_name, t_checks,        \
                t_failed);                                                \
        return t_failed == 0 ? 0 : 1;                                     \
    } while (0)

/* 1 if 'fd' is an open file descriptor in this process, else 0. */
static inline int fd_is_open(int fd)
{
    return fcntl(fd, F_GETFD) != -1;
}

#endif /* TEST_COMMON_H */
