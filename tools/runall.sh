#!/bin/bash
# Run every t*.js and report only what is not clean.
# A test is clean when it prints "0 failures" and no JS errors; anything else is shown.
for f in t*.js; do
  out=$(timeout 200 node "$f" 2>&1)
  bad=""
  echo "$out" | grep -q "^0 failures" || bad="no clean failure count"
  echo "$out" | grep -qE "^FAIL" && bad="assertions failed"
  echo "$out" | grep -q "^JS ERRORS" && bad="$bad + js errors"
  echo "$out" | grep -qE "Invalid|ReferenceError|TypeError|Timeout" && bad="$bad + threw"
  if [ -n "$bad" ]; then
    echo "=== $f  [$bad]"
    echo "$out" | grep -E "^FAIL|^JS ERRORS|Error|NOT APPLICABLE|failures" | head -6
  fi
done
echo "SWEEP DONE"
