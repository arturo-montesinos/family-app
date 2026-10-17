import { withHouseholdApi } from "@/lib/api";
import * as postService from "@/lib/services/posts";
import { postCreateSchema, postListQuerySchema } from "@/lib/validators";

/** GET /api/v1/households/:id/posts[?pinned=true&limit=50] */
export const GET = withHouseholdApi({ query: postListQuerySchema }, (ctx) =>
  postService.listPosts(ctx, ctx.query),
);

/** POST /api/v1/households/:id/posts */
export const POST = withHouseholdApi({ body: postCreateSchema, status: 201 }, (ctx) =>
  postService.createPost(ctx, ctx.body),
);
