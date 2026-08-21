# SEOSignal

SEOSignal is an **AI-assisted inbound SEO lead qualification** application. It turns a submitted company, website, service requirement, commercial context, and business goal into an evidence-led qualification report. The application preserves currency context, inspects only the submitted public homepage, uses server-side Gemini structured output, and stores validated results in Supabase.

> **Implementation note.** This repository is built on the existing React 19, Vite, Express, and tRPC foundation supplied with the project. It does not misrepresent that foundation as a Next.js application. The application can be deployed behind any Node-compatible deployment target once the environment variables below are supplied.

## Production workflow

1. A user enters the lead form, including budget amount and explicitly selected currency.
2. The server validates the input and safely fetches the submitted public homepage. Private-network addresses are rejected; unavailable pages produce an `UNAVAILABLE` inspection state rather than an error.
3. Gemini returns a JSON-only structured assessment for ten factors.
4. Zod validates Gemini’s response. The server then applies explicit configured weights, thresholds, ICP screening, and hard-disqualifier caps.
5. The user receives a report with evidence, uncertainty, recommended next action, currency-preserving budget context, and downloadable PDF.
6. The validated lead and qualification are written to Supabase as a linked record.

## Environment configuration

Secrets must be configured through the deployment platform’s secure environment-variable controls, never committed to source control.

| Variable | Required | Server/browser | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server only | Authenticates the Gemini structured-output request. |
| `GEMINI_MODEL` | Optional | Server only | Overrides the central default, currently `gemini-3.6-flash`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Server only in the current implementation | Supabase project URL. The server accepts either the origin or an origin ending in `/rest/v1/`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Available for future browser-only Supabase features | Browser | Not used by the current assessment write path. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Writes leads and qualifications through Supabase REST. Never expose it to the browser. |
| `SUPABASE_ACCESS_TOKEN` | Setup only | Server-side migration workflow | Supabase Management API token with `database_write` permission, used to apply `database/schema.sql`. |

This managed environment prohibits committing `.env` or `.env.example` files. The table above is the repository-safe environment contract; use the platform secret manager to supply the values.

## Database

The production schema is in [`database/schema.sql`](database/schema.sql). It defines:

- `leads` for submitted company and commercial context, including separate `budget_amount` and `budget_currency` fields.
- `qualifications` for the generated score, factor evidence, missing information, recommended next action, model identifier, and timestamps.
- A one-to-many relationship from leads to qualifications, preserving future reassessment history.

The schema is idempotent and was applied through the authenticated Supabase Management API during integration validation.

## Quality checks

```bash
pnpm check
pnpm test
GEMINI_INTEGRATION_TEST=true pnpm vitest run server/geminiQualification.integration.test.ts
```

The live Gemini test is explicitly opt-in because it calls the configured external model. All other tests are deterministic and do not create records or spend model quota.

## Documentation

- [Architecture](docs/architecture.md)
- [Runtime flow](docs/flow.md)
- [Deployment notes](docs/deployment.md)
- [Testing and validation](docs/testing.md)
- [Integration sources](docs/integration-sources.md)
