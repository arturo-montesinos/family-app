import "server-only";
import * as postQueries from "@/lib/db/queries/posts";
import { NotFoundError, assertUuid } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";
import type { PostCreateInput, PostListQuery, PostUpdateInput } from "@/lib/validators";
import { actorOf, type HouseholdCtx } from "./context";

export function listPosts(ctx: HouseholdCtx, filter: PostListQuery = {}) {
  return postQueries.listPosts(ctx.member.householdId, filter);
}

export async function getPost(ctx: HouseholdCtx, postId: string) {
  assertUuid(postId, "Post");
  const row = await postQueries.getPost(ctx.member.householdId, postId);
  if (!row) throw new NotFoundError("Post not found");
  return row;
}

export async function createPost(ctx: HouseholdCtx, input: PostCreateInput) {
  const actor = actorOf(ctx);
  assertCan(actor, "content:create");
  if (input.pinned) assertCan(actor, "post:pin");
  return postQueries.createPost(ctx.member.householdId, ctx.user.id, input);
}

export async function updatePost(ctx: HouseholdCtx, postId: string, input: PostUpdateInput) {
  const actor = actorOf(ctx);
  const existing = await getPost(ctx, postId);
  const pinChange = input.pinned !== undefined && input.pinned !== existing.pinned;
  if (pinChange) assertCan(actor, "post:pin");
  if (input.body !== undefined || !pinChange) assertCan(actor, "content:update", existing);
  const row = await postQueries.updatePost(ctx.member.householdId, postId, input);
  if (!row) throw new NotFoundError("Post not found");
  return row;
}

export async function togglePin(ctx: HouseholdCtx, postId: string) {
  await getPost(ctx, postId);
  assertCan(actorOf(ctx), "post:pin");
  const row = await postQueries.togglePin(ctx.member.householdId, postId);
  if (!row) throw new NotFoundError("Post not found");
  return row;
}

export async function deletePost(ctx: HouseholdCtx, postId: string) {
  const existing = await getPost(ctx, postId);
  assertCan(actorOf(ctx), "content:delete", existing);
  await postQueries.deletePost(ctx.member.householdId, postId);
  return { id: postId };
}
