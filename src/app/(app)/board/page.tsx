import { getPageContext } from "@/lib/page-context";
import { listPosts } from "@/lib/services/posts";
import { BoardView } from "@/components/board/board-view";

export const metadata = { title: "Board" };

export default async function BoardPage() {
  const ctx = await getPageContext();
  const posts = await listPosts(ctx, { limit: 200 });
  return <BoardView posts={posts} members={ctx.members} me={ctx.me} actor={ctx.actor} />;
}
