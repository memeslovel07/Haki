# HAKI client

The React client uses the HAKI API for account sessions, GitHub repositories, governance submissions, validation results, and reviews.

## Run

1. Start PostgreSQL, Redis, and the API using the root project README.
2. Copy `.env.example` to `.env` and set `VITE_HAKI_API_URL` and `VITE_HAKI_FRONTEND_ORIGIN` to the API and exact browser origin.
3. From this folder run `npm install` and `npm run dev`.

The GitHub App setup link is supplied by the API. Do not place GitHub App secrets or private keys in client environment variables.
