-- Faster tab switches: indexes for the lists' filters/sorts, a covering index for client_summary,
-- and a database lookup for user emails (replaces listing every auth user through the Admin API).

-- Lists sorted newest first
create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists expenses_created_at_idx on public.expenses (created_at desc);

-- Pending request lookups on Items, Expenses and their Change Requests tabs
create index if not exists product_requests_status_idx on public.product_deletion_requests (status, created_at desc);
create index if not exists expense_requests_status_idx on public.expense_requests (status, created_at desc);

-- Activity tab filter
create index if not exists activity_log_entity_type_idx on public.activity_log (entity_type, created_at desc);

-- client_summary groups sales by phone; this lets Postgres read the index alone instead of the whole table
create index if not exists sales_client_summary_idx on public.sales (customer_phone, sold_at desc)
  include (customer_name, total_pkr)
  where customer_phone is not null;

-- Emails live in auth.users; only users with manage_users get rows back
create or replace function public.user_emails()
returns table (id uuid, email text)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where (select public.has_permission('manage_users'))
$$;

revoke execute on function public.user_emails() from public, anon;
grant execute on function public.user_emails() to authenticated;
