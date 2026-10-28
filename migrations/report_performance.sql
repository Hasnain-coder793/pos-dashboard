-- Sales reports timed out (8 s) for 90+ days: the permission checks ran once per row.
-- Wrapping them in (select ...) makes Postgres run each check once per query.

drop policy if exists "read own sales or reports" on public.sales;
create policy "read own sales or reports" on public.sales
  for select to authenticated
  using ((select public.has_permission('view_reports')) or created_by = (select auth.uid()));

drop policy if exists "read sale items of visible sales" on public.sale_items;
create policy "read sale items of visible sales" on public.sale_items
  for select to authenticated
  using (
    (select public.has_permission('view_reports'))
    or exists (select 1 from public.sales s where s.id = sale_id and s.created_by = (select auth.uid()))
  );

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
  and (select public.has_permission('view_reports'))
group by customer_phone;

create or replace function public.sales_item_report(p_from timestamptz, p_to timestamptz)
returns table (product_name text, qty_sold bigint, amount_pkr bigint, order_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select si.product_name, sum(si.qty), sum(si.line_total_pkr), count(distinct s.id)
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.sold_at >= p_from and s.sold_at < p_to
    and (select public.has_permission('view_reports'))
  group by si.product_name
  order by 3 desc
$$;
