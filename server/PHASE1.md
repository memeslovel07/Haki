# Phase 1: Team management API

All routes are under `/api/v1/teams` and require a HAKI bearer access token. Team IDs and user IDs are UUIDs. Membership is isolated by team ID and checked by the API on every request.

## Routes

- `POST /` `{ name }` creates a team, default settings, and the authenticated user as its active owner.
- `GET /` lists the caller's active teams.
- `GET /:teamId` reads team details; `GET /:teamId/members` lists membership records.
- `POST /:teamId/invitations` `{ email, role? }` invites an existing HAKI account. Pending invitations expire after seven days. `GET /invitations` lists the caller's pending invitations; `POST /invitations/:invitationId/respond` `{ accept }` accepts or declines one.
- `DELETE /:teamId/members/:userId` removes a member; `POST /:teamId/leave` leaves a team.
- `PATCH /:teamId/members/:userId/role` `{ role }` changes a role; `POST /:teamId/ownership` `{ userId }` transfers ownership.
- `GET /:teamId/settings` reads settings; `PUT /:teamId/settings` updates any supplied settings.

## Authorization

| Role | Read team and members | Invite/remove members | Change roles | Settings | Transfer ownership |
| --- | --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Read/write | Yes |
| Admin | Yes | Yes, except owners/admins; can invite Developer/Reviewer | Can assign Developer/Reviewer only | Read/write | No |
| Developer | Yes | No | No | Read only | No |
| Reviewer | Yes | No | No | Read only | No |

Team settings default to `defaultBranch: "main"`, `requireReviews: true`, and `requiredApprovals: 1`. Ownership changes and membership removal/leave lock the team row in a transaction. A request that would leave zero active owners is rejected. Sensitive membership and settings changes create audit events.

Request, response, role, and settings Zod schemas are exported from `@haki/schemas`.

## Database

Apply the new additive migration in `prisma/migrations/20261126140000_team_management_github_repo_access` after reconciling the target database's migration history. The GitHub OAuth credential table stores only AES-GCM ciphertext; encryption derives a key from `JWT_ACCESS_SECRET`, so rotating that secret requires users to reconnect GitHub.
