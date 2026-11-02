-- Optional receipt image on an expense: private bucket, the file path is stored on the expense

alter table public.expenses add column receipt_path text check (char_length(receipt_path) <= 200);

-- Private: receipts are opened through short-lived signed URLs. 5 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "expense managers read receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'expense-receipts' and (select public.has_permission('manage_expenses')));

create policy "expense managers upload receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'expense-receipts' and (select public.has_permission('manage_expenses')));
