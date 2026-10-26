-- Dashboard: permissions, item change requests with approval, audit triggers, image rules

-- 1. Permissions (admin must never get view_reports)
insert into public.role_permissions (role, permission, allowed) values
  ('super_admin', 'manage_users', true),
  ('super_admin', 'manage_products', true),
  ('super_admin', 'view_reports', true),
  ('super_admin', 'send_notifications', true),
  ('admin', 'manage_products', true),
  ('admin', 'view_reports', false)
on conflict (role, permission) do update set allowed = excluded.allowed;

-- 2. Only Super Admin updates products; Admin keeps insert
drop policy if exists "managers update products" on public.products;

create policy "super admin updates products" on public.products
  for update to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- 3. Requests support update and delete; the table name stays for compatibility
create type public.product_request_type as enum ('update', 'delete');

alter table public.product_deletion_requests
  add column request_type public.product_request_type not null default 'delete',
  add column new_name text,
  add column new_price_pkr integer check (new_price_pkr > 0),
  add column new_image_url text,
  add column decision_note text,
  add constraint update_has_change check (
    request_type = 'delete'
    or new_name is not null or new_price_pkr is not null or new_image_url is not null
  );

create unique index one_pending_request_per_product
  on public.product_deletion_requests (product_id) where status = 'pending';

drop policy if exists "managers create deletion requests" on public.product_deletion_requests;
create policy "managers create pending requests" on public.product_deletion_requests
  for insert to authenticated
  with check (
    public.has_permission('manage_products')
    and requested_by = auth.uid()
    and status = 'pending' and decided_by is null and decided_at is null and decision_note is null
  );

-- requests are decided only through decide_product_request()
drop policy if exists "super admin decides deletion requests" on public.product_deletion_requests;
revoke update, delete on public.product_deletion_requests from anon, authenticated;

create function public.decide_product_request(p_request_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.product_deletion_requests;
begin
  if public.current_user_role() is distinct from 'super_admin' then
    raise exception 'Only Super Admin can decide requests';
  end if;

  select * into r from public.product_deletion_requests where id = p_request_id for update;
  if not found or r.status <> 'pending' then
    raise exception 'Request not found or already decided';
  end if;

  if p_approve then
    if r.request_type = 'delete' then
      update public.products set is_active = false, deleted_at = now() where id = r.product_id;
    else
      update public.products set
        name      = coalesce(r.new_name, name),
        price_pkr = coalesce(r.new_price_pkr, price_pkr),
        image_url = coalesce(r.new_image_url, image_url)
      where id = r.product_id;
    end if;
  end if;

  update public.product_deletion_requests set
    status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
    decided_by = auth.uid(), decided_at = now(), decision_note = p_note
  where id = p_request_id;

  insert into public.activity_log (user_id, action, entity_type, entity_id, details)
  values (auth.uid(),
          case when p_approve then 'request_approved' else 'request_rejected' end,
          'deletion_request', p_request_id,
          jsonb_build_object('product_id', r.product_id, 'request_type', r.request_type));
end;
$$;

revoke execute on function public.decide_product_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_product_request(uuid, boolean, text) to authenticated;

-- 4. Audit: product changes and new requests are logged by triggers, not the frontend
create function public.log_product_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activity_log (user_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    case
      when tg_op = 'INSERT' then 'product_created'
      when new.deleted_at is not null and old.deleted_at is null then 'product_deleted'
      else 'product_updated'
    end,
    'product', new.id,
    case when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
         else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) end
  );
  return new;
end;
$$;

create trigger products_log_change
  after insert or update on public.products
  for each row execute function public.log_product_change();

create function public.log_request_created()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activity_log (user_id, action, entity_type, entity_id, details)
  values (new.requested_by, 'request_created', 'deletion_request', new.id,
          jsonb_build_object('product_id', new.product_id, 'request_type', new.request_type));
  return new;
end;
$$;

create trigger requests_log_created
  after insert on public.product_deletion_requests
  for each row execute function public.log_request_created();

-- 5. Admin can upload new images but only Super Admin can replace or delete them
drop policy if exists "managers update product images" on storage.objects;
drop policy if exists "managers delete product images" on storage.objects;

create policy "super admin updates product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.current_user_role() = 'super_admin');

create policy "super admin deletes product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.current_user_role() = 'super_admin');
