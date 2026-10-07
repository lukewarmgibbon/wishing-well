#!/usr/bin/env node
/**
 * Prepares `extension/` for loading or publishing.
 *
 * The checked-in manifest hardcodes `http://localhost:3000`, which is right for
 * running against a local dev server and wrong everywhere else — an installed
 * copy would make every user hand-type a server address before it worked. This
 * script points a build at the real host and stamps the origin into the
 * background worker so the popup is preconfigured on first run.
 *
 *   node scripts/build-extension.mjs
 *   WISHING_WELL_ORIGIN=https://wish.example.com node scripts/build-extension.mjs
 *
 * It edits files in place, so the committed tree stays the local-dev default.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const EXT = join(dirname(fileURLToPath(import.meta.url)), "..", "extension");

const raw = process.env.WISHING_WELL_ORIGIN ?? "http://localhost:3000";
let origin;
try {
  const url = new URL(raw);
  origin = url.origin;
} catch {
  console.error(`WISHING_WELL_ORIGIN must be an absolute URL, got "${raw}".`);
  process.exit(1);
}

// --- manifest: swap the server origin and keep host_permissions in step ---
const manifestPath = join(EXT, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const appPattern = `${origin}/*`;

if (!manifest.host_permissions.includes(appPattern)) {
  // Keep the app's own origin so the extension can read the current tab there.
  const others = manifest.host_permissions.filter((p) => p !== "http://localhost:3000/*");
  manifest.host_permissions = [appPattern, ...others];
}

if (isLocal) {
  // Local dev: broad access so the extension works on any shop you're testing.
  manifest.host_permissions = [appPattern, "https://*/*"];
  delete manifest.optional_host_permissions;
} else {
  // A published build still needs to read arbitrary product pages, because the
  // content script is declared with `<all_urls>`. So the blanket origin stays —
  // but it is declared as OPTIONAL, which means the Web Store lists it as
  // "requested at runtime" rather than "this extension reads every site you
  // visit", and the user grants it knowingly.
  //
  // To remove it entirely, drop the `content_scripts` block and inject on demand
  // with chrome.scripting.executeScript under `activeTab`. That is the correct
  // end state for store review and is documented in the README.
  manifest.host_permissions = [appPattern, "http://localhost/*"];
  manifest.optional_host_permissions = ["https://*/*"];
  if (!manifest.permissions.includes("activeTab")) manifest.permissions.push("activeTab");
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

// --- background worker: stamp in the build origin ---
const bgPath = join(EXT, "background.js");
const bg = readFileSync(bgPath, "utf8");
// Match the placeholder OR a previously stamped origin, so re-running the
// script with a different WISHING_WELL_ORIGIN actually moves the build.
//
// Test for a *match*, not for changed text. Rebuilding for the origin that is
// already stamped produces byte-identical text, so a before/after comparison
// reports "could not find" and aborts — leaving the popup and manifest
// unstamped even though this line was perfectly findable.
const BUILD_ORIGIN_RE = /const BUILD_ORIGIN = (?:\"__WISHING_WELL_ORIGIN__\"|"[^"]*");/;
if (!BUILD_ORIGIN_RE.test(bg)) {
  console.error("Could not find the BUILD_ORIGIN line in extension/background.js.");
  process.exit(1);
}
writeFileSync(bgPath, bg.replace(BUILD_ORIGIN_RE, `const BUILD_ORIGIN = ${JSON.stringify(origin)};`));

// --- popup: the settings placeholder should match ---
//
// Both replacements below match *whatever origin is currently in there*, not
// just the literal localhost default. Matching only the original string makes
// the build a one-shot: the first run stamps a domain, and every later run for
// a different domain silently leaves the stale one behind — which is how
// `wish.example.com` ended up in a pushed build.
const popupPath = join(EXT, "popup.html");
let popup = readFileSync(popupPath, "utf8");

const before = popup;
popup = popup.replace(
  /placeholder="https?:\/\/[^"]*"/,
  `placeholder="${origin}"`,
);
popup = popup.replace(
  /This build is set to <em>[^<]*<\/em>/,
  `This build is set to <em>${origin}</em>`,
);
if (popup === before) {
  console.warn(
    "  warning: popup.html had nothing to re-stamp. Its markup may have changed.",
  );
}
writeFileSync(popupPath, popup);

console.log(`extension/ prepared for ${origin}`);
console.log(`  host_permissions: ${manifest.host_permissions.join(", ")}`);
if (!isLocal) {
  console.log("  non-local build: blanket https://*/* moved to optional_host_permissions");
  console.log("  (the Web Store will ask you to justify or drop it entirely)");
}
