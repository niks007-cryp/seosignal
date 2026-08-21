# Runtime Flow

```mermaid
sequenceDiagram
  participant U as User
  participant C as SEOSignal UI
  participant A as tRPC server
  participant W as Homepage inspector
  participant G as Gemini
  participant S as Supabase

  U->>C: Submit lead and currency context
  C->>A: qualification.analyze(lead)
  A->>A: Validate required fields and URL
  A->>W: Fetch public homepage only
  W-->>A: AVAILABLE metadata/text or UNAVAILABLE
  A->>G: Request schema-constrained analysis
  G-->>A: JSON factor assessment
  A->>A: Zod-validate; apply configured scoring and caps
  A->>S: Insert lead then linked qualification
  S-->>A: Persisted IDs
  A-->>C: Validated report
  C-->>U: Report, signal map, and PDF export
```

## Error behavior

| Situation | User-facing behavior | Data behavior |
| --- | --- | --- |
| Invalid company or website | Inline form error | No request is stored. |
| Homepage unavailable | Analysis continues with `UNAVAILABLE` context | Inspection status is saved. |
| Gemini network failure or invalid structured output | “Unable to complete the qualification right now. Please try again.” | No partial qualification is reported. |
| Supabase write failure | Same safe retry message | The report is not presented as persisted. |

The analysis view uses the exact succinct state **“Analyzing lead”** and the description **“Evaluating fit, intent, budget and business need.”** It does not use a generic spinner.
