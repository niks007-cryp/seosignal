# SEOSignal

SEOSignal is an **AI-assisted inbound SEO lead-qualification application**. It evaluates a submitted company, public website, requested SEO service, monthly budget and selected currency, business goal, and optional market/timeline/challenge context. The result is an evidence-led report with factor analysis, a deterministic 0–100 framework score, `HIGH`/`MEDIUM`/`LOW` qualification, missing information, and a recommended next action.

> **Important:** SEOSignal is a decision-support prototype, not a conversion-probability model. Gemini provides bounded structured factor evidence; the application independently calculates the returned score, classification, confidence, and applicable hard-disqualifier caps.

## Implemented workflow

1. The browser validates the lead form and normalizes a bare domain to HTTPS when appropriate.
2. The server validates the input, performs a lightweight inspection of only the submitted public homepage, and continues with an `UNAVAILABLE` status if inspection cannot be completed.
3. Gemini receives the lead plus bounded inspection evidence and returns structured factor ratings, reasoning, missing-information suggestions, and a next-best action.
4. Zod validates the AI output. Configured factors, rating values, thresholds, ICP screening, and hard-disqualifier caps determine the final score and qualification.
5. The report is saved in linked Supabase `leads` and `qualifications` records, rendered in the browser, and may be downloaded as a client-generated PDF.

## Assessment scope

The configured framework has ten factors: service fit (20%), ICP/company fit (15%), budget fit (15%), market fit (10%), business-objective fit (10%), SEO use-case fit (10%), timeline fit (5%), buying intent (5%), goal clarity (5%), and information completeness (5%). Factor ratings map to `STRONG=100`, `MODERATE=65`, `WEAK=25`, and `UNKNOWN=45`; the weighted result is rounded and subject to applicable score caps.

| Qualification | Score range |
| --- | ---: |
| `HIGH` | 75–100 |
| `MEDIUM` | 50–74 |
| `LOW` | 0–49 |

Amounts and currencies are stored separately. The product supports USD, EUR, GBP, INR, CAD, AUD, SGD, AED, CHF, and JPY. **No currency conversion is performed.**

## Environment configuration

Configure secrets through secure deployment environment-variable controls; do not commit them to source control.

| Variable | Required | Used by | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server only | Authenticates the Gemini structured-output request. |
| `GEMINI_MODEL` | Optional | Server only | Overrides the configured default, `gemini-3.6-flash`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Server persistence code | Supabase project URL; the REST suffix is accepted or derived. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Writes linked lead and qualification rows through Supabase REST. Never expose it in the browser. |
| `SUPABASE_ACCESS_TOKEN` | Setup/migration only | Server-side operational workflow | Used to apply or manage the Supabase schema when required. |

## Database and deployment

[`database/schema.sql`](database/schema.sql) defines PostgreSQL/Supabase `leads` and `qualifications` tables. A qualification references its lead with `ON DELETE CASCADE`; generated evidence structures are stored in JSONB fields. The current Vercel configuration builds the client to `dist/public` and bundles the Express/tRPC server into a 60-second catch-all API function.

## Quality checks

```bash
pnpm check
pnpm test
GEMINI_INTEGRATION_TEST=true pnpm vitest run server/geminiQualification.integration.test.ts
```

The live Gemini test is opt-in because it calls the configured external model. The default suite is deterministic.

## Documentation

- [Technical & Assessment Documentation](docs/SEOSignal-Technical-Documentation.md)
- [Architecture](docs/architecture.md)
- [Runtime flow](docs/flow.md)
- [Deployment notes](docs/deployment.md)
- [Testing and validation](docs/testing.md)
