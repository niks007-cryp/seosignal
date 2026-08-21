# Testing and Validation

## Automated coverage

| Area | Validation |
| --- | --- |
| Form contract | Incomplete tRPC input is rejected. |
| Currency | Locale formatting preserves the selected currency without conversion. |
| Scoring | Published thresholds, weighted scoring, timeline caps, budget caps, and ICP caps are deterministic. |
| ICP configuration | Configured non-prospect markers reduce the final result; configured target-profile evidence improves an unknown ICP factor. |
| Website inspection | Private-network hostnames return `UNAVAILABLE` without a network fetch. |
| Gemini | A guarded credential check and opt-in live structured-output integration test verify the provider path. |
| Supabase | Credential and Management API checks verify the project connection; schema availability is confirmed through REST. |

## Live validation

An explicitly labelled **SEOSignal Internal Validation** test lead was submitted with `example.com`, a USD 5,000 budget, a United States market, a 30–90 day timeline, and a technical-migration use case. The app entered its analyzing state, returned a valid report, and persisted linked lead and qualification records. The record was then removed from Supabase to avoid retaining test data in the production database.

## Manual checks before launch

1. Submit one genuine lead with a reachable website and confirm evidence is not invented.
2. Submit an unreachable public URL and confirm the report identifies unavailable website context without failing.
3. Select each supported currency and confirm the report and PDF show that currency exactly.
4. Download the report and inspect multipage PDF pagination.
5. Test keyboard navigation, focus states, and 320px mobile layout.

## Release-source audit

The shipped client source contains no Gemini or Supabase service-role credentials and no user-visible platform branding. The hero uses a managed static-storage URL whose technical path includes `manus-storage`; this is the required asset-delivery transport in the managed workspace, not rendered copy, branding, or a user-visible identifier.
