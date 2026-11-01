import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { z } from "zod";
import { ActivityEntity, ExpenseRequestType, RequestStatus, RequestType, Role, SalesPeriod } from "@/enums";
import { karachiToday } from "@/utils/date-range";

// ---------- Shared ----------

export type ActionResult = { ok: true; error?: never } | { ok: false; error: string };

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  can_sell: boolean;
  is_active: boolean;
  created_at: string;
};

// ---------- Auth ----------

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginValues = z.infer<typeof loginSchema>;

// ---------- Items ----------

export type Product = {
  id: string;
  name: string;
  price_pkr: number;
  is_active: boolean;
  deleted_at: string | null;
  updated_at: string;
};

const reasonField = (required: boolean) =>
  required ? z.string().trim().min(3, "At least 3 characters").max(300, "Max 300 characters") : z.string().trim().max(300, "Max 300 characters");

// Used by the server action
export const itemSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(60, "Max 60 characters"),
  price_pkr: z.number("Enter a price").int("Whole PKR only").min(1, "Min 1").max(100000, "Max 100,000"),
  is_active: z.boolean(),
  reason: reasonField(false),
});

export type ItemValues = z.infer<typeof itemSchema>;

// Used by the form: Admin edits must give a reason
export const itemFormSchema = (requireReason: boolean) => itemSchema.extend({ reason: reasonField(requireReason) });

export type ItemFormValues = z.infer<ReturnType<typeof itemFormSchema>>;

export const deleteSchema = (requireReason: boolean) => z.object({ reason: reasonField(requireReason) });

export type DeleteValues = { reason: string };

// ---------- Change requests ----------

export type ItemRequest = {
  id: string;
  request_type: RequestType;
  status: RequestStatus;
  reason: string;
  new_name: string | null;
  new_price_pkr: number | null;
  decision_note: string | null;
  old_values: Pick<Product, "name" | "price_pkr"> | null;
  created_at: string;
  decided_at: string | null;
  product: Pick<Product, "name" | "price_pkr"> | null;
  requester: { full_name: string } | null;
  decider: { full_name: string } | null;
};

export const decisionSchema = z.object({
  requestId: z.guid(),
  approve: z.boolean(),
  note: z.string().trim().max(300, "Max 300 characters"),
});

export type DecisionValues = z.infer<typeof decisionSchema>;

// ---------- Expenses ----------

export type Expense = {
  id: string;
  title: string;
  amount_pkr: number;
  spent_on: string;
  created_by_name: string;
  created_at: string;
};

type ExpenseFields = Pick<Expense, "title" | "amount_pkr" | "spent_on">;

export type ExpenseRequest = {
  id: string;
  expense_id: string;
  request_type: ExpenseRequestType;
  status: RequestStatus;
  reason: string;
  new_title: string | null;
  new_amount_pkr: number | null;
  new_spent_on: string | null;
  old_values: ExpenseFields | null;
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_by_name: string;
  created_at: string;
  expense: ExpenseFields | null;
};

export type ExpenseSummary = { expense_count: number; total_pkr: number };

// Used by the server action
export const expenseSchema = z.object({
  title: z.string().trim().min(2, "At least 2 characters").max(80, "Max 80 characters"),
  amount_pkr: z.number("Enter an amount").int("Whole PKR only").min(1, "Min 1").max(10000000, "Max 10,000,000"),
  spent_on: z.iso.date("Pick a date").refine((date) => date <= karachiToday(), "Date cannot be in the future"),
  reason: reasonField(false),
});

export type ExpenseValues = z.infer<typeof expenseSchema>;

// Used by the form: Admin edits must give a reason
export const expenseFormSchema = (requireReason: boolean) => expenseSchema.extend({ reason: reasonField(requireReason) });

// ---------- Sales & clients ----------

export const salesFilterSchema = z.object({
  // "" = All; a missing or unknown period falls back to Day
  period: z.enum(SalesPeriod).or(z.literal("")).catch(SalesPeriod.DAY),
  date: z.iso
    .date()
    .refine((date) => date <= karachiToday(), "Date cannot be in the future")
    .catch(() => karachiToday()),
});

export type SalesFilter = z.infer<typeof salesFilterSchema>;

export type ReportRow = { product_name: string; qty_sold: number; amount_pkr: number; order_count: number };

export type SaleRow = {
  id: string;
  receipt_no: string;
  sold_at: string;
  cashier_name: string;
  customer_name: string | null;
  total_items: number;
  total_pkr: number;
  sale_items?: { product_name: string; unit_price_pkr?: number; qty: number; line_total_pkr: number }[];
};

export type Client = {
  customer_phone: string;
  customer_name: string | null;
  order_count: number;
  total_spent_pkr: number;
  last_purchase_at: string;
};

export const searchSchema = z.string().trim().max(50).catch("");

// ---------- Activity ----------

export const activityFilterSchema = z.enum(ActivityEntity).optional().catch(undefined);

// Written by database triggers: products log old/new rows, requests and sales log ids
export type ActivityDetails = {
  old?: Partial<Product>;
  new?: Partial<Product>;
  product_id?: string;
  request_type?: RequestType;
};

export type ActivityRow = {
  id: number;
  action: string;
  entity_type: ActivityEntity | null;
  entity_id: string | null;
  details: ActivityDetails | null;
  created_at: string;
  user: { full_name: string } | null;
};

// ---------- Users ----------

const userFields = {
  full_name: z.string().trim().min(2, "At least 2 characters").max(60, "Max 60 characters"),
  role: z.enum([Role.ADMIN, Role.EDITOR], "Pick a role"),
  can_sell: z.boolean(),
};

export const createUserSchema = z.object({
  ...userFields,
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export const updateUserSchema = z.object({ ...userFields, is_active: z.boolean() });

export type CreateUserValues = z.infer<typeof createUserSchema>;
export type UpdateUserValues = z.infer<typeof updateUserSchema>;

export type UserRow = Profile & { email: string };

// ---------- Component props ----------

export type ButtonVariant = "primary" | "secondary";

export type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant };

export type InputProps = ComponentProps<"input"> & { label?: string; error?: string };

export type BadgeProps = { variant?: "outline" | "solid"; children: ReactNode };

export type ModalProps = { title: string; onClose: () => void; children: ReactNode };

export type TableProps = { headers: string[]; children: ReactNode; empty?: boolean };

export type PaginationProps = { page: number; total: number; params?: Record<string, string>; pageKey?: string; pageSize?: number };

export type NavLink = { href: string; label: string; icon: LucideIcon; roles: Role[] };

export type SidebarProps = { profile: Profile };

export type ItemsTableProps = { products: Product[]; pendingIds: string[]; role: Role };

// onDone closes the dialog and shows a confirmation message
export type ItemFormProps = { product?: Product; role: Role; onClose: () => void; onDone: (message: string) => void };

export type DeleteFormProps = { product: Product; role: Role; onClose: () => void; onDone: (message: string) => void };

export type RequestActionsProps = { requestId: string; decide?: (values: DecisionValues) => Promise<ActionResult> };

export type ExpensesTableProps = { expenses: Expense[]; pendingIds: string[]; role: Role };

// onDone closes the dialog and shows a confirmation message
export type ExpenseFormProps = { expense?: Expense; role: Role; onClose: () => void; onDone: (message: string) => void };

export type DeleteExpenseFormProps = { expense: Expense; role: Role; onClose: () => void; onDone: (message: string) => void };

export type TabsProps = { tabs: { href: string; label: string }[]; active: string };

export type UsersTableProps = { users: UserRow[] };

export type UserFormProps = { user?: UserRow; onClose: () => void };
