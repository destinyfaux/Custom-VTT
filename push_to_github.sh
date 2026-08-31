#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "Pushing Local Changes to GitHub (destinyfaux/Z-Image-Studio)"
echo "======================================================================"

if ! command -v git &> /dev/null; then
    echo "[ERROR] Git was not found in PATH."
    exit 1
fi

echo "Changed files:"
git status -s
echo ""

COMMIT_MSG="${1:-update: studio launcher fixes, frontend dependencies, and backend routing}"

echo "[1/3] Staging all changes..."
git add .

echo "[2/3] Committing changes..."
if git diff-index --quiet HEAD --; then
    echo "No changes to commit."
else
    git commit -m "$COMMIT_MSG"
fi

echo "[3/3] Pushing to origin main..."
git push origin main
echo "======================================================================"
echo "Changes successfully pushed to GitHub!"
echo "Repository: https://github.com/destinyfaux/Z-Image-Studio"
echo "======================================================================"
