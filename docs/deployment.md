# Deployment Notes

## Managed deployment

The project currently runs in the managed Node environment supplied with the workspace. Create a checkpoint and use the Publish control for the integrated managed deployment.

## Vercel

The request includes Vercel deployment. Vercel can host this application only after adapting the existing Express process into a Vercel serverless entry point or moving the API to a compatible serverless route. The current repository is a long-running Express/tRPC application, not a static site or Next.js server route. Therefore, publishing it to Vercel without that adapter would risk a non-functional API.

For a Vercel deployment, preserve the following guarantees:

1. Put `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ACCESS_TOKEN` in Vercel’s server-only environment variables.
2. Never prefix server secrets with `VITE_` or `NEXT_PUBLIC_`.
3. Add an explicit serverless handler and use a Vercel-compatible build configuration before connecting the GitHub repository to Vercel.
4. Apply the database schema through Supabase before sending live traffic.

The supplied Vercel MCP configuration does not currently expose an authorized server for this project, so no external deployment has been claimed or attempted.
