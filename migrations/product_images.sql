-- Product pictures: public bucket, URL stored on the product

alter table public.products add column image_url text;

insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);

create policy "anyone reads product images" on storage.objects
  for select
  using (bucket_id = 'product-images');

create policy "managers upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_permission('manage_products'));

create policy "managers update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.has_permission('manage_products'));

create policy "managers delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.has_permission('manage_products'));
