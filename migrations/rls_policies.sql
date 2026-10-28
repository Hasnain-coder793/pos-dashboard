alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.products enable row level security;
alter table public.product_deletion_requests enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.activity_log enable row level security;

-- profiles
create policy "read own profile or manage users" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('manage_users'));

create policy "manage users can update profiles" on public.profiles
  for update to authenticated
  using (public.has_permission('manage_users'))
  with check (public.has_permission('manage_users'));

-- role_permissions
create policy "authenticated can read permissions" on public.role_permissions
  for select to authenticated using (true);

create policy "super admin manages permissions" on public.role_permissions
  for all to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- products: POS sees active only, managers see everything
create policy "read active products" on public.products
  for select to authenticated
  using ((is_active and deleted_at is null) or public.has_permission('manage_products'));

create policy "managers insert products" on public.products
  for insert to authenticated
  with check (public.has_permission('manage_products'));

create policy "managers update products" on public.products
  for update to authenticated
  using (public.has_permission('manage_products'))
  with check (public.has_permission('manage_products'));

-- product_deletion_requests
create policy "managers read deletion requests" on public.product_deletion_requests
  for select to authenticated
  using (public.has_permission('manage_products'));

create policy "managers create deletion requests" on public.product_deletion_requests
  for insert to authenticated
  with check (public.has_permission('manage_products') and requested_by = auth.uid());

create policy "super admin decides deletion requests" on public.product_deletion_requests
  for update to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- sales: insert only, never update or delete
create policy "sellers insert sales" on public.sales
  for insert to authenticated
  with check (public.can_use_pos());

create policy "read own sales or reports" on public.sales
  for select to authenticated
  using (created_by = auth.uid() or public.has_permission('view_reports'));

create policy "sellers insert sale items" on public.sale_items
  for insert to authenticated
  with check (public.can_use_pos());

create policy "read sale items of visible sales" on public.sale_items
  for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

revoke update, delete on public.sales, public.sale_items from anon, authenticated;

-- activity_log
create policy "users write own log rows" on public.activity_log
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "reports read log" on public.activity_log
  for select to authenticated
  using (public.has_permission('view_reports'));
