-- Products (soft delete only) and deletion requests

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_pkr integer not null check (price_pkr > 0),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create type public.request_status as enum ('pending', 'approved', 'rejected');

create table public.product_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  requested_by uuid not null references public.profiles (id),
  reason text not null default '',
  status public.request_status not null default 'pending',
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
