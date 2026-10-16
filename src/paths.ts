/**
 * Why a file path can't be uploaded, or null if it's fine. Blocks escaping the repo, git internals
 * (in every spelling Windows and macOS treat as `.git`), and GitHub Actions: a workflow file can run
 * with the repository's secrets as soon as it's pushed, before anyone reviews the pull request.
 */
export function blockedPath(p: string): string | null {
  if (!p || p.length > 300 || p.startsWith("/") || /[\x00-\x1f\x7f\\:]/.test(p)) return "isn't a valid path";
  const segs = p.split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) return "isn't a valid path";
  if (segs.some((s) => ["git~1", ".git", ".gitmodules"].includes(s.toLowerCase().replace(/[. ]+$/, "")))) return "touches git internals";
  if (/^\.github\/(workflows|actions)\//i.test(p)) return "is a GitHub Actions file (it could run with your repo's secrets before review)";
  return null;
}
