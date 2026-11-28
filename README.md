# HAKI

HAKI is a version-control workspace and code-governance project. It combines private repositories and file history with GitHub-backed validation and review workflows.

## Features

- Email/password registration and login
- GitHub sign-in with separate login and account-creation flows
- GitHub account linking for existing HAKI accounts
- Repository creation, editing, ZIP import, file management, and commit history
- GitHub repository governance submissions, automated validation, findings, and reviews
- Account profile, settings, and password reset
- Optional Gemini-powered assistant

### GitHub account flows

- **Continue with GitHub** signs in only when that GitHub account is already linked to HAKI.
- New users choose **Create account -> Create account with GitHub**. HAKI creates an account after GitHub returns a verified email.
- If the verified email already belongs to a HAKI account, sign in to that HAKI account and connect GitHub from **Settings -> Security**. Then GitHub sign-in will use the linked account.

## Tech stack

- Frontend: React, Vite, React Router, Tailwind CSS
- API: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma
- Validation jobs: BullMQ and Redis
- Integrations: GitHub OAuth, GitHub App, Resend, and optional Gemini API

## Requirements

- Node.js 20.12 or newer
- npm
- PostgreSQL
- Redis for background validation jobs
- GitHub OAuth App for GitHub login/signup (optional if using email/password only)
- GitHub App for repository governance
- Resend account and verified sender for password-reset email
- Gemini API key only if using the assistant

## Local setup

1. Install dependencies from the repository root:

   ```powershell
   npm install
   ```

2. Copy `server/.env.example` to `server/.env`. Set `DATABASE_URL`, `DIRECT_URL`, a random `JWT_ACCESS_SECRET` of at least 32 bytes, and `FRONTEND_ORIGIN=http://localhost:5173`.

3. Generate the Prisma client and apply database migrations:

   ```powershell
   npm run db:generate --workspace @haki/server
   npm run db:migrate --workspace @haki/server
   ```

4. Configure the integrations you want to use:

   - **GitHub OAuth:** set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and `GITHUB_OAUTH_REDIRECT_URI` in `server/.env`. Set the OAuth App callback URL to `http://localhost:5173/api/v1/auth/github/callback`.
   - **GitHub App:** set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, and `GITHUB_APP_SLUG` in `server/.env`; set `VITE_GITHUB_APP_SLUG` in `client/.env`. Use `http://localhost:5000/api/v1/github/install/callback` as the local Setup URL.
   - **Password reset:** set `RESEND_API_KEY` and a verified `PASSWORD_RESET_FROM` sender in `server/.env`.
   - **Gemini assistant:** set `GEMINI_API_KEY` in `server/.env`; chat requests use the authenticated backend route and are rate limited.

   Copy `client/.env.example` to `client/.env` for optional frontend settings. Keep real credentials out of source control.

5. Start PostgreSQL and Redis. Redis defaults to `127.0.0.1:6379`; override with `REDIS_HOST` and `REDIS_PORT` if needed.

6. Start the API and frontend in separate terminals:

   ```powershell
   npm run dev:server
   npm run dev:client
   ```

   The frontend is at `http://localhost:5173`; the API is at `http://localhost:5000`.

7. To run background governance validation, start the worker in another terminal:

   ```powershell
   npm run worker:validation --workspace @haki/server
   ```

## Project commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the frontend and API |
| `npm run lint` | Run frontend ESLint |
| `npm test` | Run the API test suite |
| `npm run dev:client` | Start the Vite frontend |
| `npm run dev:server` | Start the API in watch mode |
| `npm run worker:validation --workspace @haki/server` | Start the Redis-backed validation worker |

## Production notes

- Build the frontend with `npm --workspace client run build` and serve it with `npm --workspace client run serve`.
- Deploy the API separately and set `HAKI_API_TARGET` to the API origin for the frontend server.
- Apply schema changes with `npm run db:migrate --workspace @haki/server`.
- Run the validation worker as a separate process with access to the same database and Redis instance.
- Configure the OAuth callback URL and GitHub App Setup URL for the deployed origins.
- Never commit `.env` files, OAuth secrets, GitHub App private keys, Resend keys, or Gemini keys.

## Repository layout

```text
client/   React application, Vite config, and production frontend server
server/   Express API, Prisma schema/migrations, and validation worker
shared/   Shared contracts and schemas
docs/     Project documentation and presentation materials
cli/      HAKI command-line package
```
