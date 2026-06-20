// Syncs manifest.json version from package.json during `npm version`.
// npm sets npm_package_version to the freshly-bumped version before this runs.
import { readFileSync, writeFileSync } from "fs";

const target = process.env.npm_package_version;
if (!target) {
  console.error("version-bump: npm_package_version not set; run via `npm version`.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = target;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`version-bump: manifest.json -> ${target}`);
