"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, Puzzle } from "lucide-react";

/**
 * Hands the signed-in user their extension API token and walks them through
 * loading the unpacked extension from the /extension folder.
 */
export function ExtensionSetupCard({
  apiToken,
  className = "",
}: {
  apiToken: string;
  className?: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState(apiToken);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // See SharePanel: never branch on `window` during render.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setRevealed(true);
    }
  }

  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-6 py-5 dark:border-hair-d">
        <div>
          <h2 className="font-semibold">Add the browser extension</h2>
          <p className="text-[0.875rem] text-v-500 dark:text-v-400">
            Save anything you see online straight to a list, without losing your place.
          </p>
        </div>
        <span className="chip bg-white text-v-500 dark:text-v-400">Chrome · Edge · Brave</span>
      </div>

      {/* grid-cols-1 is required, not decorative: a bare single-column grid
          resolves to `auto`, which sizes to its widest content rather than to
          the container. The step text embeds a long unbreakable path, so on a
          phone that column grew past the viewport and clipped the instructions. */}
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        <ol className="space-y-3 text-sm">
          {[
            ["Open the extensions page", "In Chrome, go to chrome://extensions and turn on Developer mode."],
            ["Load the extension", `Click “Load unpacked” and select the extension folder inside this project${
              origin ? ` (${origin}/extension)` : ""
            }.`],
            ["Paste your sign-in code", "Copy the token below into the extension popup to pair this browser."],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                {i + 1}
              </span>
              {/* min-w-0 is load-bearing: the step text embeds a long unbreakable
                  path, and a flex child without it refuses to shrink below its
                  content. On a phone that pushed this column 570px wide inside a
                  390px viewport, silently cutting the instructions off-screen. */}
              <div className="min-w-0">
                <p className="font-medium">{title}</p>
                <p className="break-words text-v-500 dark:text-v-400">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-v-200 dark:border-v-800 bg-v-50 dark:bg-v-900 p-4">
          <p className="label">Your personal sign-in code</p>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-v-200 dark:border-v-800 bg-white px-3 py-2 font-mono text-xs text-v-500 dark:text-v-400">
              {revealed ? token : "•".repeat(Math.min(token.length, 48) || 48)}
            </code>
            <button className="btn btn-secondary" onClick={() => setRevealed((v) => !v)}>
              {revealed ? "Hide" : "Show"}
            </button>
            <button className="btn btn-primary" onClick={copy} disabled={!token}>
              {copied ? (
                <>
                  <Check className="size-3.5" strokeWidth={2.5} /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-v-400">
            Treat this like a password — it signs the extension in as you.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="btn btn-secondary"
              disabled={rotating}
              onClick={async () => {
                if (!confirm("Create a new code? The old one stops working straight away, so any browser using it will be signed out.")) return;
                setRotating(true);
                try {
                  const res = await fetch("/api/extension/token/rotate", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? "Could not create a new code.");
                  setToken(data.apiToken);
                  setRevealed(true);
                  setNotice("New code created. Update it in every browser that uses the extension.");
                  router.refresh();
                } catch (err) {
                  setNotice((err as Error).message);
                } finally {
                  setRotating(false);
                }
              }}
            >
              {rotating ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" /> Working
                </>
              ) : (
                "Create a new code"
              )}
            </button>
            {notice && <span className="text-xs text-v-500 dark:text-v-400">{notice}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
