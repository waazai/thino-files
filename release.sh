#!/usr/bin/env bash
# Build + publish a GitHub Release for BRAT to consume.
# Usage: ./release.sh
# Reads version from manifest.json. Bump manifest.json + package.json BEFORE running.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(node -p "require('./manifest.json').version")
PKG_VERSION=$(node -p "require('./package.json').version")

if [ "$VERSION" != "$PKG_VERSION" ]; then
  echo "WARN: manifest.json ($VERSION) != package.json ($PKG_VERSION). BRAT keys off manifest." >&2
fi

echo ">> Building prod bundle..."
npm run build

for f in main.js manifest.json styles.css; do
  [ -f "$f" ] || { echo "ERROR: missing $f" >&2; exit 1; }
done

# Tag may already exist if created by `npm version`. Create only if missing.
if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo ">> Tag $VERSION already exists (npm version) — skipping tag step."
else
  echo ">> Tagging $VERSION..."
  git tag "$VERSION"
  git push origin "$VERSION"
fi

if gh release view "$VERSION" >/dev/null 2>&1; then
  echo "ERROR: release $VERSION already published. Bump version first." >&2
  exit 1
fi

echo ">> Creating GitHub release $VERSION..."
gh release create "$VERSION" \
  main.js manifest.json styles.css \
  --title "$VERSION" \
  --notes "Release $VERSION"

echo ">> Done. BRAT 'Check for updates' will now pull $VERSION."
