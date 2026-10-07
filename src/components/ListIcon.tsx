import {
  Gift, PartyPopper, House, Heart, BookOpen, Headphones,
  Baby, Sparkles, Cake, Wrench, Footprints, ChefHat, Package,
} from "lucide-react";

export const LIST_ICONS = {
  Gift, PartyPopper, House, Heart, BookOpen, Headphones,
  Baby, Sparkles, Cake, Wrench, Footprints, ChefHat,
} as const;

export type ListIconName = keyof typeof LIST_ICONS;

/**
 * Lists store an icon name (not a glyph) in `emoji`. Anything unrecognised —
 * an older row, a renamed icon — falls back to a neutral box rather than
 * rendering a broken or missing character.
 */
export function ListIcon({
  name,
  className = "size-5",
  strokeWidth = 1.7,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = LIST_ICONS[name as ListIconName] ?? Package;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
