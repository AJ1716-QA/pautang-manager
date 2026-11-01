# Pautang Manager cloud backend

This is the authentication and per-account cloud-data API for the GitHub Pages PWA.

## Cloudflare setup
1. Create a **new D1 database** named `pautang-manager-db` (do not reuse NegosyoHub's database).
2. In the D1 console, run the complete contents of `schema.sql`.
3. Create a Worker named `pautang-manager-api` and deploy `worker.js`.
4. Add a D1 binding named `DB` pointing to the new database. If using Wrangler, replace the database ID in `wrangler.toml`.
5. Test `https://YOUR-WORKER.workers.dev/api/health`. The app origin is restricted to `https://aj1716-qa.github.io`.

## API
- POST `/api/register` with JSON `{"email":"...","password":"..." }`
- POST `/api/login` with the same shape
- GET/PUT `/api/data` with `Authorization: Bearer <token>`
- POST `/api/logout` with the bearer token

Passwords are PBKDF2-SHA-256 hashed (100,000 iterations) with a per-user random salt. Session tokens are random and only their SHA-256 hashes are stored. Each data record is keyed by the authenticated user ID.

## Important limitations
This first backend stage does not yet include email verification, password-reset email delivery, account deletion, or automated request throttling. Do not treat it as production-ready for sensitive financial or identity data until those controls and the frontend integration have been completed and tested. HTTPS is provided by Cloudflare.
