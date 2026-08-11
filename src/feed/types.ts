// Tipos del feed. El item es la unidad que la UI renderiza: post + vídeo +
// autor + proyecto/organización + métricas públicas agregadas, todo en UN
// resultado de RPC (sin N+1). `scores` solo existe en "Para ti" y NO se muestra
// al usuario: sirve para auditoría interna, tests y debug.

export type FeedAuthor = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type FeedVideo = {
  id: string;
  title: string;
  caption: string | null;
  thumbnailPath: string | null;
  thumbnailBucket: string | null;
  posterPath: string | null;
  posterBucket: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
};

export type FeedProjectRef = {
  id: string;
  name: string;
  slug: string;
};

export type FeedOrganizationRef = {
  id: string;
  name: string;
  slug: string;
};

export type FeedPostRef = {
  id: string;
  postType: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
};

export type FeedMetrics = {
  qualifiedViews: number;
  plays: number;
  averageWatchSeconds: number;
  averageProgress: number;
  completionRate: number;
};

export type FeedScoreBreakdown = {
  recency: number;
  affinity: number;
  watch: number;
  completion: number;
  views: number;
  exploration: number;
  final: number;
};

export type FeedItem = {
  post: FeedPostRef;
  author: FeedAuthor | null;
  video: FeedVideo | null;
  project: FeedProjectRef | null;
  organization: FeedOrganizationRef | null;
  metrics: FeedMetrics;
  scores?: FeedScoreBreakdown;
};

// Item que viaja a la UI: es un FeedItem SIN el breakdown de scores. Los scores
// son internos (auditoría/tests) y nunca deben renderizarse ni exponerse al
// cliente; este tipo garantiza a nivel de tipos que no se pasan a la UI.
export type PublicFeedItem = Omit<FeedItem, "scores">;

// Cursor opaco para la UI: la capa de datos lo serializa/deserializa.
// - Para ti:     (final_score DESC, published_at DESC, id DESC)
// - Siguiendo:   (published_at DESC, id DESC)
export type ForYouCursor = {
  score: number;
  publishedAt: string;
  id: string;
};

export type FollowingCursor = {
  publishedAt: string;
  id: string;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
  hasFollows?: boolean;
};

export type FeedPageResult =
  | { ok: true; page: FeedPage }
  | { ok: false; error: string };
