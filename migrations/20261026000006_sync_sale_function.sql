-- Inserts a sale, its items and a log row in one transaction.
-- Returns true when inserted, false when the sale id already exists (idempotent).
create function public.sync_sale(payload jsonb)
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
    id, receipt_no, device_id, created_by, cashier_name, total_items,
    total_pkr, cash_received_pkr, change_pkr, status, sold_at
  ) values (
    v_id,
    payload ->> 'receipt_no',
    payload ->> 'device_id',
    (payload ->> 'created_by')::uuid,
    payload ->> 'cashier_name',
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

revoke execute on function public.sync_sale(jsonb) from public, anon;
grant execute on function public.sync_sale(jsonb) to authenticated;
