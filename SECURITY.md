# Security

Plazai is a local app: the web page and its small API run on your own computer at `127.0.0.1`. This page explains how your keys and data are protected, and how to report a problem.

## How your keys are protected

- **Keys you paste in Settings** stay in your browser's storage for the Plazai page only. They are sent to the local Plazai server with each request and passed straight to the AI provider or GitHub. They are never logged, stored on the server, or put into a prompt.
- **Keys in `.env`** (or your shell) are only used for requests that carry your private Plazai key. When Plazai starts, it prints a link with that key in your terminal. Open it once and that browser is trusted. The key is stored in `~/.config/plazai/key`, readable only by your user account; delete the file to make a new one. Other programs, other users on the same computer, and other devices on your network can't use your `.env` keys or GitHub token.
- **Other websites can't use Plazai.** The local API rejects requests from other sites (Origin check) and DNS-rebinding tricks (Host check), and the app refuses to be shown inside another site's frame (`X-Frame-Options: DENY`, `frame-ancestors 'none'`).
- **Every `.env*` file is git-ignored** (except `.env.example`), so keys can't be committed by accident. Vite also refuses to serve `.env` files.

## What uploads to GitHub can and can't do

- Uploads only happen when you click **Upload**, and you choose the files.
- Plazai never writes to your default branch. It pushes a new branch and opens a pull request.
- It never uploads GitHub Actions workflows (`.github/workflows/`, `.github/actions/`) or git internals (`.git`, `.gitmodules`, and look-alike spellings). A workflow could run with your repository's secrets before anyone reviews it.
- New repositories are private unless you untick Private and confirm.

## Tips

- Prefer a [fine-grained token](https://github.com/settings/personal-access-tokens/new) limited to the repositories you want, without the Workflows permission.
- Don't start Plazai with `--host` unless you trust your network. It makes the app reachable from other devices, and Plazai will warn you.

## Audit

The code was security-audited in October 2026, covering the local API, credential handling, GitHub uploads, AI output handling, browser storage, Vite file serving, clickjacking and secret hygiene. Each issue was reproduced with dummy keys in an isolated sandbox. It was then fixed, with a regression test showing the old attack fails:

| Issue | Severity | Status |
|---|---|---|
| Other local programs could use `.env` keys and `GITHUB_TOKEN` through the local API | Medium | Fixed (private key link) |
| A malformed request could crash the local server | Low | Fixed (errors caught, requests validated) |
| AI-written GitHub Actions workflows could be uploaded | Lead | Fixed (blocked on server and in the dialog) |
| The app could be framed by other pages (clickjacking) | Lead | Fixed (frame-blocking headers, public-repo confirmation) |
| `.env.development`, `.env.production`, etc. weren't git-ignored | Hardening | Fixed |

Also hardened: only the needed environment variables are read, request bodies are type-checked and must be JSON, GitHub replies are size-limited, default-branch look-alikes (`Main`, `refs/heads/main`) are refused, and only one tab runs scheduled tasks.

## Reporting a vulnerability

Please email **hello@discipuli.app** with details and steps to reproduce. Don't open a public issue for security problems.
