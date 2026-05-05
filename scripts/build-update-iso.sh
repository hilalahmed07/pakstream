#!/usr/bin/env bash
# Stages changed files into a folder mirroring the repo layout, writes a
# manifest of the change set, and builds an ISO suitable for transferring
# to the air-gapped server.
set -euo pipefail

REPO="${REPO:-$HOME/projects/PakStream}"
STAGE="${STAGE:-$HOME/pakstream-stage}"
ISO="${ISO:-$HOME/PakStream-updates.iso}"
LABEL="${LABEL:-PakStream-Updates}"

cd "$REPO"

# --- 1. Clean staging ---------------------------------------------------------
rm -rf "$STAGE"
mkdir -p "$STAGE"

# Patterns to skip even if git reports them.
should_skip() {
  case "$1" in
    .claude/*|.claude) return 0 ;;
    PakStream-updates.iso) return 0 ;;
    changed_files.txt|filtered_files.txt) return 0 ;;
    backend/.env|*/.env|*/.env.*) return 0 ;;
    node_modules/*|*/node_modules/*) return 0 ;;
    dist/*|*/dist/*|build/*|*/build/*) return 0 ;;
    6_apr_updates/*) return 0 ;;
  esac
  return 1
}

# --- 2. Build the change list (relative to repo root) -------------------------
# Modified/added/renamed (current copy on disk) — committed-vs-worktree.
mod_added=$(git diff --name-only --diff-filter=ACMR HEAD)
# Untracked but not ignored (new files you haven't `git add`-ed yet).
untracked=$(git ls-files --others --exclude-standard)
# Deleted (recorded in manifest only).
deleted=$(git diff --name-only --diff-filter=D HEAD)

# --- 3. Copy current-state files into staging --------------------------------
copied=0
copy_list() {
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    should_skip "$f" && continue
    [ -f "$f" ] || continue
    mkdir -p "$STAGE/$(dirname "$f")"
    cp -p "$f" "$STAGE/$f"
    copied=$((copied + 1))
  done
}
printf '%s\n' "$mod_added" | copy_list
printf '%s\n' "$untracked" | copy_list

# --- 4. Write the manifest ---------------------------------------------------
{
  echo "# PakStream update manifest"
  echo "# Built: $(date -Iseconds)"
  echo "# Source commit: $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
  echo
  echo "## ADD_OR_REPLACE"
  printf '%s\n%s\n' "$mod_added" "$untracked" | sort -u | while IFS= read -r f; do
    [ -z "$f" ] && continue
    should_skip "$f" && continue
    [ -f "$f" ] || continue
    echo "$f"
  done
  echo
  echo "## DELETE"
  printf '%s\n' "$deleted" | sort -u | while IFS= read -r f; do
    [ -z "$f" ] && continue
    should_skip "$f" && continue
    echo "$f"
  done
} > "$STAGE/MANIFEST.txt"

# --- 5. Sanity-check the staging tree ----------------------------------------
echo "Staged $copied files under $STAGE"
echo "Manifest: $STAGE/MANIFEST.txt"
echo
echo "Top-level entries:"
ls -1 "$STAGE"
echo

# --- 6. Build the ISO --------------------------------------------------------
rm -f "$ISO"
genisoimage \
  -V "$LABEL" \
  -J -joliet-long -r \
  -input-charset utf-8 \
  -o "$ISO" \
  "$STAGE"

echo
echo "ISO ready: $ISO"
ls -lh "$ISO"
sha256sum "$ISO"
