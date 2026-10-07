import Script from "next/script";

/**
 * Applies the saved theme before first paint so a dark-mode user never sees a
 * white flash. Runs as a blocking inline script, which is why it has to be a
 * raw string rather than a component.
 */
export function ThemeScript() {
  const code = `
    try {
      var t = localStorage.getItem("ww-theme");
      if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      if (t === "dark") document.documentElement.classList.add("dark");
    } catch (e) {}
  `;
  return <Script id="ww-theme" strategy="beforeInteractive">{code}</Script>;
}
