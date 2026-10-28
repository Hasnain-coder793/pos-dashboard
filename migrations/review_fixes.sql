-- Review fixes: sales integrity, sign-up hole, audit forgery, upload limits, request names and snapshots

-- 1. Sales are written only through sync_sale(); direct inserts let any seller add items to any existing sale
drop policy if exists "sellers insert sales" on public.sales;
drop policy if exists "sellers insert sale items" on public.sale_items;
revoke insert on public.sales, public.sale_items from anon, authenticated;

-- 2. The signed-in user is the cashier, and totals must match the items
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
    auth.uid(),
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

  -- raising here rolls back the whole sale
  if exists (select 1 from public.sale_items where sale_id = v_id and line_total_pkr <> unit_price_pkr * qty)
     or (select sum(line_total_pkr) from public.sale_items where sale_id = v_id) is distinct from (payload ->> 'total_pkr')::int
     or (select sum(qty) from public.sale_items where sale_id = v_id) is distinct from (payload ->> 'total_items')::int
     or (payload ->> 'change_pkr')::int <> (payload ->> 'cash_received_pkr')::int - (payload ->> 'total_pkr')::int then
    raise exception 'Sale totals do not match its items';
  end if;

  insert into public.activity_log (user_id, action, entity_type, entity_id)
  values (auth.uid(), 'sale_created', 'sale', v_id);

  return true;
end;
$$;

-- 3. Accounts from public sign-up stay inactive; the dashboard and the super admin script activate their own users
alter table public.profiles alter column is_active set default false;

-- 4. Users may still log their own events, but not the ones written by triggers and functions
drop policy if exists "users write own log rows" on public.activity_log;
create policy "users write own log rows" on public.activity_log
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and action not in ('sale_created', 'product_created', 'product_updated', 'product_deleted',
                       'request_created', 'request_approved', 'request_rejected')
  );

-- 5. Enforce the 2 MB and jpg/png/webp limits on the server, not only in the form
update storage.buckets
set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'product-images';

-- 6. Admin can read the names of people who requested or decided a change
create policy "managers read request people" on public.profiles
  for select to authenticated
  using (
    public.has_permission('manage_products')
    and exists (
      select 1 from public.product_deletion_requests r
      where r.requested_by = profiles.id or r.decided_by = profiles.id
    )
  );

-- 7. Snapshot of the product when the request was made, so decided requests still show the old values
alter table public.product_deletion_requests add column old_values jsonb;

create function public.set_request_old_values()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.old_values := (
    select jsonb_build_object('name', name, 'price_pkr', price_pkr, 'image_url', image_url)
    from public.products where id = new.product_id
  );
  return new;
end;
$$;

create trigger requests_set_old_values
  before insert on public.product_deletion_requests
  for each row execute function public.set_request_old_values();
