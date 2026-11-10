#!/usr/bin/env bash
# Regenerates the evidence files in results/ from real runs on this
# machine. Run from the project root (make results does this).

mkdir -p results

{
    echo "Date    : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "System  : $(uname -srm)"
    echo "Compiler: $(gcc --version | head -n 1)"
} > results/environment.txt

# Clean rebuild so that every compiler message (if any) is captured.
make --no-print-directory clean > /dev/null
make --no-print-directory ipc_pipe > results/build_log.txt 2>&1
echo "make exit status: $?" >> results/build_log.txt
make $(ls tests/test_*.c | sed 's|tests/\(.*\)\.c|build/\1|') >> /dev/null 2>&1

./ipc_pipe all > results/demo_all.txt 2>&1
echo "exit status: $?" >> results/demo_all.txt

printf 'hello from the keyboard\n\noperating systems lab\nexit\n' \
    | ./ipc_pipe 8 > results/demo_chat.txt 2>&1
echo "exit status: $?" >> results/demo_chat.txt

./tests/run_tests.sh > results/test_log.txt 2>&1
status=$?
echo "exit status: $status" >> results/test_log.txt

echo "Logs written to results/ (test exit status $status)"
exit $status
