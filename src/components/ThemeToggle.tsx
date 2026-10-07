"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  // Start as "light" on the server; correct it after mount. The inline script in
  // ThemeScript has already set the class, so there is no visible flash.
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("ww-theme", next);
    } catch {
      /* private mode */
    }
  }

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost !px-2"
      aria-label={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title="Switch theme"
    >
      {/* Both glyphs are always rendered; CSS picks one, so no hydration mismatch. */}
      <Sun className="size-[18px] dark:hidden" strokeWidth={1.9} />
      <Moon className="hidden size-[18px] dark:block" strokeWidth={1.9} />
    </button>
  );
}
