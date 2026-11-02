export function compactNumber(n: number) {
  return new Intl.NumberFormat("en-IN", { notation: n > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}
export function prettyDate(value: string | null) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
export function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join("").toUpperCase();
}