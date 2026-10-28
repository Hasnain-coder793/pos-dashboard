-- Finalized sales. Ids come from the browser so syncing is idempotent.

create table public.sales (
  id uuid primary key,
  receipt_no text not null unique,
  device_id text not null,
  created_by uuid not null references public.profiles (id),
  cashier_name text not null,
  total_items integer not null check (total_items > 0),
  total_pkr integer not null check (total_pkr >= 0),
  cash_received_pkr integer not null check (cash_received_pkr >= total_pkr),
  change_pkr integer not null check (change_pkr >= 0),
  status text not null default 'finalized' check (status = 'finalized'),
  sold_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete restrict,
  product_id uuid references public.products (id),
  product_name text not null,
  unit_price_pkr integer not null check (unit_price_pkr > 0),
  qty integer not null check (qty between 1 and 99),
  line_total_pkr integer not null check (line_total_pkr > 0)
);

create index sales_sold_at_idx on public.sales (sold_at);
create index sale_items_sale_id_idx on public.sale_items (sale_id);
