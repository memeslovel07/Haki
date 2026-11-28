# HAKI workspace

The React app uses the HAKI API for authentication, account settings, repositories, files, commits, and ZIP imports. The Gemini assistant runs through the small Node server in this package.

## Local development

1. Use Node.js 20.12 or newer and run `npm install` from the repository root.
2. Copy `server/.env.example` to `server/.env`. Set `DATABASE_URL`, `DIRECT_URL`, and a random `JWT_ACCESS_SECRET` with at least 32 bytes. Set `FRONTEND_ORIGIN=http://localhost:5173`.
3. From the repository root, run `npm --workspace @haki/server run db:generate` and `npm --workspace @haki/server run db:migrate`.
4. Start the API with `npm --workspace @haki/server run dev`.
5. Copy `client/.env.example` to `client/.env` and set `HAKI_API_TARGET=http://localhost:5000` when the API is elsewhere. To enable the assistant, set `GEMINI_API_KEY` in `server/.env` and restart the backend.
6. Start the frontend with `npm --workspace client run dev`.

For GitHub sign-in and sign-up, set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and `GITHUB_OAUTH_REDIRECT_URI` in `server/.env`. Route the callback through the frontend API proxy so its refresh cookie is saved on the same origin as the app. Set the OAuth App callback URL to the same value as `GITHUB_OAUTH_REDIRECT_URI` (locally, `http://localhost:5173/api/v1/auth/github/callback`; production: `<frontend-origin>/api/v1/auth/github/callback`). The frontend Vite and production servers proxy `/api/v1` to the backend.

**Continue with GitHub** only signs in to an already linked HAKI account. New users must choose **Create account → Create account with GitHub**. Existing HAKI users can connect GitHub under **Settings → Security**; the callback links the GitHub identity to the signed-in HAKI account. Apply the OAuth link state migration before using linking.

Password reset uses the Resend email API. Configure `RESEND_API_KEY` and a verified `PASSWORD_RESET_FROM` sender in `server/.env` before enabling password reset in a deployed environment.

For code governance, create a GitHub App with read access to repository metadata and contents. Set its Setup URL to `http://localhost:5000/api/v1/github/install/callback`, then set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, and `GITHUB_APP_SLUG` in `server/.env`; put the slug in `VITE_GITHUB_APP_SLUG` in `client/.env`. After changing app configuration or environment values, restart the API and rebuild the frontend.

## Production

Run `npm --workspace client run build`, then `npm --workspace client run serve`. Run the HAKI API separately and set `HAKI_API_TARGET` to its origin for the frontend server. Apply migrations with `npm --workspace @haki/server run db:migrate`. Configure the database, JWT, frontend origin, Gemini key, and GitHub OAuth values in the server-side environment. Never commit `.env` files or API secrets.
