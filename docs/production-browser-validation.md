# Production Browser Validation

## Validation Setup

On 21 August 2026, the production application was opened in a fresh cache-busted browser session at `https://seosignal.vercel.app/?production-validation=20260821#qualification-console`. This cleared the prior client-side error state observed before the Vercel serverless bundle remediation.

The temporary test company **SEOSignal Browser Validation** was entered. Browser-restored values are being explicitly re-entered before submission so that the React form state, not merely the browser’s visual autofill, is submitted to the live tRPC endpoint.

The browser confirmed **100% input completeness** after the company and `https://example.com` website values were explicitly committed. The form retains the configured default SEO strategy, USD 5,000 monthly budget, and qualified-leads objective.

The initial browser submission exposed a Vercel function-duration risk, returning a safe user-facing error after the live dependency call exceeded the default execution window. The remediation is deployed in production deployment `dpl_Ex5RWbRj6EWzcL6rcYwd9bHfmYhY` from commit `2b1c482`, which configures `api/[...path].js` with `maxDuration: 60` in `vercel.json`.

In a separate fresh browser session against the new deployment, the temporary lead **SEOSignal Duration Validation** and `https://example.com` were explicitly entered, producing **100% input completeness** before submission.

The subsequent safe error response isolated a persistence defect rather than a browser-rendering fault: the application can show the confidence label `Limited`, while the database accepts `HIGH`, `MEDIUM`, or `LOW`. The first lead insert therefore succeeded but the linked qualification insert was rejected, leaving a temporary orphaned test lead. That test lead was immediately removed, and no linked qualification row existed.

The remediation maps `High`, `Moderate`, and `Limited` report labels to `HIGH`, `MEDIUM`, and `LOW` for storage. It also deletes a just-created lead if the linked qualification insert fails. The persistence test suite now covers both conditions.

The corresponding production deployment is `dpl_FHQz1LwfP5Tc6C1WU6d1Z9PrxZGq` (commit `1b212a7`) and reached the `READY` state. A fresh browser validation session is in progress against that deployment.

In that final fresh session, **SEOSignal Final Browser Validation** was explicitly committed as the company, and the console reached **80% input completeness**. The website field will be explicitly entered before submission so browser-restored visual values do not substitute for application state.

## Final Result

The final form reached **100% input completeness** after `https://example.com` was explicitly entered. Its live submission transitioned through the sequential analysis state and then rendered the complete intelligence report in the browser, including the score, ten-factor signal map, factor table, discovery gaps, recommended next move, and **Download report** control.

The successful browser report persisted both a `leads` row and its linked `qualifications` row in Supabase. The temporary validation lead was then deleted with HTTP `204`; follow-up queries returned empty arrays for both tables, confirming the cascade cleanup. No customer or production lead data was used or retained for this test.

No customer or lead data is used for this validation. Any temporary record created during the test will be removed after its report-rendering and persistence paths are confirmed.
