/*
 * parent_process.h - Everything the PARENT process does with its pipe ends.
 *
 * Responsibility: the parent's side of each communication pattern. The
 * functions receive ready-to-use file descriptors; they do not create
 * pipes, fork, or close descriptors. That makes them easy to test.
 */
#ifndef PARENT_PROCESS_H
#define PARENT_PROCESS_H

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

/* Send 'count' text messages into write end 'wfd'.
 * Returns the number of messages sent, or -1 on error. */
int parent_send_messages(int wfd, const char *const msgs[], size_t count);

/* Receive messages from read end 'rfd' until end-of-file.
 * Returns the number of messages received, or -1 on error. */
int parent_receive_messages(int rfd);

/* Two-way conversation: for every message, send it on 'wfd', wait for the
 * child's reply on 'rfd' and verify that the reply is the upper-case
 * version of the request.
 * Returns the number of verified replies, or -1 on error/mismatch. */
int parent_run_dialogue(int wfd, int rfd, const char *const msgs[],
                        size_t count);

/* Send 'total' bytes of generated test data as a raw byte stream.
 * *checksum receives the sum of all bytes sent. Returns 0 or -1. */
int parent_send_bulk(int wfd, size_t total, uint32_t *checksum);

/* Interactive chat: read lines from 'in', validate them, send each to the
 * child and print the reply. Stops on "exit" or end of input.
 * Returns the number of messages exchanged, or -1 on error. */
int parent_chat(int wfd, int rfd, FILE *in);

#endif /* PARENT_PROCESS_H */
