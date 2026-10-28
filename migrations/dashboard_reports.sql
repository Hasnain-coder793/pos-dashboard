-- Dashboard: customer phone on sales, report helpers, WhatsApp notifications log

-- 0. Catch-up in case 0007/0008 were never applied to this database
alter table public.products add column if not exists image_url text;
alter table public.sales add column if not exists customer_name text;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "anyone reads product images" on storage.objects;
create policy "anyone reads product images" on storage.objects
  for select
  using (bucket_id = 'product-images');

drop policy if exists "managers upload product images" on storage.objects;
create policy "managers upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_permission('manage_products'));

-- 1. Optional customer phone (92XXXXXXXXXX) passed through sync_sale
alter table public.sales
  add column if not exists customer_phone text check (customer_phone ~ '^92[0-9]{10}$');

create index if not exists sales_customer_phone_idx on public.sales (customer_phone);

create or replace function public.sync_sale(payload jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := (payload ->> 'id')::uuid;
begin
  if not public.can_use_pos() then
    raise exception 'User is not allowed to sell';
  end if;

  insert into public.sales (
    id, receipt_no, device_id, created_by, cashier_name, customer_name, customer_phone, total_items,
    total_pkr, cash_received_pkr, change_pkr, status, sold_at
  ) values (
    v_id,
    payload ->> 'receipt_no',
    payload ->> 'device_id',
    (payload ->> 'created_by')::uuid,
    payload ->> 'cashier_name',
    nullif(payload ->> 'customer_name', ''),
    nullif(payload ->> 'customer_phone', ''),
    (payload ->> 'total_items')::int,
    (payload ->> 'total_pkr')::int,
    (payload ->> 'cash_received_pkr')::int,
    (payload ->> 'change_pkr')::int,
    'finalized',
    (payload ->> 'sold_at')::timestamptz
  )
  on conflict (id) do nothing;

  if not found then
    return false;
  end if;

  insert into public.sale_items (sale_id, product_id, product_name, unit_price_pkr, qty, line_total_pkr)
  select
    v_id,
    (item ->> 'product_id')::uuid,
    item ->> 'product_name',
    (item ->> 'unit_price_pkr')::int,
    (item ->> 'qty')::int,
    (item ->> 'line_total_pkr')::int
  from jsonb_array_elements(payload -> 'items') as item;

  insert into public.activity_log (user_id, action, entity_type, entity_id)
  values (auth.uid(), 'sale_created', 'sale', v_id);

  return true;
end;
$$;

-- 2. Totals are computed in Postgres; view_reports check hides them from Admin
create or replace view public.client_summary with (security_invoker = true) as
select
  customer_phone,
  (array_agg(customer_name order by sold_at desc)
     filter (where customer_name is not null))[1] as customer_name,
  count(*)::int          as order_count,
  sum(total_pkr)::bigint as total_spent_pkr,
  max(sold_at)           as last_purchase_at
from public.sales
where customer_phone is not null
  and public.has_permission('view_reports')
group by customer_phone;

create or replace function public.sales_item_report(p_from timestamptz, p_to timestamptz)
returns table (product_name text, qty_sold bigint, amount_pkr bigint, order_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select si.product_name, sum(si.qty), sum(si.line_total_pkr), count(distinct s.id)
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.sold_at >= p_from and s.sold_at < p_to
    and public.has_permission('view_reports')
  group by si.product_name
  order by 3 desc
$$;

-- 3. One row per WhatsApp send attempt
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid not null references public.profiles (id),
  customer_phone text not null,
  customer_name text,
  message text not null,
  status text not null check (status in ('accepted', 'failed')),
  provider_message_id text,
  provider_error text,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "senders read notifications" on public.notifications;
create policy "senders read notifications" on public.notifications
  for select to authenticated using (public.has_permission('send_notifications'));

drop policy if exists "senders insert notifications" on public.notifications;
create policy "senders insert notifications" on public.notifications
  for insert to authenticated
  with check (public.has_permission('send_notifications') and sent_by = auth.uid());

revoke update, delete on public.notifications from anon, authenticated;
