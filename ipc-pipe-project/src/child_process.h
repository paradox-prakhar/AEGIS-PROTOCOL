/*
 * child_process.h - Everything the CHILD process does with its pipe ends.
 *
 * Responsibility: the child's side of each communication pattern. Like
 * the parent module, these functions only use descriptors given to them.
 */
#ifndef CHILD_PROCESS_H
#define CHILD_PROCESS_H

#include <stddef.h>
#include <stdint.h>

/* Receive messages from read end 'rfd' until end-of-file.
 * Returns the number of messages received, or -1 on error. */
int child_receive_messages(int rfd);

/* Send a short status report (three messages containing the child's PID
 * and its parent's PID) into write end 'wfd'.
 * Returns the number of messages sent, or -1 on error. */
int child_send_report(int wfd);

/* Service loop for two-way communication: read a request from 'rfd',
 * convert it to upper case, send it back on 'wfd'. Repeats until EOF.
 * Returns the number of requests served, or -1 on error. */
int child_run_service(int rfd, int wfd);

/* Read a raw byte stream from 'rfd' until end-of-file.
 * *total receives the byte count, *checksum the sum of all bytes.
 * Returns 0 on success, -1 on error. */
int child_receive_bulk(int rfd, size_t *total, uint32_t *checksum);

#endif /* CHILD_PROCESS_H */
