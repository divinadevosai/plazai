export interface FileOut {
  path: string;
  content: string;
}

/**
 * Pulls whole files out of an agent's answer, written as:
 *   FILE: path/to/file
 *   ```lang
 *   ...content...
 *   ```
 * Later versions of the same path win (a reviewer's fix replaces the writer's draft).
 */
export function parseFiles(text: string): FileOut[] {
  const out = new Map<string, string>();
  const re = /(?:^|\n)\s*(?:\*\*)?FILE:\s*`?([^\s`*]+)`?(?:\*\*)?\s*\n```[^\n]*\n([\s\S]*?)\n```/g;
  for (const m of text.matchAll(re)) {
    const path = m[1]!.replace(/^\.?\//, "");
    if (path && !path.includes("..")) out.set(path, `${m[2]!}\n`);
  }
  return [...out].map(([path, content]) => ({ path, content }));
}
