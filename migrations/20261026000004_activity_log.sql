create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id),
  action text not null,
  entity_type text check (entity_type in ('sale', 'product', 'deletion_request')),
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_created_at_idx on public.activity_log (created_at);
