#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "Pulling Latest Changes from GitHub (destinyfaux/Z-Image-Studio)"
echo "======================================================================"

if ! command -v git &> /dev/null; then
    echo "[ERROR] Git was not found in PATH."
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "[WARNING] You have uncommitted local changes:"
    git status -s
    echo ""
fi

echo "Fetching and pulling updates from origin main..."
git pull origin main

echo "======================================================================"
echo "Local repository is now up to date with GitHub!"
echo "======================================================================"
