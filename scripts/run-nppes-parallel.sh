#!/bin/bash
# Runs several states' geocode+import concurrently instead of one at a time.
# The bottleneck is waiting on the (free, keyless) Census geocoder to
# respond, not local computation, so running several of those waits in
# parallel is what actually speeds this up.
#
# Usage:
#   ./scripts/run-nppes-parallel.sh "FL CA NY TX OH MI PA" 6
#   ./scripts/run-nppes-parallel.sh "IL NC MA WA NJ GA MD VA CO AZ" 8
#
# Each state has its own checkpoint file, so this is safe to run on a
# second machine at the same time as the first, AS LONG AS the two
# machines are given non-overlapping state lists — both write to the same
# Supabase project, keyed by NPI, so there's no conflict as long as you
# don't process the same state from two places at once.
#
# Requires the staged/ CSVs to already exist (run the `stage` step first —
# see scripts/seed-nppes-bulk.mjs's own header for that command) and
# SUPABASE_URL + SUPABASE_SECRET_KEY set in the environment before running.
set -u

STATES="${1:?Usage: $0 \"STATE1 STATE2 ...\" [concurrency]}"
CONCURRENCY="${2:-6}"

cd "$(dirname "$0")/.."
: "${SUPABASE_URL:?Set SUPABASE_URL first}"
: "${SUPABASE_SECRET_KEY:?Set SUPABASE_SECRET_KEY first}"

mkdir -p NPI_Data/logs

run_one() {
  code="$1"
  csv="NPI_Data/staged/$code.csv"
  [ -f "$csv" ] || { echo "$code: no staged file, skipping"; return 0; }
  node scripts/seed-nppes-bulk.mjs process \
    --state-csv "$csv" \
    --geocode --geocoder census \
    --batch-size 9000 \
    --push \
    --checkpoint "NPI_Data/staged/$code.checkpoint.json" \
    > "NPI_Data/logs/$code.log" 2>&1
  echo "$code done $(date)" >> NPI_Data/logs/_completed.txt
}
export -f run_one

echo "$STATES" | tr ' ' '\n' | xargs -P "$CONCURRENCY" -I{} bash -c 'run_one "$@"' _ {}

echo "BATCH COMPLETE $(date)" >> NPI_Data/logs/_completed.txt
