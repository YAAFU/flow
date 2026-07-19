create table if not exists public.flow_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 2,
  state jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.flow_states enable row level security;

create policy "owners can read their flow state"
on public.flow_states for select
using (auth.uid() = user_id);

create policy "owners can insert their flow state"
on public.flow_states for insert
with check (auth.uid() = user_id);

create policy "owners can update their flow state"
on public.flow_states for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "owners can delete their flow state"
on public.flow_states for delete
using (auth.uid() = user_id);

create index if not exists flow_states_updated_at_idx on public.flow_states(updated_at);
