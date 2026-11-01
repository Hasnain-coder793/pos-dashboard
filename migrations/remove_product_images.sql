-- Items no longer have images: drop the image columns, the storage rules, and the image parts of the request functions.
-- The empty product-images bucket itself is deleted through the Storage API, since Supabase blocks deleting it with SQL.

-- 1. Approving an update request changes only the name and price
create or replace function public.decide_product_request(p_request_id uuid, p_approve boolean, p_note text default null)
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
        price_pkr = coalesce(r.new_price_pkr, price_pkr)
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

-- 2. The request snapshot keeps only name and price
create or replace function public.set_request_old_values()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.old_values := (
    select jsonb_build_object('name', name, 'price_pkr', price_pkr)
    from public.products where id = new.product_id
  );
  return new;
end;
$$;

-- 3. An update request must change the name or the price
alter table public.product_deletion_requests drop constraint update_has_change;
alter table public.product_deletion_requests drop column new_image_url;
alter table public.product_deletion_requests add constraint update_has_change check (
  request_type = 'delete' or new_name is not null or new_price_pkr is not null
);

alter table public.products drop column image_url;

-- 4. Storage rules for the product-images bucket
drop policy if exists "anyone reads product images" on storage.objects;
drop policy if exists "managers upload product images" on storage.objects;
drop policy if exists "managers update product images" on storage.objects;
drop policy if exists "managers delete product images" on storage.objects;
drop policy if exists "super admin updates product images" on storage.objects;
drop policy if exists "super admin deletes product images" on storage.objects;
