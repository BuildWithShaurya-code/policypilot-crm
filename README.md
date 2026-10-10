<div align="center">

# PolicyPilot

**An insurance CRM that keeps customers, policies, renewals, and follow-ups in one place.**

[![Next.js](https://img.shields.io/badge/Next.js-16-111827?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Hosted_on-Vercel-000000?logo=vercel)](https://policypilot-business.vercel.app)

[**Open live website**](https://policypilot-business.vercel.app) · [Sign in](https://policypilot-business.vercel.app/login) · [Setup guide](docs/DEPLOYMENT_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md)

</div>

---

## Overview

PolicyPilot helps insurance professionals manage their daily portfolio work: maintain customer records, track policy expiry dates, organize renewal stages, schedule follow-ups, and import existing spreadsheets.

The source code is public. The deployed business application requires an approved account; customer data and login credentials are not part of this repository. Each account has its own portfolio. A shared team workspace is not implemented.

## Features

| Area | Capabilities |
| --- | --- |
| Dashboard | Portfolio metrics, upcoming renewals, and follow-up priorities |
| Customers | Searchable customer directory, contact details, and linked policies |
| Policies | Policy creation and editing, premiums, expiry dates, and renewal tracking |
| Renewals | Renewal stages and completion workflow with calendar-safe date handling |
| Follow-ups | Scheduled tasks, overdue indicators, completion, and activity history |
| Spreadsheet import | CSV/XLSX uploads, column mapping, validation, duplicate checks, and error reporting |
| Reports | Portfolio breakdowns and downloadable reports |
| Settings | Account preferences, password changes, and notification preferences |
| Access control | Supabase sessions, a server-side email allowlist, and database ownership policies |

**Messaging status:** the deployed email automation is simulated. WhatsApp, calling, and actual email delivery have not been verified as complete integrations. A simulated sent record does not confirm delivery to a mailbox.

## Technology

- **Application:** Next.js 16 App Router with React 19 and TypeScript.
- **Styling:** Tailwind CSS 4, custom CRM styles, and Lucide icons.
- **Backend:** Next.js route handlers and Supabase client libraries.
- **Database and identity:** Supabase PostgreSQL, Auth, and Row Level Security.
- **Spreadsheet processing:** SheetJS 0.20.3, pinned to the publisher's distribution.
- **Hosting:** Vercel, with configuration included in `vercel.json`.

## Run locally

Use Node.js 22 or newer and npm. You also need a Supabase project with the repository's schema applied.

```bash
git clone https://github.com/BuildWithShaurya-code/policypilot-crm.git
cd policypilot-crm
npm ci
```

Copy `.env.example` to `.env.local`, then fill in your own configuration:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
APP_ALLOWED_EMAILS=owner@example.com,teammate@example.com
AUTOMATION_SECRET_KEY=your-strong-random-server-secret
```

Do not use a Supabase service-role key as a browser key. Keep every real environment file out of version control.

Apply the SQL migrations in `supabase/migrations/` in timestamp order to a new development database. Follow the [deployment guide](docs/DEPLOYMENT_GUIDE.md) for database and authentication configuration. Do not reset an existing business database to install this project.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create and confirm an account in your development Supabase project, then sign in. In production, the account's email must also be listed in `APP_ALLOWED_EMAILS`.

## Environment variables

| Variable | Purpose | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL | Required; browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable client key | Required; browser and server |
| `APP_ALLOWED_EMAILS` | Comma-separated approved login emails | Required in production; server only |
| `AUTOMATION_SECRET_KEY` | Authorization secret for the daily-summary endpoint | Required when invoking automation; server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged administrative operations | Optional for normal CRM use; server only |
| `RESEND_API_KEY` | Optional email provider configuration | Server only; live delivery needs separate verification |

Production access fails closed when the allowlist is empty. The allowlist restricts application access; database Row Level Security separately controls record ownership.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

The committed regression suites cover date handling, import validation, duplicate matching, API error handling, pagination, and private access rules. They run without production credentials. They do not replace browser testing against a configured database.

Prior to publication, the project was exercised in a real browser, including customer and policy workflows, renewals, follow-ups, spreadsheet imports, responsive views, and account-isolation checks. Private test reports and database fixtures are intentionally excluded from the public source release.

## Project structure

```text
src/
  app/                Pages and API route handlers
  components/         CRM views, forms, dialogs, and layout
  context/            Authentication and application state
  lib/                Validation, business services, and Supabase clients
  types/              Domain and database types
scripts/              Portable regression suites
supabase/migrations/  Versioned database schema and security changes
docs/                 Architecture and deployment documentation
```

## Deploy on Vercel

The current live application is [policypilot-business.vercel.app](https://policypilot-business.vercel.app).

For your own deployment:

1. Import this repository into Vercel and choose the Next.js framework preset.
2. Configure the environment variables for the intended environment. Keep privileged keys server-side.
3. Deploy, then configure Supabase Auth's Site URL and redirect URLs for your exact deployment domain.
4. Confirm a real signup email, test sign-in with an approved account, and re-check `/api/health`.
5. Use a hosting plan permitted for your intended business use.

The included configuration uses `npm ci` and `npm run build`. Database migrations are managed separately and are not automatically applied by a Vercel build.

## Current boundaries

- Live signup confirmation, deployed account login, and authentication redirect configuration still require the account owner's final verification.
- Accounts have separate portfolios; adding approved teammates does not automatically share customer records.
- Messaging delivery is simulated in the current deployment.
- Customer records, environment secrets, database tooling state, and historical demo credentials are excluded from this source release.

## Ownership

Built and maintained by [BuildWithShaurya-code](https://github.com/BuildWithShaurya-code). This repository currently has no open-source license; public visibility does not grant a separate license to reuse the code.
