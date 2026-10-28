-- Roles, profiles, permissions and helper functions shared by POS and Dashboard

create type public.app_role as enum ('super_admin', 'admin', 'editor');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'editor',
  can_sell boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null,
  allowed boolean not null default false,
  primary key (role, permission)
);

-- "current_role" is a reserved SQL keyword, so the helper is named current_user_role()
create function public.current_user_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create function public.has_permission(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select allowed from public.role_permissions
      where role = public.current_user_role() and permission = p),
    false
  )
$$;

-- Super Admin and Editor can sell; Admin only when can_sell is on
create function public.can_use_pos()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and (role in ('super_admin', 'editor') or (role = 'admin' and can_sell))
  )
$$;

-- Create a profile row for every new auth user
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
