/**
 * The Plazai key proves to the local server that a request comes from this page, which lets the
 * server use keys kept in `.env`. It arrives once via the link printed in the terminal
 * (`/?plazai-key=…`), is kept for this origin only, and is wiped from the address bar straight away.
 */
const STORE = "plazai-key";

function read() {
  try {
    return localStorage.getItem(STORE) ?? "";
  } catch {
    return "";
  }
}

let key = read();

(() => {
  if (typeof location === "undefined") return;
  const url = new URL(location.href);
  const given = url.searchParams.get("plazai-key");
  if (given === null) return;
  if (/^[A-Za-z0-9_-]{40,}$/.test(given)) {
    key = given;
    try {
      localStorage.setItem(STORE, given);
    } catch {
      // private window: the key lasts for this tab only
    }
  }
  url.searchParams.delete("plazai-key");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
})();

/** Headers for every call to the local API. */
export function apiHeaders(json = true): Record<string, string> {
  return { ...(json ? { "content-type": "application/json" } : {}), ...(key ? { "x-plazai-key": key } : {}) };
}
