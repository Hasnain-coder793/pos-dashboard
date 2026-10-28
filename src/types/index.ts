import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { z } from "zod";
import { RequestStatus, RequestType, Role, SalesPeriod } from "@/enums";
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
  image_url: string | null;
  is_active: boolean;
  deleted_at: string | null;
  updated_at: string;
};

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const reasonField = (required: boolean) =>
  required ? z.string().trim().min(3, "At least 3 characters").max(300, "Max 300 characters") : z.string().trim().max(300, "Max 300 characters");

// Used by the server action; the image is already uploaded and passed as a URL
export const itemSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(60, "Max 60 characters"),
  price_pkr: z.number("Enter a price").int("Whole PKR only").min(1, "Min 1").max(100000, "Max 100,000"),
  is_active: z.boolean(),
  // Only files from our own product-images bucket
  image_url: z
    .url()
    .refine((url) => url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/product-images/`), "Upload the image again")
    .nullable(),
  reason: reasonField(false),
});

export type ItemValues = z.infer<typeof itemSchema>;

// Used by the form: adds the image file, and Admin edits must give a reason
export const itemFormSchema = (requireReason: boolean) =>
  itemSchema.omit({ image_url: true }).extend({
    reason: reasonField(requireReason),
    image: z
      .custom<FileList>()
      .optional()
      .refine((files) => !files?.[0] || files[0].size <= 2 * 1024 * 1024, "Image must be 2 MB or less")
      .refine((files) => !files?.[0] || IMAGE_TYPES.includes(files[0].type), "Use a JPG, PNG or WEBP image"),
  });

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
  new_image_url: string | null;
  decision_note: string | null;
  old_values: Pick<Product, "name" | "price_pkr" | "image_url"> | null;
  created_at: string;
  decided_at: string | null;
  product: Pick<Product, "name" | "price_pkr" | "image_url"> | null;
  requester: { full_name: string } | null;
  decider: { full_name: string } | null;
};

export const decisionSchema = z.object({
  requestId: z.guid(),
  approve: z.boolean(),
  note: z.string().trim().max(300, "Max 300 characters"),
});

export type DecisionValues = z.infer<typeof decisionSchema>;

// ---------- Sales & clients ----------

export const salesFilterSchema = z.object({
  period: z.enum(SalesPeriod).catch(SalesPeriod.DAY),
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
  sale_items?: { product_name: string; qty: number; line_total_pkr: number }[];
};

export type Client = {
  customer_phone: string;
  customer_name: string | null;
  order_count: number;
  total_spent_pkr: number;
  last_purchase_at: string;
};

export const searchSchema = z.string().trim().max(50).catch("");

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

export type ItemFormProps = { product?: Product; role: Role; onClose: () => void };

export type DeleteFormProps = { product: Product; role: Role; onClose: () => void };

export type RequestActionsProps = { requestId: string };

export type UsersTableProps = { users: UserRow[] };

export type UserFormProps = { user?: UserRow; onClose: () => void };
