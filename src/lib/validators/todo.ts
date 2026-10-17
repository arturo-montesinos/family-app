import { z } from "zod";
import { nonEmpty, NON_EMPTY_MESSAGE, nullableDate, nullableText, nullableUserId } from "./common";

export const todoStatusSchema = z.enum(["open", "done"]);

const title = z.string().trim().min(1, "Title is required").max(200);

export const todoCreateSchema = z.object({
  title,
  details: nullableText(5000),
  dueAt: nullableDate,
  assignedTo: nullableUserId,
  status: todoStatusSchema.default("open"),
});

export const todoUpdateSchema = z
  .object({
    title: title.optional(),
    details: nullableText(5000),
    dueAt: nullableDate,
    assignedTo: nullableUserId,
    status: todoStatusSchema.optional(),
  })
  .refine(nonEmpty, { message: NON_EMPTY_MESSAGE });

/** Query for listing: `?status=open&assignedTo=<userId>`. */
export const todoListQuerySchema = z.object({
  status: todoStatusSchema.optional(),
  assignedTo: z.string().trim().min(1).optional(),
});

export type TodoCreateInput = z.output<typeof todoCreateSchema>;
export type TodoUpdateInput = z.output<typeof todoUpdateSchema>;
export type TodoListQuery = z.output<typeof todoListQuerySchema>;
