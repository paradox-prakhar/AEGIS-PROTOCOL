#!/usr/bin/env bash
# Runs every unit test program in build/ and then the integration test.
# Exit status 0 only if everything passed. Run from the project root.

failed=0
count=0

echo "== Unit tests =="
for t in build/test_*; do
    [ -x "$t" ] || continue
    count=$((count + 1))
    # 'timeout' is a second safety net against a hanging test.
    if ! timeout 30 "$t"; then
        echo "FAIL $(basename "$t") exited with a non-zero status"
        failed=$((failed + 1))
    fi
done

echo
echo "== Integration test =="
count=$((count + 1))
if ! ./tests/test_integration.sh; then
    failed=$((failed + 1))
fi

echo
if [ "$failed" -eq 0 ]; then
    echo "RESULT: all $count test programs passed"
    exit 0
fi
echo "RESULT: $failed of $count test programs FAILED"
exit 1
