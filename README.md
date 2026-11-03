# LendTrack Pro

A mobile-first, installable lending recordkeeping app for independent lenders and small businesses in the Philippines, with a premium navy, ivory and emerald visual identity.

## Features
- Borrower directory with phone and notes
- Loan principal, fixed interest amount, dates, and notes
- Partial and full payment recording with date, method, and reference note
- Outstanding balance, overdue list, and monthly collection summary
- Printable loan statement
- CSV exports for loans and payments
- JSON backup and restore
- App shell caching for offline opening after the first successful load
- Premium responsive dashboard, refined navigation, custom app icon and accessible form styling

## Current release status
The premium interface refresh is committed to the `main` branch. The D1 Worker now initializes its database tables automatically on first request. Cloud login and cloud sync are **not yet connected to the browser interface**; the current borrower, loan and payment screens still use device-local storage. Complete the Cloudflare Worker deployment and frontend authentication/sync integration before onboarding customers.

## Important limitations
**This MVP stores all borrower and payment records in this browser/device's local storage.** It has no account login, cloud synchronization, encryption, or multi-device access. Clearing browser data can erase records. Download backups regularly and keep them private. Do not use it for sensitive real customer records on a shared device until authentication and secure cloud storage are implemented.

It is a recordkeeping tool, not legal, lending, or debt-collection advice. Use only lawful, agreed terms and comply with applicable Philippine laws and privacy requirements.

## Run
Open the GitHub Pages site over HTTPS. On Android, open it in Chrome and use the browser menu's **Install app** or **Add to Home screen** option. GitHub Pages can be enabled under repository **Settings → Pages → Deploy from a branch → main → /(root)**.
