# GitHub access and submissions setup

## GitHub configuration

- Set `GITHUB_OAUTH_CALLBACK_URL` to the public `/api/v1/auth/github/callback` URL. OAuth requests `read:user user:email repo` so HAKI can list repository metadata visible to the linked user through `GET /api/v1/github/me/repositories`. The access token is AES-GCM encrypted at rest using a key derived from `JWT_ACCESS_SECRET`.
- This user OAuth token is only used to list and link the user's own GitHub repositories. Team repository authorization still requires the separate GitHub App installation and server-side installation checks; an OAuth identity does not authorize a team repository.
- Set `GITHUB_APP_SLUG`, `GITHUB_APP_ID`, and `GITHUB_APP_PRIVATE_KEY_PATH` for the GitHub App.
- Set the GitHub App setup callback URL to `/api/v1/github/installations/callback` and configure its webhook URL as `/api/v1/github/webhooks`.
- Set `GITHUB_WEBHOOK_SECRET` to the webhook secret configured in GitHub. Subscribe to `installation` and `installation_repositories` events.
- Grant the App at least read access to repository contents and metadata. Installation setup checks for contents permission.

Team setup uses `POST /api/v1/github/teams/:teamId/installations/start` as a team owner or admin. After the GitHub App setup callback, connect an accessible repository with `POST /api/v1/github/teams/:teamId/repositories` and `{ "installationId": "…", "repositoryId": "…" }`. Repository settings are available under `/api/v1/github/repositories/:repositoryId/settings`.

GitHub account linking is separate: an authenticated user starts it at `GET /api/v1/auth/github/link` and completes the normal OAuth callback.

## Private patch storage

Production requires `PRIVATE_OBJECT_STORAGE_BUCKET`. Configure `PRIVATE_OBJECT_STORAGE_REGION` and optionally `PRIVATE_OBJECT_STORAGE_ENDPOINT` for an S3-compatible service. The service identity needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on the private bucket. Objects are stored with server-side AES-256 encryption and without public ACLs. Keep the bucket private and block public access. Local development uses `.private-objects/` with owner-only file permissions.

Submit with `POST /api/v1/submissions/repositories/:repositoryId`, an `Idempotency-Key` header, and title, source/target branches, source/base commit SHAs, and patch in the JSON body. The API checks that both branches still point at those commits before persisting the immutable target and patch. Authorized team members can download the patch at `GET /api/v1/submissions/:submissionId/patch`.

Apply the new database migration before starting the updated server with `prisma migrate deploy`.
