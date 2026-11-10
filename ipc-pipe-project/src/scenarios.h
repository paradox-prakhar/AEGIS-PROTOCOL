/*
 * scenarios.h - The demonstrations offered by the program.
 *
 * Responsibility: orchestration. Each scenario creates the pipe(s),
 * calls fork(), closes the unused ends in each process, runs the parent
 * and child role functions and finally waits for the child.
 *
 * Every function returns 0 if the scenario succeeded, -1 otherwise.
 */
#ifndef SCENARIOS_H
#define SCENARIOS_H

#include <stddef.h>
#include <stdio.h>

int scenario_parent_to_child(void);      /* 1: one pipe, parent -> child */
int scenario_child_to_parent(void);      /* 2: one pipe, child -> parent */
int scenario_bidirectional(void);        /* 3: two pipes, request/reply  */

/* 4: several request/reply rounds. If count is 0 a built-in list of
 * messages is used, otherwise the caller's (already validated) list. */
int scenario_multiple_messages(const char *const msgs[], size_t count);

int scenario_bulk_transfer(void);        /* 5: 1 MiB byte stream         */
int scenario_eof_and_sync(void);         /* 6: blocking read, EOF, wait  */
int scenario_broken_pipe(void);          /* 7: write with no reader      */
int scenario_chat(FILE *in);             /* 8: interactive chat          */

#endif /* SCENARIOS_H */
