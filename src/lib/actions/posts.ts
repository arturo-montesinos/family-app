"use server";

import * as postQueries from "@/lib/db/queries/posts";
import type { Post } from "@/lib/db/schema";
import { resolveByEntity } from "@/lib/services/context";
import * as postService from "@/lib/services/posts";
import { postCreateSchema, postUpdateSchema } from "@/lib/validators";
import { parse, resolveHouseholdFromInput, revalidate, ROUTES, run, type ActionResult } from "./_utils";

type PostInput = { householdId?: string; body: string; pinned?: boolean };

const revalidatePosts = () => revalidate(ROUTES.board, ROUTES.dashboard);

/** Creates a post in `input.householdId` (default: active household). Only adults may create pinned. */
export async function createPost(input: PostInput | FormData): Promise<ActionResult<Post>> {
  return run(async () => {
    const data = parse(postCreateSchema, input);
    const ctx = await resolveHouseholdFromInput(input);
    const row = await postService.createPost(ctx, data);
    revalidatePosts();
    return row;
  });
}

export async function updatePost(
  postId: string,
  input: Partial<Omit<PostInput, "householdId">> | FormData,
): Promise<ActionResult<Post>> {
  return run(async () => {
    const data = parse(postUpdateSchema, input);
    const ctx = await resolveByEntity(postId, "Post", postQueries.findPostHouseholdId);
    const row = await postService.updatePost(ctx, postId, data);
    revalidatePosts();
    return row;
  });
}

/** Flips pinned (adults/owner only). */
export async function togglePin(postId: string): Promise<ActionResult<Post>> {
  return run(async () => {
    const ctx = await resolveByEntity(postId, "Post", postQueries.findPostHouseholdId);
    const row = await postService.togglePin(ctx, postId);
    revalidatePosts();
    return row;
  });
}

export async function deletePost(postId: string): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await resolveByEntity(postId, "Post", postQueries.findPostHouseholdId);
    const result = await postService.deletePost(ctx, postId);
    revalidatePosts();
    return result;
  });
}
