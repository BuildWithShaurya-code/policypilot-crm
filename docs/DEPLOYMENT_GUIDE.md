# Deployment guide

Live application: https://policypilot-business.vercel.app

## 1. Prepare Supabase

Use a development project for experiments. To provision a new database, review and apply the files in `supabase/migrations/` in timestamp order using Supabase's SQL Editor or migration tooling. For an existing project, compare the applied migration history and apply only missing migrations. Do not rerun the full schema or reset a business database.

Obtain the project URL and publishable key from Supabase. Keep service-role or secret keys out of the browser and repository. Verify Row Level Security and ownership constraints before adding customer data.

## 2. Configure authentication

In Supabase Auth URL Configuration, set the Site URL to the deployment's HTTPS origin and add the exact redirect URLs used by the application. Add localhost URLs separately for development. Enable the desired email-confirmation settings and test them with a mailbox you control.

Production application access also requires `APP_ALLOWED_EMAILS`, a comma-separated list of approved account emails. Every team member needs their own account. Portfolios remain separate; approval does not create shared access to another member's customers.

## 3. Configure Vercel

Import the GitHub repository, use the Next.js preset, and keep the root directory at the repository root. `vercel.json` supplies the install and build commands.

Set these environment variables directly in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_ALLOWED_EMAILS`
- `AUTOMATION_SECRET_KEY`, when using the automation endpoint

Configure optional privileged or provider keys only when needed. Generate a strong new automation secret for production. Scope production and preview variables intentionally; do not let an untrusted preview operate on business data.

Redeploy after changing build-time public variables. Keep `.env*`, `.vercel/`, database exports, screenshots containing customer data, and authentication state out of GitHub.

Choose a hosting plan whose terms allow the intended business use. This repository does not authorize or perform any paid plan upgrade.

## 4. Verify the deployment

Run the local quality checks before release:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

After deployment, check `/api/health`; a successful response verifies configured database access, not every application workflow. Test signup and real email confirmation, approved and unapproved logins, logout, page refresh, and all relevant CRM workflows with labelled disposable records.

Check isolation with two accounts, including attempts to read or modify each other's records. Review delete/reset behavior before using it with business data. Verify frontend and server logs without exposing credentials.

## 5. Messaging and operation

The current deployment uses simulated messaging. Do not promise email, WhatsApp, or call delivery until an actual provider integration and delivery test have succeeded.

Vercel deploys application code; it does not apply these database migrations automatically. Coordinate schema changes separately, keep a tested rollback plan, and maintain database backups appropriate to the hosting plan.

The source release does not contain customer records or a public demo account. Historical local testing evidence is excluded because it may contain private details.
