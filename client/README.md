# haki-ff — HAKI workspace preview

A browser-based HAKI workspace with local demo accounts and repositories, plus a bilingual AI help assistant powered by Gemini.

## Run locally

1. Use Node.js 20.12 or newer.
2. Run `npm install` once.
3. Keep `GEMINI_API_KEY` in `server/.env` only. The main backend reads it; never place the key in the client folder or frontend code.
4. To enable GitHub login, create a GitHub OAuth App. Set its callback URL to `http://localhost:5173/api/auth/github/callback`, then copy its client ID and secret into the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` entries in `.env`. Keep the secret private.
5. Start the main backend from the `server` workspace, then run `npm run dev` in `client`. The frontend proxies `/api/v1/*` requests to the authenticated backend.

The chat UI is in the frontend. Chat replies and Gemini security reviews run on the main backend through authenticated routes. The backend sends chat messages to Gemini with `store: false`; the Gemini key stays in `server/.env`. Chat and review requests are rate-limited.

## Production preview

Run `npm run build`, then `npm run serve`. The Node server serves `dist` and proxies `/api/v1/*` to the main API. Set `HAKI_API_TARGET` if the backend is not at localhost:5000. Keep `GEMINI_API_KEY` in server/.env, and set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a production `GITHUB_REDIRECT_URI` in your hosting provider's server-side environment variables. Set the exact production callback URL in your GitHub OAuth App. Do not publish the `.env` file.

## Preview limits

Account and repository data live only in the browser. GitHub login creates or links a local browser account; it does not import repositories or grant GitHub repository access. Public/private visibility applies to this local demo only. OTP codes appear on screen; email is not sent. ZIP imports extract supported text and code files into the browser workspace and scan them for common secret leaks. The Gemini Assistant can answer questions about HAKI and general development topics, but it cannot make changes in the workspace on the user's behalf.


## Security and governance review

The main backend extracts ZIP uploads and scans submitted workspace files for common API tokens, private keys, credentials in URLs, and missing README, LICENSE, or .gitignore files. The frontend displays the server-generated report and can download it as Markdown; secret values are never returned. Gemini review uses finding metadata only; source files and secret values are not sent. Pattern checks can miss issues or flag examples, so verify the report manually.
