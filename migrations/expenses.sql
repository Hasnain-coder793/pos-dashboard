-- Expenses: Admin and Super Admin add them; Admin cancel/delete goes through a request that only Super Admin decides

-- 1. Permission
insert into public.role_permissions (role, permission, allowed) values
  ('super_admin', 'manage_expenses', true),
  ('admin', 'manage_expenses', true)
on conflict (role, permission) do update set allowed = excluded.allowed;

-- 2. Tables. Cancelled expenses stay listed but are not counted; deleted ones are hidden.
create type public.expense_status as enum ('active', 'cancelled');
create type public.expense_request_type as enum ('cancel', 'delete');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 80),
  amount_pkr integer not null check (amount_pkr between 1 and 10000000),
  note text check (char_length(note) <= 300),
  spent_on date not null default (now() at time zone 'Asia/Karachi')::date,
  status public.expense_status not null default 'active',
  deleted_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_by_name text not null,
  created_at timestamptz not null default now()
);

create index expenses_spent_on_idx on public.expenses (spent_on);

create table public.expense_requests (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  request_type public.expense_request_type not null,
  reason text not null check (char_length(reason) between 3 and 300),
  status public.request_status not null default 'pending',
  created_by uuid not null references public.profiles (id),
  created_by_name text not null,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create unique index one_pending_request_per_expense
  on public.expense_requests (expense_id) where status = 'pending';

-- 3. The author is always the signed-in user; the name is copied so Admin needs no access to other profiles
create function public.set_expense_author()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.created_by := auth.uid();
  new.created_by_name := (select full_name from public.profiles where id = auth.uid());
  return new;
end;
$$;

create trigger expenses_set_author
  before insert on public.expenses
  for each row execute function public.set_expense_author();

create trigger expense_requests_set_author
  before insert on public.expense_requests
  for each row execute function public.set_expense_author();

-- 4. RLS: add and read with manage_expenses; only Super Admin changes an expense directly
alter table public.expenses enable row level security;
alter table public.expense_requests enable row level security;

create policy "managers read expenses" on public.expenses
  for select to authenticated
  using (public.has_permission('manage_expenses'));

create policy "managers add expenses" on public.expenses
  for insert to authenticated
  with check (public.has_permission('manage_expenses') and status = 'active' and deleted_at is null);

create policy "super admin updates expenses" on public.expenses
  for update to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

revoke delete on public.expenses from anon, authenticated;

create policy "managers read expense requests" on public.expense_requests
  for select to authenticated
  using (public.has_permission('manage_expenses'));

create policy "managers create pending expense requests" on public.expense_requests
  for insert to authenticated
  with check (
    public.has_permission('manage_expenses')
    and status = 'pending' and decided_by is null and decided_at is null and decision_note is null
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and e.deleted_at is null and (request_type = 'delete' or e.status = 'active')
    )
  );

-- requests are decided only through decide_expense_request()
revoke update, delete on public.expense_requests from anon, authenticated;

-- 5. Super Admin approves or rejects a request; the change and the decision happen in one transaction
create function public.decide_expense_request(p_request_id uuid, p_approve boolean, p_note text default null)
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
      update public.expenses set status = 'cancelled' where id = r.expense_id;
    end if;
  end if;

  update public.expense_requests set
    status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
    decided_by = auth.uid(), decided_at = now(), decision_note = p_note
  where id = p_request_id;
end;
$$;

revoke execute on function public.decide_expense_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_expense_request(uuid, boolean, text) to authenticated;

-- 6. Totals for the page, computed in Postgres; cancelled expenses are not counted
create function public.expense_summary(p_from date, p_to date)
returns table (expense_count bigint, total_pkr bigint)
language sql stable security invoker set search_path = ''
as $$
  select count(*), coalesce(sum(amount_pkr), 0)
  from public.expenses
  where spent_on >= p_from and spent_on < p_to
    and deleted_at is null and status = 'active'
$$;

revoke execute on function public.expense_summary(date, date) from public, anon;
grant execute on function public.expense_summary(date, date) to authenticated;
