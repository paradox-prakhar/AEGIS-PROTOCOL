#!/usr/bin/env bash
# Integration test: runs the real ./ipc_pipe executable the way a user
# would and checks exit status, output, hangs and leftover processes.
# Run from the project root (make test does this).

BIN=./ipc_pipe
pass=0
fail=0

ok()  { echo "  ok   - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

# expect_status <expected-exit-status> <description> <command...>
# 'timeout 20' kills a hanging program and returns 124, which then
# differs from the expected status and is reported as a failure.
expect_status() {
    local want=$1 desc=$2
    shift 2
    timeout 20 "$@" >/dev/null 2>&1
    local got=$?
    if [ "$got" -eq "$want" ]; then ok "$desc"; else bad "$desc (exit $got, wanted $want)"; fi
}

# expect_output <text> <description> <command...>
expect_output() {
    local text=$1 desc=$2
    shift 2
    if timeout 20 "$@" 2>&1 | grep -qF -- "$text"; then ok "$desc"; else bad "$desc (missing: $text)"; fi
}

[ -x "$BIN" ] || { echo "FAIL integration: $BIN not built (run make)"; exit 1; }

# Every demonstration finishes on its own and reports success.
for n in 1 2 3 4 5 6 7; do
    expect_status 0 "demo $n exits with status 0" "$BIN" "$n"
done
expect_status 0 "all demos in one run" "$BIN" all
expect_output "Summary: 7 of 7 demonstrations succeeded" "summary line" "$BIN" all

# The data really arrives and is transformed.
expect_output 'received message 1: "Hello child, this is your parent"' \
    "demo 1: child received the parent's message" "$BIN" 1
expect_output 'received message 3: "Child work finished"' \
    "demo 2: parent received the child's message" "$BIN" 2
expect_output 'got reply   1: "HELLO FROM THE PARENT PROCESS" (verified)' \
    "demo 3: reply came back on the second pipe" "$BIN" 3
expect_output 'got reply   2: "SECOND ONE" (verified)' \
    "demo 4: custom messages" "$BIN" 4 "first one" "second one"
expect_output "transfer verified" "demo 5: checksum matches" "$BIN" 5
expect_output "EOF, parent closed its write end" "demo 6: child saw EOF" "$BIN" 6
expect_output "EPIPE" "demo 7: EPIPE reported" "$BIN" 7

# Interactive chat driven through stdin (includes an empty line).
expect_output 'child replied: "HELLO PIPE"' "demo 8: chat reply" \
    bash -c "printf 'hello pipe\n\nexit\n' | $BIN 8"
expect_output "invalid input: empty message" "demo 8: empty line rejected" \
    bash -c "printf '\nexit\n' | $BIN 8"
expect_status 0 "demo 8: ends cleanly at end of input" \
    bash -c "printf 'no exit command\n' | $BIN 8"
long_line=$(head -c 2000 /dev/zero | tr '\0' 'a')
expect_output "invalid input: longer than 1024" "demo 8: over-long line rejected" \
    bash -c "printf '%s\nexit\n' '$long_line' | $BIN 8"

# Menu mode.
expect_output "Demo 1 completed successfully" "menu: choice 1 runs demo 1" \
    bash -c "printf '1\n0\n' | $BIN"
expect_output "Invalid choice" "menu: bad choice rejected" \
    bash -c "printf 'abc\n0\n' | $BIN"

# Invalid command lines are rejected with a non-zero status.
expect_status 1 "rejects demo number 0" "$BIN" 0
expect_status 1 "rejects demo number 99" "$BIN" 99
expect_status 1 "rejects non-numeric demo" "$BIN" hello
expect_status 1 "rejects trailing garbage (3abc)" "$BIN" 3abc
expect_status 1 "rejects empty message" "$BIN" 4 ""
expect_status 1 "rejects over-long message" "$BIN" 4 "$long_line"
expect_status 1 "rejects messages for other demos" "$BIN" 1 "text"
expect_status 0 "--help works" "$BIN" --help

# No child may survive its parent, and none may be left as a zombie.
sleep 0.2
if pgrep -x ipc_pipe >/dev/null; then
    bad "no ipc_pipe process left running"
    pkill -x ipc_pipe
else
    ok "no ipc_pipe process left running"
fi
if ps -eo stat=,comm= | grep -E '^Z.* ipc_pipe' >/dev/null; then
    bad "no zombie ipc_pipe process"
else
    ok "no zombie ipc_pipe process"
fi

total=$((pass + fail))
if [ "$fail" -eq 0 ]; then
    echo "PASS integration              ($total checks, 0 failed)"
    exit 0
fi
echo "FAIL integration              ($total checks, $fail failed)"
exit 1
