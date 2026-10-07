const $ = (id) => document.getElementById(id);

const views = ["login", "add", "bulk", "settings", "newlist"];
let state = { config: null, scraped: null, lists: [], products: [], selected: new Set() };

function show(name) {
  for (const v of views) $(`${v}-view`).classList.toggle("hidden", v !== name);
}

function say(text, kind = "") {
  const el = $("message");
  el.textContent = text;
  el.className = `message ${kind}`;
}

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res?.ok) return reject(new Error(res?.error || "Something went wrong."));
      resolve(res);
    });
  });
}

/* ---------------------------------------------------------------- render */

function renderScraped(data) {
  state.scraped = data;
  $("item-title").textContent = data?.title || "This page";
  $("item-site").textContent = data?.site || "";
  $("item-price").textContent =
    data?.price != null ? new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency }).format(data.price) : "";

  const thumb = $("thumb");
  if (data?.imageUrl) {
    thumb.src = data.imageUrl;
    thumb.hidden = false;
  } else {
    thumb.hidden = true;
  }

  $("edit-title").value = data?.title || "";
  $("edit-price").value = data?.price != null ? String(data.price) : "";
  $("edit-note").value = "";
}

function renderLists(lists, lastListId) {
  state.lists = lists;
  const select = $("list-select");
  select.innerHTML = "";

  if (!lists.length) {
    const opt = document.createElement("option");
    opt.textContent = "No lists yet — create one below";
    opt.value = "";
    select.append(opt);
  }

  for (const list of lists) {
    const opt = document.createElement("option");
    opt.value = list.id;
    const owner = list.owner?.name ? ` · ${list.owner.name}` : "";
    opt.textContent = `${list.title}${owner}`;
    select.append(opt);
  }
  if (lastListId && lists.some((l) => l.id === lastListId)) select.value = lastListId;

  $("save-btn").disabled = !lists.length;
}

/* ------------------------------------------------------------- behaviour */

async function loadAddView() {
  show("add");
  say("");

  // Page details first so the popup feels instant.
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");
    const res = await send({ type: "scrape", tabId: tab.id });
    renderScraped(res.data);
    $("scrape-status").textContent = "Ready to save";
  } catch (err) {
    renderScraped({ title: "This page", site: "", url: "", price: null, currency: "USD" });
    $("scrape-status").textContent = "Couldn't read this page automatically — add a link and name it yourself.";
  }

  try {
    const res = await send({ type: "lists" });
    renderLists(res.lists, state.config?.lastListId);
  } catch (err) {
    say(err.message, "err");
  }
}

async function save() {
  const listId = $("list-select").value;
  const url = state.scraped?.url;
  if (!listId) return say("Pick a list first.", "err");
  if (!url) return say("Couldn't work out the page link.", "err");

  $("save-btn").disabled = true;
  say("Saving…");
  try {
    const item = {
      listId,
      url,
      title: $("edit-title").value.trim() || state.scraped.title,
      price: $("edit-price").value ? Number($("edit-price").value) : null,
      note: $("edit-note").value.trim() || null,
      priority: Number($("edit-priority").value),
      imageUrl: state.scraped.imageUrl ?? null,
      currency: state.scraped.currency || "USD",
    };

    const res = await send({ type: "add", item });
    const list = state.lists.find((l) => l.id === listId);

    if (res.duplicate) {
      say("That's already on the list — nice memory.", "ok");
    } else {
      say(`Added to ${list?.title ?? "your list"}.`, "ok");
    }

    // Refresh the config so the chosen list sticks around next time.
    const cfg = await send({ type: "config" });
    state.config = cfg.config;
  } catch (err) {
    say(err.message, "err");
  } finally {
    $("save-btn").disabled = false;
  }
}

async function createList() {
  const title = $("newlist-title").value.trim();
  if (!title) return;
  const btn = $("create-list-btn");
  btn.disabled = true;
  try {
    const { server, token } = state.config;
    const res = await fetch(`${server}/api/lists`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not create the list.");

    $("newlist-title").value = "";
    const lists = await send({ type: "lists" });
    state.config = (await send({ type: "config" })).config;
    await loadAddView();
    $("list-select").value = data.list.id;
    say(`Created “${title}” and selected it.`, "ok");
  } catch (err) {
    say(err.message, "err");
  } finally {
    btn.disabled = false;
  }
}

/* --------------------------------------------------------- bulk capture */

const bulkMoney = (value, currency) => {
  if (value == null) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toFixed(2)}`;
  }
};

function renderBulkProducts(emptyCopy) {
  const ul = $("bulk-list");
  ul.innerHTML = "";

  if (!state.products.length) {
    const li = document.createElement("li");
    li.className = "hint small";
    li.style.padding = "12px 10px";
    li.textContent =
      emptyCopy ?? "Nothing product-shaped found on this page. Try a search or category page.";
    ul.append(li);
    $("bulk-save").disabled = true;
    $("bulk-none").disabled = true;
    return;
  }
  $("bulk-none").disabled = false;

  for (const [index, p] of state.products.entries()) {
    const li = document.createElement("li");
    li.className = "bulk-row";

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = state.selected.has(index);
    box.id = `bulk-${index}`;
    box.addEventListener("change", () => {
      if (box.checked) state.selected.add(index);
      else state.selected.delete(index);
      updateBulkButton();
    });

    if (p.imageUrl) {
      const img = document.createElement("img");
      img.src = p.imageUrl;
      img.alt = "";
      img.loading = "lazy";
      li.append(img);
    } else {
      const ph = document.createElement("span");
      ph.className = "no-image";
      ph.setAttribute("aria-hidden", "true");
      ph.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/></svg>';
      li.append(ph);
    }

    const text = document.createElement("span");
    text.className = "bulk-text";
    const b = document.createElement("b");
    b.textContent = p.title;
    const span = document.createElement("span");
    span.textContent = new URL(p.url).hostname.replace(/^www\./, "");
    text.append(b, span);

    li.append(box, text);

    if (p.price != null) {
      const price = document.createElement("span");
      price.className = "bulk-price";
      price.textContent = bulkMoney(p.price, p.currency);
      li.append(price);
    }

    ul.append(li);
  }

  updateBulkButton();
}

function updateBulkButton() {
  const n = state.selected.size;
  const total = state.products.length;

  $("bulk-save").disabled = n === 0;
  $("bulk-save").lastChild.textContent = n === 0 ? "Save selected" : `Save ${n} selected`;

  // Toggling rather than a dead "Clear", so unticking one box is reversible
  // without re-scanning the page.
  const toggle = $("bulk-none");
  toggle.textContent = n === total && total > 0 ? "Clear all" : "Select all";
}

function selectAll(on) {
  state.selected = on ? new Set(state.products.map((_, i) => i)) : new Set();
  renderBulkProducts();
}

async function loadBulkView() {
  show("bulk");
  say("", "");
  $("bulk-message").textContent = "";
  $("bulk-message").className = "message";
  $("bulk-status").textContent = "Scanning this page for products…";
  state.products = [];
  state.selected = new Set();
  renderBulkProducts();

  const listSelect = $("bulk-list-select");
  listSelect.innerHTML = "";
  for (const list of state.lists) {
    const opt = document.createElement("option");
    opt.value = list.id;
    opt.textContent = list.title;
    listSelect.append(opt);
  }
  if (state.config?.lastListId && state.lists.some((l) => l.id === state.config.lastListId)) {
    listSelect.value = state.config.lastListId;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // On a production build `https://*/*` is an *optional* permission, so the
    // content script has not run on this page and a scan would come back empty.
    // Ask for it here, from inside the click handler, because
    // chrome.permissions.request() is only allowed during a user gesture.
    const granted = await ensurePageAccess(tab.url);
    if (!granted) {
      state.products = [];
      state.selected = new Set();
      renderBulkProducts();
      $("bulk-status").textContent =
        "Wishing Well needs permission to read this page to find products on it.";
      return;
    }

    const res = await send({ type: "scan", tabId: tab.id, limit: 40 });
    state.products = res.products ?? [];
    // Everything on by default — the whole point is not clicking 40 boxes.
    state.selected = new Set(state.products.map((_, i) => i));
    $("bulk-status").textContent = state.products.length
      ? `${state.products.length} found. Untick anything you don't want.`
      : "Nothing product-shaped on this page.";
    renderBulkProducts();
  } catch (err) {
    $("bulk-status").textContent = err.message;
  }
}

/**
 * Make sure the extension can actually read the page it is looking at.
 *
 * Grants are sticky once the user accepts, so this is a cheap check on every
 * scan. Returns true when access is already held (localhost builds, or after
 * the user granted it previously) and false when they declined.
 */
async function ensurePageAccess(url) {
  let pattern;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    pattern = `${parsed.origin}/*`;
  } catch {
    return false;
  }

  try {
    if (await chrome.permissions.contains({ origins: [pattern] })) return true;
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    // A build that lists the host as required has no optional permission to
    // request, and contains() already told us we have access.
    return true;
  }
}

async function saveBulk() {
  const listId = $("bulk-list-select").value;
  if (!listId) return;
  if (state.selected.size === 0) return;

  const btn = $("bulk-save");
  btn.disabled = true;
  const note = $("bulk-message");
  note.className = "message";
  note.textContent = `Saving ${state.selected.size}…`;

  try {
    const items = [...state.selected]
      .map((i) => state.products[i])
      .filter((p) => p && p.url && p.title);

    const res = await send({ type: "addBulk", listId, items });

    const list = state.lists.find((l) => l.id === listId);
    const parts = [`${res.added.length} added to ${list?.title ?? "your list"}`];
    if (res.duplicates.length) parts.push(`${res.duplicates.length} already there`);
    if (res.invalid.length) parts.push(`${res.invalid.length} failed`);

    note.className = `message ${res.added.length ? "ok" : "err"}`;
    note.innerHTML = parts.join(" · ");
    if (res.duplicates.length) {
      const span = document.createElement("span");
      span.className = "dupe";
      span.textContent = res.duplicates.slice(0, 3).map((d) => d.title).join(", ");
      note.append(span);
    }

    state.config = (await send({ type: "config" })).config;
    // Drop what landed so a second save can't re-report the same duplicates.
    const saved = new Set(res.added.map((a) => a.url));
    state.products = state.products.filter((p) => !saved.has(p.url));
    state.selected = new Set();
    // Everything is gone because it was just saved, which is a different
    // situation from "this page had nothing on it" and deserves its own words.
    renderBulkProducts(
      state.products.length
        ? undefined
        : res.added.length
          ? `All ${res.added.length} saved. Go back and scan the page again any time.`
          : "Nothing left to save from this page."
    );
  } catch (err) {
    note.className = "message err";
    note.textContent = err.message;
  } finally {
    updateBulkButton();
  }
}

/* ------------------------------------------------------------------ init */

async function init() {
  const res = await send({ type: "config" });
  state.config = res.config;

  $("server").value = state.config.server ?? "";
  $("token").value = state.config.token ?? "";

  // An in-page "right-click → Add to wishlist" can open the popup for you.
  const pending = (await chrome.storage.local.get("pendingFromMenu")).pendingFromMenu;
  if (pending) chrome.storage.local.remove("pendingFromMenu");

  if (state.config.token) {
    await loadAddView();
  } else {
    show("login");
  }
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    await send({ type: "login", email: $("email").value.trim(), password: $("password").value });
    state.config = (await send({ type: "config" })).config;
    await loadAddView();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

$("show-code").addEventListener("click", () => show("settings"));
$("settings-btn").addEventListener("click", () => show("settings"));
$("back-btn").addEventListener("click", () => (state.config.token ? loadAddView() : show("login")));
$("new-list-btn").addEventListener("click", () => show("newlist"));
$("newlist-back").addEventListener("click", () => loadAddView());
$("create-list-btn").addEventListener("click", createList);
$("save-btn").addEventListener("click", save);

$("bulk-btn").addEventListener("click", loadBulkView);
$("bulk-back").addEventListener("click", loadAddView);
$("bulk-save").addEventListener("click", saveBulk);
$("bulk-none").addEventListener("click", () => selectAll(state.selected.size !== state.products.length));

$("save-config").addEventListener("click", async () => {
  try {
    await send({
      type: "save",
      config: { server: $("server").value.trim().replace(/\/$/, ""), token: $("token").value.trim() || null },
    });
    state.config = (await send({ type: "config" })).config;
    if (state.config.token) {
      await loadAddView();
      say("Saved. You're connected.", "ok");
    } else {
      show("login");
    }
  } catch (err) {
    alert(err.message);
  }
});

$("logout-btn").addEventListener("click", async () => {
  await send({ type: "logout" });
  state.config = (await send({ type: "config" })).config;
  $("password").value = "";
  show("login");
});

init();
