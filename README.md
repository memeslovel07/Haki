# HAKI version control and code governance

HAKI connects GitHub repositories to a shared workspace, records branch submissions, runs security and policy validation, and manages reviewer decisions. The React client, Express API, and `haki` command line client use the same authenticated API.

## Local setup

Requirements: Node.js 20.12+, PostgreSQL, and Redis.

1. Copy `server/.env.example` to `server/.env`. Set `DATABASE_URL`, `DIRECT_URL`, and a base64url `JWT_ACCESS_SECRET` that decodes to at least 32 bytes.
2. Configure a GitHub OAuth App for sign-in. Set its callback to `http://localhost:5000/api/v1/auth/github/callback`, then fill in `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
3. Configure a GitHub App with repository **Contents: read-only** permission and Subscribe to the `installation` and `installation_repositories` webhook events. Set its Setup URL to `http://localhost:5000/api/v1/github/setup`, its webhook URL to `http://localhost:5000/api/v1/github/webhook`, and copy its App ID, slug, private key path, and webhook secret into `server/.env`. Set a separate random `GITHUB_APP_STATE_SECRET`.
4. Copy `client/.env.example` to `client/.env`. Keep `VITE_HAKI_API_URL=http://localhost:5000` and set `VITE_HAKI_FRONTEND_ORIGIN` to the exact origin Vite prints (normally `http://localhost:5173`). Set the same value as `FRONTEND_ORIGIN` in `server/.env`.
5. Install packages from the project root with `npm install`.
6. Generate the Prisma client and apply migrations from the `server` folder: `npx prisma generate --config prisma7.config.ts` and `npx prisma migrate deploy --config prisma7.config.ts`.
7. Start Redis, then start the API (`npm run dev` in `server`) and web client (`npm run dev` in `client`) in separate terminals. Start the validation worker in another server terminal with `npm run worker:validation`.

The API expects the database schema to be migrated before start. The validation worker needs the GitHub App key, GitHub repository Contents read permission, Redis, and the configured scanners described in the server modules.

## Web workflow

Sign in, choose **Connect GitHub**, and install the HAKI GitHub App on the account or organization that owns the repositories. GitHub sends the user through the configured Setup URL; HAKI verifies the signed setup state and synchronizes the accessible repositories. The dashboard then lists connected repositories. Open one, choose source and target branches, create a submission, run validation, request review, then record a review decision or inline comment.

## CLI

Build it from the project root with `npm run cli:build`. To run it without a global install, use `npm run haki -- help` or `npm run haki -- status`. To use `haki` as a direct command, build and run `npm link --workspace @haki/cli`, then use `haki help`. Local Git commands such as `haki status`, `haki add`, `haki commit`, and `haki push` pass through to Git in the current folder. HAKI-specific repository and governance commands require the API and account login. The CLI defaults to `http://localhost:5000`; set `HAKI_API_URL` for another API and `HAKI_FRONTEND_ORIGIN` to match the API's configured `FRONTEND_ORIGIN`.

Common commands:

```sh
npm run haki -- status
haki add .
haki commit -m "Harden upload checks"
haki push
haki connect
haki repositories
haki branches <repository-id>
haki submit <repository-id> --title "Harden upload checks" --source feature/security --target main --base-sha <sha> --head-sha <sha>
haki validate <submission-id>
haki request-review <submission-id>
```

With the globally linked command, the HAKI governance flow looks like:

```sh
haki register
haki login
haki connect
haki repositories
haki branches <repository-id>
haki submissions [repository-id]
haki validate <submission-id>
haki validation <submission-id>
haki request-review <submission-id>
haki reviews <submission-id>
haki review <submission-id> APPROVED "Looks good"
```

Login requests the password interactively. The CLI keeps access and refresh credentials in `~/.config/haki/config.json` with owner-only permissions. `haki logout` revokes the refresh session and removes this file.

## API routes

All paths are under `/api/v1`.

| Route | Purpose |
| --- | --- |
| `GET /health` | API health |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Account sessions |
| `GET /auth/github`, `GET /auth/github/callback` | GitHub sign-in |
| `GET /github/install-url`, `GET /github/setup`, `POST /github/webhook` | GitHub App connect and repository sync |
| `GET /repositories`, `GET /repositories/:repositoryId`, `GET /repositories/:repositoryId/branches` | Connected repos and branch heads |
| `GET /submissions`, `POST /submissions`, `GET /submissions/:submissionId` | Create and inspect submissions |
| `POST /submissions/:submissionId/validate`, `GET /submissions/:submissionId/validation` | Governance runs |
| `POST /submissions/:submissionId/request-review`, `GET /submissions/:submissionId/reviews`, `POST /submissions/:submissionId/reviews` | Review lifecycle |
| `POST /submissions/:submissionId/reviews/:reviewId/comments` | Inline review comment |

Protected routes require `Authorization: Bearer <access-token>`. GitHub App webhook requests are HMAC SHA-256 verified against the raw request body.
