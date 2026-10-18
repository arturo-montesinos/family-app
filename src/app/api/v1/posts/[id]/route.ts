import { withEntityApi } from "@/lib/api";
import { findPostHouseholdId } from "@/lib/db/queries/posts";
import * as postService from "@/lib/services/posts";
import { postUpdateSchema } from "@/lib/validators";

const entity = { entity: "Post", findHouseholdId: findPostHouseholdId, allowApiKeys: true };

/** GET /api/v1/posts/:id */
export const GET = withEntityApi(entity, (ctx) => postService.getPost(ctx, ctx.id));

/** PATCH /api/v1/posts/:id */
export const PATCH = withEntityApi({ ...entity, body: postUpdateSchema }, (ctx) =>
  postService.updatePost(ctx, ctx.id, ctx.body),
);

/** DELETE /api/v1/posts/:id */
export const DELETE = withEntityApi(entity, (ctx) => postService.deletePost(ctx, ctx.id));
