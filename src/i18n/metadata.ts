import "server-only";
import { getTranslations } from "next-intl/server";
import { brand } from "@/config/brand";

export async function pageMetadataTitle(key: string): Promise<string> {
  const t = await getTranslations("metadata");
  return `${t(key)} — ${brand.name}`;
}
