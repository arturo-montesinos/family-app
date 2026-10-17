import { z } from "zod";
import { boolish, nonEmpty, NON_EMPTY_MESSAGE } from "./common";

const body = z.string().trim().min(1, "Message is required").max(5000);

export const postCreateSchema = z.object({
  body,
  pinned: boolish.default(false),
});

export const postUpdateSchema = z
  .object({
    body: body.optional(),
    pinned: boolish.optional(),
  })
  .refine(nonEmpty, { message: NON_EMPTY_MESSAGE });

/** Query for listing: `?pinned=true&limit=50`. */
export const postListQuerySchema = z.object({
  pinned: boolish.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type PostCreateInput = z.output<typeof postCreateSchema>;
export type PostUpdateInput = z.output<typeof postUpdateSchema>;
export type PostListQuery = z.output<typeof postListQuerySchema>;
