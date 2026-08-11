// Carga inicial del feed de inicio (server side). Una sola función que el Server
// Component de la homepage invoca para obtener la PRIMERA página de "Para ti" y
// (si hay sesión) de "Siguiendo", y que la UI consume como estado inicial. Las
// páginas siguientes las pide el cliente con su propio cursor (ver FeedTabs).
//
// Seguridad/privacidad: los scores del breakdown (recency/affinity/watch/...)
// son internos. loadHomeFeed los ELIMINA del payload que se pasa a la UI; el
// tipo de retorno (PublicFeedItem) no incluye `scores`.
import type { SupabaseClient } from "@supabase/supabase-js";

import { getFollowingFeed, getForYouFeed } from "@/feed/data";
import type { FeedItem, PublicFeedItem } from "@/feed/types";
import type { Database } from "@/types/database.types";

export type HomeFeedPage =
  | { ok: true; items: PublicFeedItem[]; nextCursor: string | null; hasFollows?: boolean }
  | { ok: false; error: string };

export type HomeFeedData = {
  forYou: HomeFeedPage;
  following: HomeFeedPage | null;
};

function stripScores(items: FeedItem[]): PublicFeedItem[] {
  return items.map((item) => ({
    post: item.post,
    author: item.author,
    video: item.video,
    project: item.project,
    organization: item.organization,
    metrics: item.metrics,
  }));
}

export async function loadHomeFeed(
  supabase: SupabaseClient<Database>,
  userId: string | null,
): Promise<HomeFeedData> {
  const forYou = await getForYouFeed(supabase);
  const following = userId ? await getFollowingFeed(supabase) : null;

  return {
    forYou: forYou.ok
      ? {
          ok: true,
          items: stripScores(forYou.page.items),
          nextCursor: forYou.page.nextCursor,
        }
      : { ok: false, error: forYou.error },
    following: following
      ? following.ok
        ? {
            ok: true,
            items: stripScores(following.page.items),
            nextCursor: following.page.nextCursor,
            hasFollows: following.page.hasFollows,
          }
        : { ok: false, error: following.error }
      : null,
  };
}
