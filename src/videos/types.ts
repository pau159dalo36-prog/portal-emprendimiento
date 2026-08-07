import type { Database } from "@/types/database.types";

export type VideoRow = Database["public"]["Tables"]["videos"]["Row"];

export type VideoOwnerRef = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type VideoProjectRef = {
  id: string;
  name: string;
  slug: string;
};

export type VideoOrganizationRef = {
  id: string;
  name: string;
  slug: string;
};

export type VideoWithDetails = VideoRow & {
  owner: VideoOwnerRef | null;
  project: VideoProjectRef | null;
  organization: VideoOrganizationRef | null;
};
