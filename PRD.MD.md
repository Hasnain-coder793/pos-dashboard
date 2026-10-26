# POS Admin Dashboard — Phase 0 PRD

Oct 26, 2026 · @IMTINAN

## 1. Purpose and scope

Build a separate Next.js dashboard that reads and manages the data the existing POS app writes, using the same Supabase project, the same env values and the same migrations folder. No new database, no copied schema.

The dashboard has exactly five pages:

1. Clients
2. Sales
3. Items (includes Item Change Requests)
4. Notifications
5. User Management

The POS app stays the only place where sales are created and receipts are printed. Editors never log into the dashboard.

## 2. Tech stack and shared environment

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router), TypeScript strict mode |
| Styling | Tailwind CSS, black and white theme (same as POS) |
| Forms | React Hook Form + `@hookform/resolvers/zod` |
| Validation | Zod: one schema per form, reused in the server action |
| Backend | Existing Supabase project: Auth, Postgres, RLS, Storage |
| Supabase client | `@supabase/ssr` (browser client + server client with cookies) |
| Mutations | Next.js server actions in `actions/` |

**Env vars.** Copy the POS app's `.env.local` values as they are. The dashboard adds only server-only keys:

| Variable | Source | Exposed to browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as POS | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as POS | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard | No, used only for creating auth users |
| `WHATSAPP_*` | Chosen provider (section 10) | No |

Use the exact variable names the POS already uses so one set of values works for both apps.

**Migrations.** All new migrations go in the POS repo's existing `supabase/migrations/` folder, after `20261026000008`. The dashboard repo has no migrations folder of its own. Never edit migrations 0001 to 0008; only add new ones.

**Types.** Generate `types/database.ts` with `supabase gen types typescript` from the shared project, so both apps read the same table types.

## 3. Roles and permissions

The existing `app_role` enum (`super_admin`, `admin`, `editor`) and `has_permission()` are reused. Only Super Admin and Admin can log into the dashboard; an Editor who signs in is signed out with "This account uses the POS app only."

| Capability | Super Admin | Admin | Enforced by |
| --- | --- | --- | --- |
| Clients page | Yes | No | RLS via `view_reports` |
| Sales page | Yes | No | RLS via `view_reports` |
| View items | Yes | Yes | RLS via `manage_products` |
| Add item | Yes | Yes, no approval | RLS insert policy |
| Update item or price | Directly | Request only | RLS update = super\_admin only |
| Delete item (soft) | Directly | Request only | RLS update = super\_admin only |
| Approve or reject requests | Yes | No | `decide_product_request()` RPC |
| Send WhatsApp | Yes | No | Server action checks `send_notifications` |
| Create and manage Admin/Editor accounts | Yes | No | Server action checks `manage_users` |

**Permission seed.** `role_permissions` exists but no migration fills it, so today `has_permission()` returns false for everyone. Seed these rows:

| Role | Permissions set to `true` |
| --- | --- |
| `super_admin` | `manage_users`, `manage_products`, `view_reports`, `send_notifications` |
| `admin` | `manage_products` |
| `editor` | none |

Admin must not get `view_reports`; that one flag hides all sales, sale items and client data from Admin at the database level.

## 4. Existing schema mapped to pages

Most of the dashboard runs on tables that already exist; seven gaps need small migrations (section 5).

| Existing object | Used by | Fits as is? |
| --- | --- | --- |
| `profiles` (role, can\_sell, is\_active) | User Management, login guard | Yes |
| `role_permissions` + `has_permission()` | All pages | Table yes, rows missing (Gap 1) |
| `products` (name, price\_pkr, image\_url, is\_active, deleted\_at) | Items | Yes. Admin can update directly today (Gap 2) |
| `product_deletion_requests` | Item Change Requests | Delete only, no update requests (Gap 3) |
| `sales` (customer\_name, total\_pkr, sold\_at, cashier\_name) | Sales, Clients | No customer phone (Gap 4) |
| `sale_items` (product\_name, qty, line\_total\_pkr) | Sales, Clients history | Yes |
| `activity_log` | Audit of item changes and decisions | `entity_type` check too narrow (Gap 5) |
| `product-images` bucket | Item images | Admin can overwrite live images (Gap 6) |
| Notifications storage | Notifications | Does not exist (Gap 7) |

**Prices.** `price_pkr integer` stores whole rupees with no rounding error, which meets the "safe numeric" rule. Keep it; all PKR values in the dashboard are integers.

**Soft delete.** Deleting an item sets `deleted_at = now()` and `is_active = false`. Rows are never removed, because `sale_items.product_id` references them.

## 5. Schema gaps and migrations

Three new migration files close all seven gaps. No existing table is dropped or renamed, so the POS keeps working unchanged until it adds the phone field.

### Migration `20261026000009_dashboard_access.sql`

**Gap 1: permissions are not seeded.**

```sql
insert into public.role_permissions (role, permission, allowed) values
  ('super_admin', 'manage_users', true),
  ('super_admin', 'manage_products', true),
  ('super_admin', 'view_reports', true),
  ('super_admin', 'send_notifications', true),
  ('admin', 'manage_products', true)
on conflict (role, permission) do update set allowed = excluded.allowed;
```

**Gap 2: Admin can update products directly**, which bypasses approval. Only Super Admin may update; Admin keeps insert.

```sql
drop policy "managers update products" on public.products;

create policy "super admin updates products" on public.products
  for update to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');
```

**Gap 3: requests support delete only.** Extend the existing table instead of adding a new one. The name `product_deletion_requests` stays to avoid breaking existing code; the UI calls it "Change Requests".

```sql
create type public.product_request_type as enum ('update', 'delete');

alter table public.product_deletion_requests
  add column request_type public.product_request_type not null default 'delete',
  add column new_name text,
  add column new_price_pkr integer check (new_price_pkr > 0),
  add column new_image_url text,
  add column old_values jsonb,          -- snapshot of name, price, image when requested
  add column decision_note text,
  add constraint update_has_change check (
    request_type = 'delete'
    or new_name is not null or new_price_pkr is not null or new_image_url is not null
  );

-- one open request per product
create unique index one_pending_request_per_product
  on public.product_deletion_requests (product_id) where status = 'pending';

-- requests are created pending only, and decided only through the RPC below
drop policy "managers create deletion requests" on public.product_deletion_requests;
create policy "managers create pending requests" on public.product_deletion_requests
  for insert to authenticated
  with check (
    public.has_permission('manage_products')
    and requested_by = auth.uid()
    and status = 'pending' and decided_by is null and decided_at is null
  );

drop policy "super admin decides deletion requests" on public.product_deletion_requests;
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
```

**Gap 5: audit log.** Widen `entity_type` and log every product insert, update and request automatically with triggers, so logging cannot be skipped from the frontend.

```sql
alter table public.activity_log drop constraint activity_log_entity_type_check;
alter table public.activity_log add constraint activity_log_entity_type_check
  check (entity_type in ('sale', 'product', 'deletion_request', 'user', 'notification'));

create function public.log_product_change()
returns trigger language plpgsql security definer set search_path = ''
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
returns trigger language plpgsql security definer set search_path = ''
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
```

**Gap 6: Admin can overwrite or delete live product images.** Admin keeps upload (needed to attach a new image to a request); only Super Admin can replace or delete files.

```sql
drop policy "managers update product images" on storage.objects;
drop policy "managers delete product images" on storage.objects;

create policy "super admin updates product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.current_user_role() = 'super_admin');

create policy "super admin deletes product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.current_user_role() = 'super_admin');
```

### Migration `20261026000010_customer_phone_and_reports.sql`

**Gap 4: no customer phone.** The Clients page and WhatsApp both need a phone number, and `sales` has only `customer_name`. Add one nullable column (format `92XXXXXXXXXX`, 12 digits) and pass it through `sync_sale`.

```sql
alter table public.sales
  add column customer_phone text check (customer_phone ~ '^92[0-9]{10}$');

create index sales_customer_phone_idx on public.sales (customer_phone);
```

Then `create or replace function public.sync_sale(payload jsonb)` with the exact body from migration 0008, adding `customer_phone` to the column list and `nullif(payload ->> 'customer_phone', '')` to the values. Offline sales queued without a phone still sync, with `customer_phone = null`.

**Report helpers.** PostgREST returns at most 1,000 rows per request by default, so totals are computed in Postgres, not in the browser. Both use `security_invoker` and an explicit `view_reports` check, so Admin gets zero rows even if they own sales.

```sql
create view public.client_summary with (security_invoker = true) as
select
  customer_phone,
  (array_agg(customer_name order by sold_at desc)
     filter (where customer_name is not null))[1] as customer_name,
  count(*)::int          as order_count,
  sum(total_pkr)::bigint as total_spent_pkr,
  max(sold_at)           as last_purchase_at
from public.sales
where customer_phone is not null
  and public.has_permission('view_reports')
group by customer_phone;

create function public.sales_item_report(p_from timestamptz, p_to timestamptz)
returns table (product_name text, qty_sold bigint, amount_pkr bigint, order_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select si.product_name, sum(si.qty), sum(si.line_total_pkr), count(distinct s.id)
  from public.sale_items si
  join public.sales s on s.id = si.sale_id
  where s.sold_at >= p_from and s.sold_at < p_to
    and public.has_permission('view_reports')
  group by si.product_name
  order by 3 desc
$$;
```

### Migration `20261026000011_notifications.sql`

**Gap 7: nowhere to record sends.** One table holds each send attempt and the provider's response.

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid not null references public.profiles (id),
  customer_phone text not null,
  customer_name text,
  message text not null,
  status text not null check (status in ('accepted', 'failed')),
  provider_message_id text,
  provider_error text,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "senders read notifications" on public.notifications
  for select to authenticated using (public.has_permission('send_notifications'));

create policy "senders insert notifications" on public.notifications
  for insert to authenticated
  with check (public.has_permission('send_notifications') and sent_by = auth.uid());

revoke update, delete on public.notifications from anon, authenticated;
```

`accepted` means the provider took the message, not that it was delivered. Delivery status needs provider webhooks, which are out of Phase 0.

## 6. Page requirements

Every page is a server component that loads data with the server Supabase client; forms are client components using React Hook Form + Zod. All dates display in Asia/Karachi time, all money as `Rs 1,250`.

### 6.1 Layout and login

- `/login`: email + password via Supabase Auth. After login, read own `profiles` row. Editor or `is_active = false` → sign out with a clear message.
- Sidebar shows only the pages the role may open. Super Admin: all five. Admin: Items only.
- `middleware.ts` refreshes the session and redirects signed-out users to `/login`. Each page also checks role on the server and returns 404 for disallowed roles. RLS remains the real guard.

### 6.2 Items — `/items` (Super Admin, Admin)

- Table: image, name, price (PKR), status (Active / Inactive), updated at. Search by name. Super Admin sees deleted items under a "Show deleted" toggle.
- **Add item** (both roles): name, price, optional image, active. Inserts directly into `products`.
- **Edit / Delete** for Super Admin: updates `products` directly (delete = soft delete).
- **Edit / Delete** for Admin: opens the same form, but submits a request into `product_deletion_requests` with `request_type`, only the changed `new_*` fields, `old_values` snapshot and reason. The item row shows a "Pending change" badge; buttons are disabled while one is pending.
- Image upload: always a new path `products/<uuid>.<ext>`, `upsert: false`, max 2 MB, jpg/png/webp.

### 6.3 Change Requests — `/items/requests` (tab inside Items)

- Table: item, type (Update / Delete), current values vs requested values, reason, requested by, requested at, status.
- Admin sees requests read-only. Super Admin sees Approve / Reject with an optional note; both call `decide_product_request()`.
- Filter by status, default Pending. Decided rows show who decided and when.

### 6.4 Clients — `/clients` (Super Admin)

- Reads `client_summary`: name, phone, number of orders, total spent, last purchase. Search by name or phone (`ilike`). Paginated 25 per page.
- Row click opens purchase history: each sale's date/time, receipt no, items with quantities and line totals, order total. Query `sales` with nested `sale_items` filtered by `customer_phone`, newest first.
- Sales without a phone do not appear here (they still count in Sales).

### 6.5 Sales — `/sales` (Super Admin)

- Filter: Day, Week, Month, Year, plus a date picker for the anchor date (default today). Week starts Monday. Ranges are computed in Asia/Karachi and sent to `sales_item_report()` as `[from, to)`.
- Summary line: total orders, total items sold, total sales PKR for the range.
- Table: item name, quantity sold, sales amount PKR, sorted by amount. Totals row at the bottom.
- Below it, a paginated list of sales in the range (receipt no, time, cashier, customer, items, total).

### 6.6 Notifications — `/notifications` (Super Admin)

- Pick one or many customers from `client_summary` (checkboxes + search), type a message (max 1,000 chars), Send.
- A server action sends one provider request per phone, inserts one `notifications` row per result, and returns per-number results.
- UI shows each number as **Accepted** or **Failed** with the provider's error text. It never says "Delivered".
- History table below: date, customer, message preview, status, sent by.
- Page shows "WhatsApp provider not configured" and disables Send when `WHATSAPP_*` vars are missing.

### 6.7 User Management — `/users` (Super Admin)

- Table: name, email, role, can sell, active, created at.
- **Create user**: full name, email, temporary password, role (Admin or Editor only), can sell (Admin only). The server action checks `has_permission('manage_users')`, then calls `auth.admin.createUser` with the service-role client and `user_metadata.full_name`; the existing `handle_new_user` trigger creates the profile, then the action sets `role` and `can_sell`.
- **Edit**: name, role (Admin/Editor), can sell, active. Saved through the normal client, so RLS `manage_users` applies.
- **Deactivate**: sets `is_active = false` and bans the auth user via the admin API so they cannot sign in to either app.
- Super Admin accounts cannot be created, demoted or deactivated from the dashboard. A Super Admin cannot edit their own role.

## 7. Security, validation and errors

**Security rules**

- Every read and write goes through the user's session (anon key + cookies), so RLS applies. Hiding buttons is only for UX.
- The service-role key is used only in `actions/users.ts` (create, ban, list emails via `auth.admin`), never in client code. Import it only from a file with `import 'server-only'`.
- Every server action starts by re-reading the caller's role from `profiles`; it never trusts a role sent from the form.
- Admin cannot bypass approval: products update is blocked by RLS, request rows cannot be updated by anyone, and only `decide_product_request()` applies a change after checking `super_admin`.
- `sales` and `sale_items` stay insert-only; the dashboard never writes to them.
- WhatsApp keys live only in server env vars; sends happen only in a server action.

**Zod schemas** (`utils/validation/`, shared by form and server action)

| Schema | Rules |
| --- | --- |
| `itemSchema` | name 2–60 chars, trimmed; price integer 1–100,000 PKR; image optional, ≤ 2 MB, jpg/png/webp; isActive boolean |
| `itemRequestSchema` | type `update` or `delete`; reason 3–300 chars; for update at least one changed field |
| `decisionSchema` | requestId uuid; approve boolean; note ≤ 300 chars |
| `salesFilterSchema` | period `day`, `week`, `month`, `year`; date valid, not in the future |
| `clientSearchSchema` | query ≤ 50 chars |
| `notificationSchema` | phones: 1–100, each `^92[0-9]{10}$`; message 1–1,000 chars |
| `createUserSchema` | fullName 2–60; email valid; password ≥ 8; role `admin` or `editor`; canSell boolean |
| `updateUserSchema` | same minus email and password, plus isActive |

**Error handling**

- Server actions return `{ ok: true, data } | { ok: false, error: string, fieldErrors?: Record<string, string> }`. Never throw raw Supabase errors to the UI.
- Field errors show under the input (React Hook Form `setError`); other errors show in a toast or inline banner.
- Map common Postgres errors to plain messages: `23505` on the pending-request index → "This item already has a pending request"; RLS denial `42501` → "You do not have permission to do this"; RPC exception text is shown as is.
- Each page has `loading.tsx` (skeleton table) and `error.tsx` (message + Retry). Submit buttons disable and show "Saving…" while pending.

## 8. Folder structure and build order

Use the same folder convention as the POS app.

```text
app/
  login/page.tsx
  (dashboard)/layout.tsx        sidebar + role check
  (dashboard)/items/page.tsx
  (dashboard)/items/requests/page.tsx
  (dashboard)/clients/page.tsx
  (dashboard)/sales/page.tsx
  (dashboard)/notifications/page.tsx
  (dashboard)/users/page.tsx
middleware.ts
actions/        items.ts, requests.ts, notifications.ts, users.ts, auth.ts
components/     reusable UI: Table, Button, Input, Modal, Badge, Pagination, DateFilter
sections/       page-specific blocks: ItemsTable, RequestForm, ClientHistory, SalesSummary, UserForm
types/          database.ts (generated), domain types
enums/          Role, RequestType, RequestStatus, SalesPeriod
utils/          supabase/{client,server,admin}.ts, validation/*.ts, format.ts (PKR, dates), date-range.ts
```

**Build order**

1. Apply migration 0009, regenerate types, set up Supabase clients, login, middleware, layout and sidebar.
2. Items page: list, add, Super Admin edit/delete.
3. Admin requests and Change Requests tab with approve/reject.
4. User Management.
5. Migration 0010, then Sales page.
6. Clients page (needs POS to start sending `customer_phone`).
7. Migration 0011 and Notifications, once the WhatsApp provider is chosen.
8. Run the test checklist in section 9 with one Super Admin, one Admin, one Editor.

## 9. Acceptance criteria and tests

**Acceptance criteria**

- [ ] Dashboard runs on the POS's Supabase URL and anon key; no second database, no duplicated tables.
- [ ] Only migrations 0009–0011 are added; 0001–0008 are untouched; POS checkout still works after they run.
- [ ] Super Admin can open all five pages; Admin sees only Items; Editor cannot sign in.
- [ ] Admin adds an item with no approval and it appears in the POS.
- [ ] Admin edit or delete creates a pending request; the item is unchanged in the POS until approval.
- [ ] Approve applies the change; reject leaves it unchanged; both store decider, decision and time.
- [ ] Every item create, update, delete, request and decision has an `activity_log` row with actor and time.
- [ ] Clients shows name, phone, and full purchase history with items, quantities and totals.
- [ ] Sales filters by day, week, month and year in Karachi time, with item-wise and grand totals that match the database.
- [ ] Notifications send to one or many customers and show Accepted or Failed per number.
- [ ] Super Admin creates, edits and deactivates Admin and Editor accounts.
- [ ] No order creation, checkout or receipt printing exists in the dashboard.

**Direct-API tests** (signed in as Admin, using the Supabase JS client in the browser console, not the UI)

- [ ] `update` on `products` → no rows changed.
- [ ] `update` on `product_deletion_requests` (set status approved) → denied.
- [ ] `rpc('decide_product_request')` → "Only Super Admin can decide requests".
- [ ] `select` on `sales`, `client_summary`, `notifications` and `rpc('sales_item_report')` → zero rows.
- [ ] `update` on another user's `profiles` row → no rows changed.
- [ ] Upload to `product-images` with an existing path and `upsert: true` → denied.
- [ ] Insert a request with `status = 'approved'` → denied.

**Edge cases**

- [ ] Second request on an item with a pending one → friendly error.
- [ ] Approving a request twice (two tabs) → second fails with "already decided".
- [ ] Sale at 23:59 Karachi time lands in the correct day.
- [ ] Deactivated user is signed out and cannot sign in to dashboard or POS.

## 10. Open decisions and out of scope

**Decide before the related step starts**

| Decision | Blocks | Note |
| --- | --- | --- |
| WhatsApp provider (Meta Cloud API direct, or a BSP such as Twilio) | Notifications | Business-initiated messages outside a 24-hour customer window need a pre-approved template; free-text sends may be rejected. Confirm with the chosen provider. |
| POS adds an optional customer phone field | Clients, Notifications | Small POS change: input, normalize to `92XXXXXXXXXX`, include `customer_phone` in the sync payload. Old sales stay without phone. |
| Customer consent for WhatsApp messages | Notifications | Owner confirms customers agree to receive messages. |

**Out of scope for this dashboard**

Order creation, checkout, receipt printing, the POS screen, Health page, mess management, discounts, digital payments, refunds, advanced inventory, delivery-status tracking, charts and recent-sales widgets, and multi-shop SaaS.
