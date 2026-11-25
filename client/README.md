# haki-ff — HAKI workspace preview

A browser-based HAKI workspace with local demo accounts and repositories, plus a bilingual AI help assistant powered by Gemini.

## Run locally

1. Use Node.js 20.12 or newer.
2. Run `npm install` once.
3. Copy `.env.example` to `.env` and add a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Keep real keys in `.env`; never add them to frontend code or commit them.
4. To enable GitHub login, create a GitHub OAuth App. Set its callback URL to `http://localhost:5173/api/auth/github/callback`, then copy its client ID and secret into the `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` entries in `.env`. Keep the secret private.
5. Run `npm run dev` and open the Vite URL it prints. Vite handles the app's `/api/*` routes through its local server middleware.

The chat is English-only, includes suggested questions, and uses the Gemini Interactions API. Messages are sent to Gemini for replies; requests set `store: false` and the server key is kept outside the browser bundle. The API server limits chat requests to 20 per minute per IP.

## Production preview

Run `npm run build`, then `npm run serve`. The Node server serves `dist` and handles `/api/*`. Set `GEMINI_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a production `GITHUB_REDIRECT_URI` in your hosting provider's server-side environment variables. Set the exact production callback URL in your GitHub OAuth App. Do not publish the `.env` file.

## Preview limits

Account and repository data live only in the browser. GitHub login creates or links a local browser account; it does not import repositories or grant GitHub repository access. Public/private visibility applies to this local demo only. OTP codes appear on screen; email is not sent. ZIP selection does not extract files. The Gemini Assistant can answer questions about HAKI and general development topics, but it cannot make changes in the workspace on the user's behalf.
