#!/bin/bash

# 📊 Coverage Check — Quick Test Coverage Report
# Usage: bash coverage-check.sh
# Runs Vitest with coverage and outputs a summary.

echo "🧪 Running test coverage..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "package.json" ] && grep -q "vitest" package.json; then
  pnpm test --coverage --reporter=text 2>&1 | tail -30
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📋 Test file count:"
  TEST_COUNT=$(find . -name '*.test.*' -o -name '*.spec.*' | grep -v node_modules | wc -l | tr -d '[:space:]')
  SRC_COUNT=$(find ./src -name '*.ts' -o -name '*.tsx' 2>/dev/null | grep -v '.test.' | grep -v '.spec.' | wc -l | tr -d '[:space:]')
  echo "   Test files: $TEST_COUNT"
  echo "   Source files: $SRC_COUNT"
  
  if [ "$SRC_COUNT" -gt 0 ]; then
    RATIO=$(echo "scale=0; ($TEST_COUNT * 100) / $SRC_COUNT" | bc 2>/dev/null || echo "?")
    echo "   Test/Source ratio: ${RATIO}%"
  fi
else
  echo "⚠️  Vitest not found in package.json"
  echo "💡 Install: pnpm add -D vitest @testing-library/react"
fi
