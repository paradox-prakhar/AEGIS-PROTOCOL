/*
 * main.c - Entry point. Integrates the modules.
 *
 * main.c contains no pipe or process logic of its own. It only reads the
 * user's choice (command line or menu), validates it and calls the
 * matching scenario function.
 *
 * Usage:
 *   ./ipc_pipe                  interactive menu
 *   ./ipc_pipe <1-8>            run one demonstration
 *   ./ipc_pipe all              run demonstrations 1-7 one after another
 *   ./ipc_pipe 4 "msg" "msg"    demonstration 4 with your own messages
 */
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "ipc_utils.h"
#include "scenarios.h"

#define FIRST_DEMO 1
#define LAST_DEMO 8
#define LAST_AUTOMATIC_DEMO 7   /* demo 8 needs keyboard input */
#define MAX_CUSTOM_MSGS 32

static const char *const demo_titles[LAST_DEMO + 1] = {
    "",
    "Unidirectional: parent -> child (one pipe)",
    "Unidirectional: child -> parent (one pipe)",
    "Bidirectional: request and reply (two pipes)",
    "Multiple messages in both directions",
    "Bulk data transfer (1 MiB) with checksum",
    "Blocking read, EOF and wait() synchronization",
    "Broken pipe: writing when no reader exists (EPIPE)",
    "Interactive chat with the child process",
};

static void print_usage(const char *prog)
{
    int i;

    fprintf(stderr, "Usage: %s [demo-number | all] [messages...]\n\n", prog);
    for (i = FIRST_DEMO; i <= LAST_DEMO; i++)
        fprintf(stderr, "  %d  %s\n", i, demo_titles[i]);
    fprintf(stderr,
            "  all  run demonstrations %d-%d\n\n"
            "Without arguments an interactive menu is shown.\n"
            "Demo 4 accepts up to %d of your own messages, e.g.\n"
            "  %s 4 \"hello\" \"second message\"\n",
            FIRST_DEMO, LAST_AUTOMATIC_DEMO, MAX_CUSTOM_MSGS, prog);
}

/* Convert text to a demo number. Returns -1 if it is not a valid one.
 * strtol + end pointer check rejects input such as "3abc" or "". */
static int parse_demo_number(const char *text)
{
    char *end;
    long value;

    errno = 0;
    value = strtol(text, &end, 10);
    if (errno != 0 || end == text || *end != '\0')
        return -1;
    if (value < FIRST_DEMO || value > LAST_DEMO)
        return -1;
    return (int)value;
}

/* Run one demonstration. msgs/count are only used by demo 4. */
static int run_demo(int number, const char *const msgs[], size_t count)
{
    int rc;

    printf("\n===== Demo %d: %s =====\n", number, demo_titles[number]);
    fflush(stdout);

    switch (number) {
    case 1: rc = scenario_parent_to_child(); break;
    case 2: rc = scenario_child_to_parent(); break;
    case 3: rc = scenario_bidirectional(); break;
    case 4: rc = scenario_multiple_messages(msgs, count); break;
    case 5: rc = scenario_bulk_transfer(); break;
    case 6: rc = scenario_eof_and_sync(); break;
    case 7: rc = scenario_broken_pipe(); break;
    case 8: rc = scenario_chat(stdin); break;
    default: return -1;
    }

    printf("===== Demo %d %s =====\n", number,
           rc == 0 ? "completed successfully" : "FAILED");
    fflush(stdout);
    return rc;
}

static int run_all(void)
{
    int failures = 0;
    int i;

    for (i = FIRST_DEMO; i <= LAST_AUTOMATIC_DEMO; i++) {
        if (run_demo(i, NULL, 0) != 0)
            failures++;
    }
    printf("\nSummary: %d of %d demonstrations succeeded\n",
           LAST_AUTOMATIC_DEMO - failures, LAST_AUTOMATIC_DEMO);
    return failures == 0 ? 0 : -1;
}

static int run_menu(void)
{
    char line[64];
    int status = 0;

    for (;;) {
        int i;
        int choice;

        printf("\n--- IPC using pipe() : menu ---\n");
        for (i = FIRST_DEMO; i <= LAST_DEMO; i++)
            printf("  %d. %s\n", i, demo_titles[i]);
        printf("  9. Run demonstrations %d-%d\n  0. Exit\nChoice: ",
               FIRST_DEMO, LAST_AUTOMATIC_DEMO);
        fflush(stdout);

        if (fgets(line, sizeof(line), stdin) == NULL) {
            printf("\n");
            break;                      /* Ctrl+D / end of input */
        }
        if (strchr(line, '\n') == NULL) {
            int c;                      /* over-long line: discard rest */
            while ((c = getchar()) != EOF && c != '\n')
                ;
            printf("Invalid choice: input too long.\n");
            continue;
        }
        line[strcspn(line, "\n")] = '\0';

        if (strcmp(line, "0") == 0)
            break;
        if (strcmp(line, "9") == 0) {
            if (run_all() != 0)
                status = -1;
            continue;
        }
        choice = parse_demo_number(line);
        if (choice < 0) {
            printf("Invalid choice \"%s\": enter a number from 0 to 9.\n",
                   line);
            continue;
        }
        if (run_demo(choice, NULL, 0) != 0)
            status = -1;
    }
    return status;
}

int main(int argc, char *argv[])
{
    struct sigaction sa;
    int demo;
    int rc;

    /* By default, writing to a pipe without readers kills the process
     * with SIGPIPE. Ignoring the signal makes write() return -1 with
     * errno = EPIPE instead, which we can detect and report. */
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = SIG_IGN;
    sigemptyset(&sa.sa_mask);
    if (sigaction(SIGPIPE, &sa, NULL) < 0) {
        ipc_perror("MAIN", "sigaction");
        return EXIT_FAILURE;
    }

    if (argc == 1)
        return run_menu() == 0 ? EXIT_SUCCESS : EXIT_FAILURE;

    if (strcmp(argv[1], "-h") == 0 || strcmp(argv[1], "--help") == 0) {
        print_usage(argv[0]);
        return EXIT_SUCCESS;
    }

    if (strcmp(argv[1], "all") == 0) {
        if (argc > 2) {
            fprintf(stderr, "Error: 'all' takes no further arguments.\n");
            return EXIT_FAILURE;
        }
        return run_all() == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
    }

    demo = parse_demo_number(argv[1]);
    if (demo < 0) {
        fprintf(stderr, "Error: invalid demo \"%s\".\n\n", argv[1]);
        print_usage(argv[0]);
        return EXIT_FAILURE;
    }

    if (argc > 2) {
        int i;

        /* Extra arguments are custom messages; only demo 4 uses them. */
        if (demo != 4) {
            fprintf(stderr, "Error: only demo 4 accepts messages.\n");
            return EXIT_FAILURE;
        }
        if (argc - 2 > MAX_CUSTOM_MSGS) {
            fprintf(stderr, "Error: at most %d messages are allowed.\n",
                    MAX_CUSTOM_MSGS);
            return EXIT_FAILURE;
        }
        for (i = 2; i < argc; i++) {
            if (ipc_validate_text(argv[i]) < 0) {
                fprintf(stderr, "Error: message %d is invalid: %s.\n", i - 1,
                        errno == EMSGSIZE ? "longer than 1024 characters"
                                          : "empty");
                return EXIT_FAILURE;
            }
        }
        rc = run_demo(demo, (const char *const *)&argv[2],
                      (size_t)(argc - 2));
    } else {
        rc = run_demo(demo, NULL, 0);
    }
    return rc == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}
