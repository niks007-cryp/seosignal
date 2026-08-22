# Groq Provider Migration Validation

## Scope

The active assessment provider has moved from Gemini to the Groq OpenAI-compatible Chat Completions API using `openai/gpt-oss-20b`. The migration is limited to the server-side AI boundary. The React design, lead contract, homepage inspection, Zod validation, deterministic scoring, Supabase persistence, report, currency handling, and PDF export paths are unchanged.

## Secure credential handling

`GROQ_API_KEY` was added through secure project settings and validated with a server-side request to Groq’s models endpoint. The key is not present in client code, repository files, logs, or commits.

## Provider contract

The Groq request uses `POST /openai/v1/chat/completions`, bearer authorization, `openai/gpt-oss-20b`, and `response_format.type = json_schema` with strict schema mode. Groq supports strict structured output on this model, and SEOSignal still Zod-validates the returned JSON before deterministic scoring.

## Local verification

| Check | Result |
| --- | --- |
| Groq credential smoke test | Passed without exposing the credential. |
| Opt-in Groq structured-output test | Passed with a Zod-validated ten-factor assessment. |
| Local end-to-end qualification | Returned HTTP 200 for a clearly labelled test lead; the completed report was returned only after the existing Supabase persistence call succeeded. |
| Deterministic suite | 28 tests passed; one opt-in external integration test is skipped by the default suite. |
| TypeScript and production build | Passed. |
| Vercel deployment | **Not initiated**, per requirement. |
