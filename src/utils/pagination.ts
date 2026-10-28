import { z } from "zod";

export const PAGE_SIZE = 10;

// Any missing, negative, zero or non-integer page falls back to 1
export const pageSchema = z.coerce.number().int().min(1).catch(1);

// First and last row index for Supabase .range()
export const pageRange = (page: number, size = PAGE_SIZE) => [(page - 1) * size, page * size - 1] as const;
