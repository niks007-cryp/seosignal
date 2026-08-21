create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website text not null,
  service text not null,
  budget_amount numeric(14, 2) not null check (budget_amount > 0),
  budget_currency text not null check (budget_currency in ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'AED', 'CHF', 'JPY')),
  goal text not null,
  target_market text,
  timeline text,
  current_situation text,
  website_inspection_status text not null check (website_inspection_status in ('AVAILABLE', 'UNAVAILABLE')),
  created_at timestamptz not null default now()
);

create table if not exists public.qualifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  qualification text not null check (qualification in ('HIGH', 'MEDIUM', 'LOW')),
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('HIGH', 'MEDIUM', 'LOW')),
  reasoning text not null,
  factors jsonb not null,
  missing_information jsonb not null,
  next_best_action jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists qualifications_lead_id_idx on public.qualifications(lead_id);
create index if not exists qualifications_created_at_idx on public.qualifications(created_at desc);
