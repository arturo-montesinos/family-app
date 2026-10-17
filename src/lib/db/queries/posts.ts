import { and, desc, eq, not, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { posts, users, type Post } from "@/lib/db/schema";

export type PostWithAuthor = Post & { authorName: string | null; authorImage: string | null };

export type PostFilter = { pinned?: boolean; limit?: number };

/** Pinned first, then newest. */
export async function listPosts(householdId: string, filter: PostFilter = {}): Promise<PostWithAuthor[]> {
  const conds: SQL[] = [eq(posts.householdId, householdId)];
  if (filter.pinned !== undefined) conds.push(eq(posts.pinned, filter.pinned));
  return db
    .select({
      id: posts.id,
      householdId: posts.householdId,
      authorId: posts.authorId,
      body: posts.body,
      pinned: posts.pinned,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(and(...conds))
    .orderBy(desc(posts.pinned), desc(posts.createdAt))
    .limit(filter.limit ?? 100);
}

export async function getPost(householdId: string, postId: string): Promise<Post | null> {
  const [row] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.householdId, householdId), eq(posts.id, postId)))
    .limit(1);
  return row ?? null;
}

export async function findPostHouseholdId(postId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: posts.householdId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row?.householdId ?? null;
}

export async function createPost(
  householdId: string,
  authorId: string,
  fields: { body: string; pinned?: boolean },
): Promise<Post> {
  const [row] = await db
    .insert(posts)
    .values({ ...fields, householdId, authorId })
    .returning();
  return row;
}

export async function updatePost(
  householdId: string,
  postId: string,
  patch: { body?: string; pinned?: boolean },
): Promise<Post | null> {
  const [row] = await db
    .update(posts)
    .set(patch)
    .where(and(eq(posts.householdId, householdId), eq(posts.id, postId)))
    .returning();
  return row ?? null;
}

export async function togglePin(householdId: string, postId: string): Promise<Post | null> {
  const [row] = await db
    .update(posts)
    .set({ pinned: not(posts.pinned) })
    .where(and(eq(posts.householdId, householdId), eq(posts.id, postId)))
    .returning();
  return row ?? null;
}

export async function deletePost(householdId: string, postId: string): Promise<boolean> {
  const rows = await db
    .delete(posts)
    .where(and(eq(posts.householdId, householdId), eq(posts.id, postId)))
    .returning({ id: posts.id });
  return rows.length > 0;
}
