// Chromium regression for the extension after the permission + placeholder work.
//
// Scope note: the popup is opened as a page here, so chrome.tabs.query() inside it
// resolves to the popup's own tab rather than the page the user is looking at.
// That is an artifact of the harness, not the product. So the two things that
// changed are verified separately and precisely:
//
//   1. ensurePageAccess() — the real function, loaded from the real popup.js,
//      called with the URLs that matter.
//   2. bulk capture — driven the way background.js drives it, via
//      chrome.tabs.sendMessage to the content script.
//
// Run with AX_TOKEN / AX_LIST from the seeded database.
import { chromium } from "playwright";
import path from "node:path";
import { readFileSync } from "node:fs";

const EXT = path.resolve("extension");
const APP = "http://localhost:3000";
const TOKEN = process.env.AX_TOKEN;
const LIST = process.env.AX_LIST;

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// Four product-shaped cards, one deliberate non-product.
const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>Fixture shop</title>
<meta property="og:type" content="website">
</head><body>
<nav><a href="/about">About us</a><a href="/contact">Contact</a><a href="/blog/post">Blog</a></nav>
<main>
  <article class="product-card" itemscope itemtype="https://schema.org/Product">
    <a href="/p/alpha-widget" title="Alpha Widget">
      <img src="https://cdn.example.com/alpha.jpg" alt="Alpha Widget">
      <h2>Alpha Widget</h2>
    </a>
    <p class="price">&pound;49.99</p>
  </article>
  <article class="product-card" itemscope itemtype="https://schema.org/Product">
    <a href="/p/beta-gizmo" title="Beta Gizmo">
      <img src="https://cdn.example.com/beta.jpg" alt="Beta Gizmo">
      <h2>Beta Gizmo</h2>
    </a>
    <p class="price">&pound;12.50</p>
  </article>
  <article class="product-card" itemscope itemtype="https://schema.org/Product">
    <a href="/p/gamma-doohickey" title="Gamma Doohickey">
      <img src="https://cdn.example.com/gamma.jpg" alt="Gamma Doohickey">
      <h2>Gamma Doohickey</h2>
    </a>
    <p class="price">&pound;7.25</p>
  </article>
  <article class="product-card" itemscope itemtype="https://schema.org/Product">
    <a href="/p/delta-thingamajig" title="Delta Thingamajig">
      <img src="https://cdn.example.com/delta.jpg" alt="Delta Thingamajig">
      <h2>Delta Thingamajig</h2>
    </a>
    <p class="price">&pound;120.00</p>
  </article>
  <article><h2>About us</h2><p>We are a shop that sells widgets. No product here.</p></article>
</main>
</body></html>`;

if (!TOKEN || !LIST) {
  console.error("Set AX_TOKEN and AX_LIST (see README).");
  process.exit(1);
}

const browser = await chromium.launchPersistentContext("/tmp/ww-ext-profile", {
  headless: true,
  channel: "chromium",
  executablePath: process.env.CHROME_BIN || undefined,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  const worker =
    browser.serviceWorkers()[0] || (await browser.waitForEvent("serviceworker", { timeout: 20000 }));
  check("service worker boots", Boolean(worker), worker.url().split("/").pop());

  await worker.evaluate(
    ([t, s]) => chrome.storage.local.set({ token: t, server: s, lastListId: null }),
    [TOKEN, APP],
  );

  // ---- 1. placeholder hardening -------------------------------------------
  const server = await worker.evaluate(async () => (await chrome.storage.local.get("server")).server);
  check("server resolves to a real origin", /^https?:\/\//.test(server), server);

  // ---- 2. ensurePageAccess, the real function from the real popup.js -------
  const extId = new URL(worker.url()).host;
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForTimeout(400);

  const popupSource = readFileSync(path.join(EXT, "popup.js"), "utf8");
  const fnSource = popupSource.match(/async function ensurePageAccess[\s\S]*?\n}/)?.[0];
  if (!fnSource) throw new Error("ensurePageAccess not found in popup.js");

  const access = await popup.evaluate(async (fnSrc) => {
    const ensurePageAccess = new Function(`${fnSrc}; return ensurePageAccess;`)();
    return {
      local: await ensurePageAccess("http://localhost:3000/fixture"),
      localRoot: await ensurePageAccess("http://localhost:3000"),
      httpsGranted: await ensurePageAccess("https://shop.example.com/product/1"),
      chromePage: await ensurePageAccess("chrome://extensions"),
      extensionPage: await ensurePageAccess(`chrome-extension://${location.host}/popup.html`),
      junk: await ensurePageAccess("not a url"),
    };
  }, fnSource);

  if (access.missing) {
    check("ensurePageAccess is reachable from popup.js", false);
  } else {
    check(
      "already-granted http origin is accepted without a prompt",
      access.local === true && access.localRoot === true,
      `local=${access.local} root=${access.localRoot}`,
    );
    check(
      "already-granted https origin is accepted (blanket host perm)",
      access.httpsGranted === true,
      `https=${access.httpsGranted}`,
    );
    check(
      "non-web pages are refused without prompting",
      access.chromePage === false && access.extensionPage === false && access.junk === false,
      `chrome=${access.chromePage} ext=${access.extensionPage} junk=${access.junk}`,
    );
  }

  // ---- 3. bulk capture, driven the way background.js drives it ------------
  const fixture = await browser.newPage();
  await fixture.route("**/fixture*", (r) =>
    r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }),
  );
  await fixture.goto(APP + "/fixture", { waitUntil: "load" });
  await fixture.bringToFront();
  await fixture.waitForTimeout(500);

  const tabId = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "http://localhost:3000/fixture" });
    return tabs[0]?.id ?? null;
  });

  if (tabId == null) {
    check("fixture tab is visible to the extension", false);
  } else {
    const scan = await worker.evaluate(async (id) => {
      try {
        const res = await chrome.tabs.sendMessage(id, { type: "scan", limit: 40 });
        return { ok: true, products: res?.products ?? [] };
      } catch (e) {
        return { ok: false, error: String(e.message ?? e) };
      }
    }, tabId);

    if (!scan.ok) {
      check("content script answers the scan", false, scan.error);
    } else {
      const names = scan.products.map((p) => p.title ?? "");
      check("bulk scan finds all 4 products", scan.products.length === 4, `${scan.products.length}: ${names.join(", ")}`);
      check(
        "non-product card is not a false positive",
        !names.some((n) => /about us|no product here|shop that sells/i.test(n)),
      );
      check(
        "prices and currencies survive the scan",
        scan.products.some((p) => p.currency === "GBP") && scan.products.some((p) => p.price === 49.99),
        scan.products.map((p) => `${p.currency} ${p.price}`).join(" | "),
      );
    }
  }
} catch (e) {
  check("harness", false, e.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
