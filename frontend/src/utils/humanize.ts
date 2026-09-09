/** "MEDICAL_TERM" -> "Medical Term", "IN_PROGRESS" -> "In Progress" */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
