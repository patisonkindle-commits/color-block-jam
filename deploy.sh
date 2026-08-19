#!/bin/bash
# Deploy color-block-jam to GitHub Pages (manual, token-inline then scrub)
# Usage: ./deploy.sh
set -e
cd /home/patison/projects/color-block-jam
TOKEN=$(cat ~/.github-token)
BUNDLE=$(grep -o 'index-[^"]*' dist/index.html)
echo "Deploying bundle: $BUNDLE"

# 1. Commit latest dist + src to main
git add -A
git commit -m "deploy: $BUNDLE" || echo "nothing to commit"
git remote set-url origin "https://patisonkindle-commits:${TOKEN}@github.com/patisonkindle-commits/color-block-jam.git"
git push origin main
git remote set-url origin "https://github.com/patisonkindle-commits/color-block-jam.git"

# 2. Update gh-pages branch: index.html + bundle at assets/
git checkout gh-pages
git checkout main -- dist/index.html  # take built html (has /color-block-jam/ base)
cp dist/index.html index.html
mkdir -p assets
cp dist/assets/$BUNDLE assets/
# remove old bundles (keep only current + previous)
ls assets/ | grep '^index-' | grep -v "$BUNDLE" | head -20 | while read f; do git rm -q --ignore-unmatch "assets/$f" || rm -f "assets/$f"; done
git add -A
git commit -m "deploy: $BUNDLE" || echo "nothing to commit"
git remote set-url origin "https://patisonkindle-commits:${TOKEN}@github.com/patisonkindle-commits/color-block-jam.git"
git push origin gh-pages
git remote set-url origin "https://github.com/patisonkindle-commits/color-block-jam.git"

# 3. Back to main
git checkout main
echo "Deploy done: https://patisonkindle-commits.github.io/color-block-jam/ (bundle $BUNDLE)"