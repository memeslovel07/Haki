# HAKI CLI

The HAKI CLI connects to the HAKI API for account access, submission governance checks, and review workflows.

## Build and run

From the project root:

```sh
npm install
npm run build --workspace @haki/cli
node cli/dist/index.js help
```

To run it without installing a global command, from the project root:

```sh
npm run cli:build
npm run haki -- help
npm run haki -- status
```

To use `haki` as a direct command after building:

```sh
npm link --workspace @haki/cli
haki help
```

The API defaults to `http://localhost:5000`. Set `HAKI_API_URL` or pass `--api https://your-haki-host` to select another server. Authentication requests send `http://localhost:5173` as their browser origin by default; set `HAKI_FRONTEND_ORIGIN` to match the server's configured `FRONTEND_ORIGIN` when using a different deployment.

## Commands

```text
haki register
haki login [--api <url>]
haki logout
haki whoami
haki init
haki clone <github-repository-url>
haki status
haki add <file...>
haki commit -m "Describe the change"
haki push
haki pull
haki branch
haki log
haki connect
haki repositories
haki branches <repository-id>
haki submissions [repository-id]
haki submission <submission-id>
haki submit <repository-id> --title <text> --source <branch> --target <branch> --base-sha <sha> --head-sha <sha>
haki validate <submission-id>
haki validation <submission-id>
haki request-review <submission-id>
haki reviews <submission-id>
haki review <submission-id> <APPROVED|CHANGES_REQUESTED|REJECTED|COMMENTED> [message]
haki comment <submission-id> <review-id> <file> <line> <message>
```

Use `haki connect` to print the GitHub App installation link. Once installation completes, the CLI can list synchronized repositories and branch heads, create a submission, then run validation and review actions against it.

The local version control commands pass their arguments to the installed Git executable. They work in the current directory and don't require a HAKI account. Use HAKI submission and review commands to send branch commit SHAs through the HAKI governance workflow.

Login credentials are requested interactively. The CLI stores its short-lived access token and refresh cookie in `~/.config/haki/config.json`, with owner-only file and directory permissions. Use `haki logout` to clear the saved credentials.
