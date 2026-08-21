# Gemini Rate-Limit Validation

## Root cause

The managed-preview mutation error at `2026-08-21T21:32:32` was traced to Gemini returning HTTP `429` after the existing retry. A read-only Supabase probe returned HTTP `200`, so the failure occurred before persistence. The live Gemini diagnostic reproduced the provider `429`; this is an external quota/rate-limit condition, not a qualification, database, or client-validation defect.

The provider response identifies the exhausted metric as `generate_content_free_tier_requests`, with a limit of **20 daily requests per project per model** for `gemini-3.6-flash`. Publishing the application does not reset that limit. Qualification will resume only after the provider quota window resets or the Gemini project is moved to a plan or key with sufficient available quota.

## Repair

The Gemini boundary now performs up to three bounded attempts for transient `429` and `5xx` responses. It honours a provider `Retry-After` value up to three seconds when supplied; otherwise it applies a short increasing delay. If the provider remains rate-limited, the client now receives the accurate message: **“The AI assessment service is temporarily busy. Please try again in a moment.”**

The repair does not fabricate an assessment, mark the request as successful, relax the structured-output schema, or expose any credentials. A successful analysis must still complete before Supabase persistence and report rendering occur.

## Validation

The deterministic Gemini suite now verifies that repeated `429` responses are retried three times and yield an explicit `RATE_LIMITED` failure. The complete regression suite passed with 28 tests; one opt-in live Gemini test was skipped by default. TypeScript and the Vercel production build passed.
