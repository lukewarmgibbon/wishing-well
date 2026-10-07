import { disclosureText, shouldDisclose } from "@/lib/affiliate";

/**
 * The affiliate disclosure, rendered once per page.
 *
 * Returns nothing unless the feature is actually configured, so with the flag
 * off there is no banner, no layout shift, and no empty markup in the DOM.
 */
export function AffiliateDisclosure({ className = "" }: { className?: string }) {
  const text = disclosureText();
  if (!shouldDisclose() || !text) return null;

  return (
    <p className={`text-[0.75rem] leading-relaxed text-v-400 ${className}`}>
      {text}
    </p>
  );
}
