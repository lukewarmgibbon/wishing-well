export function Avatar({
  name,
  image,
  size = "md",
}: {
  name: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const cls = size === "sm" ? "size-7 text-xs" : size === "lg" ? "size-14 text-lg" : "size-9 text-sm";
  const initials = (name ?? "?").trim().slice(0, 1).toUpperCase() || "?";

  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={`${cls} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-a-100 dark:bg-a-900/40 font-bold text-a-600 dark:text-a-300`}
    >
      {initials}
    </span>
  );
}
