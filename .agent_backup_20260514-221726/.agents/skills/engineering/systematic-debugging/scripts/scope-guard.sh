#!/bin/bash

# 🔒 Scope Guard — Debug Scope Enforcement
# Usage: bash scope-guard.sh <target-file>
# Checks if <target-file> is within the allowed debug scope.
# Reads scope from .agent/memory/debug-scope.txt
#
# Exit codes:
#   0 = ALLOW (file is in scope)
#   1 = WARN  (file is out of scope)
#   2 = NO SCOPE (no debug-scope.txt found — all edits allowed)

TARGET_FILE="${1:?Usage: scope-guard.sh <target-file>}"
SCOPE_FILE=".agent/memory/debug-scope.txt"

if [ ! -f "$SCOPE_FILE" ]; then
  echo "✅ NO SCOPE — debug-scope.txt not found. All edits allowed."
  exit 2
fi

SCOPE=$(cat "$SCOPE_FILE" | head -1 | tr -d '[:space:]')

if [ -z "$SCOPE" ]; then
  echo "✅ NO SCOPE — debug-scope.txt is empty. All edits allowed."
  exit 2
fi

# Check if target file starts with the scope path
if echo "$TARGET_FILE" | grep -q "^${SCOPE}"; then
  echo "✅ ALLOW — '$TARGET_FILE' is within scope: $SCOPE"
  exit 0
else
  echo "⚠️  WARN — '$TARGET_FILE' is OUTSIDE debug scope!"
  echo "   Current scope: $SCOPE"
  echo "   WTF Score +2 if you proceed."
  echo "   To expand scope: update .agent/memory/debug-scope.txt"
  exit 1
fi
