const campusTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
});
const campusDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true,
});

export const formatDate = (date: string) => campusTime.format(new Date(date));
export const formatDateTime = (date: string) => `${campusDateTime.format(new Date(date))} IST`;
export const fieldDeadline = (date: string) => new Date(Date.parse(date) + 330 * 60000).toISOString().slice(0, 16);
export const decisionLabel = (decision: string) => ({ shortlist: "Shortlist", hold: "Hold", reject: "Reject" })[decision] || "Pending";

export function screeningState(status?: string, reason?: string | null) {
  if (status === "failed") return "Needs manual review";
  if (status === "completed") return "Screened";
  if (status === "processing") return "Screening";
  return reason === "quota_wait" ? "Waiting for AI quota" : "Queued";
}
