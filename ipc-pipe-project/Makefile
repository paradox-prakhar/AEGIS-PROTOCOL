# Makefile for the IPC-using-pipe() project.
#
#   make          build ./ipc_pipe
#   make test     build and run all unit tests + the integration test
#   make results  run everything and save the logs in results/
#   make clean    remove everything that was generated
#
# NOTE: the indented command lines below must start with a TAB character.

CC      := gcc
CFLAGS  := -Wall -Wextra -pedantic -std=c11 -g
BUILD   := build

# Every module except main.c: these are also linked into each test.
MODULES := src/ipc_utils.c src/pipe_setup.c src/parent_process.c \
           src/child_process.c src/scenarios.c
MODULE_OBJS := $(MODULES:src/%.c=$(BUILD)/%.o)

TEST_SRCS := $(wildcard tests/test_*.c)
TEST_BINS := $(TEST_SRCS:tests/%.c=$(BUILD)/%)

.PHONY: all test results clean

all: ipc_pipe

# Linking: combine the object files into one executable.
ipc_pipe: $(BUILD)/main.o $(MODULE_OBJS)
	$(CC) $(CFLAGS) $^ -o $@

# Compiling: each .c file becomes one .o file. It is rebuilt when the
# .c file or any header changes.
$(BUILD)/%.o: src/%.c $(wildcard src/*.h) | $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

# Each test program = one test file + all modules (without main.c).
$(BUILD)/test_%: tests/test_%.c tests/test_common.h $(MODULE_OBJS) | $(BUILD)
	$(CC) $(CFLAGS) -Isrc $< $(MODULE_OBJS) -o $@

$(BUILD):
	mkdir -p $(BUILD)

test: ipc_pipe $(TEST_BINS)
	./tests/run_tests.sh

results: ipc_pipe $(TEST_BINS)
	./tests/save_results.sh

clean:
	rm -rf $(BUILD) ipc_pipe
