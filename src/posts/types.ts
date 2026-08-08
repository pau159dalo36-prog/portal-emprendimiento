import type { Database } from "@/types/database.types";

export type PostRow = Database["public"]["Tables"]["posts"]["Row"];

export type PostAuthorRef = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type PostVideoRef = {
  id: string;
  title: string;
  caption: string | null;
  thumbnail_path: string | null;
  thumbnail_bucket: string | null;
  poster_path: string | null;
  poster_bucket: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  visibility: string;
};

export type PostProjectRef = {
  id: string;
  name: string;
  slug: string;
};

export type PostOrganizationRef = {
  id: string;
  name: string;
  slug: string;
};

export type PostWithDetails = PostRow & {
  author: PostAuthorRef | null;
  video: PostVideoRef | null;
  project: PostProjectRef | null;
  organization: PostOrganizationRef | null;
};
