-- Expenses follow the Items rules: anyone with manage_expenses adds directly; Admin edits and deletes go to Super Admin as requests.
-- Admin sees only the expenses added today. Cancel and the note are dropped (no expense was cancelled or had a note).

-- 1. Admin reads only expenses added today (Karachi time); Super Admin reads all
drop policy if exists "managers read expenses" on public.expenses;
create policy "managers read expenses" on public.expenses
  for select to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or (
      public.has_permission('manage_expenses')
      and (created_at at time zone 'Asia/Karachi')::date = (now() at time zone 'Asia/Karachi')::date
    )
  );

-- 2. Drop cancel: status column, its type, and the policies and summary that used it.
-- Both policies read expenses.status, so they go before the column; the request policy is recreated in step 3.
drop policy if exists "managers create pending expense requests" on public.expense_requests;
drop policy if exists "managers add expenses" on public.expenses;
create policy "managers add expenses" on public.expenses
  for insert to authenticated
  with check (public.has_permission('manage_expenses') and deleted_at is null);

create or replace function public.expense_summary(p_from date, p_to date)
returns table (expense_count bigint, total_pkr bigint)
language sql stable security invoker set search_path = ''
as $$
  select count(*), coalesce(sum(amount_pkr), 0)
  from public.expenses
  where spent_on >= p_from and spent_on < p_to and deleted_at is null
$$;

alter table public.expenses drop column status, drop column note;
drop type public.expense_status;

-- 3. Request types become update and delete (the table is empty, so the type is rebuilt)
alter table public.expense_requests alter column request_type type text;
drop type public.expense_request_type;
create type public.expense_request_type as enum ('update', 'delete');
alter table public.expense_requests
  alter column request_type type public.expense_request_type using request_type::public.expense_request_type;

alter table public.expense_requests
  add column new_title text check (char_length(new_title) between 2 and 80),
  add column new_amount_pkr integer check (new_amount_pkr between 1 and 10000000),
  add column new_spent_on date,
  add column old_values jsonb,
  add column decided_by_name text,
  add constraint expense_update_has_change check (
    request_type = 'delete' or new_title is not null or new_amount_pkr is not null or new_spent_on is not null
  );

create policy "managers create pending expense requests" on public.expense_requests
  for insert to authenticated
  with check (
    public.has_permission('manage_expenses')
    and status = 'pending' and decided_by is null and decided_at is null and decision_note is null and decided_by_name is null
    and exists (select 1 from public.expenses e where e.id = expense_id and e.deleted_at is null)
  );

-- 4. Snapshot of the expense when the request is made, so decided requests still show the old values
create function public.set_expense_request_old_values()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.old_values := (
    select jsonb_build_object('title', title, 'amount_pkr', amount_pkr, 'spent_on', spent_on)
    from public.expenses where id = new.expense_id
  );
  return new;
end;
$$;

create trigger expense_requests_set_old_values
  before insert on public.expense_requests
  for each row execute function public.set_expense_request_old_values();

-- 5. Approving applies the edit or the delete; the decider's name is stored like the requester's
create or replace function public.decide_expense_request(p_request_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.expense_requests;
begin
  if public.current_user_role() is distinct from 'super_admin' then
    raise exception 'Only Super Admin can decide requests';
  end if;

  select * into r from public.expense_requests where id = p_request_id for update;
  if not found or r.status <> 'pending' then
    raise exception 'Request not found or already decided';
  end if;

  if p_approve then
    if r.request_type = 'delete' then
      update public.expenses set deleted_at = now() where id = r.expense_id and deleted_at is null;
    else
      update public.expenses set
        title      = coalesce(r.new_title, title),
        amount_pkr = coalesce(r.new_amount_pkr, amount_pkr),
        spent_on   = coalesce(r.new_spent_on, spent_on)
      where id = r.expense_id;
    end if;
  end if;

  update public.expense_requests set
    status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
    decided_by = auth.uid(), decided_at = now(), decision_note = p_note,
    decided_by_name = (select full_name from public.profiles where id = auth.uid())
  where id = p_request_id;
end;
$$;
