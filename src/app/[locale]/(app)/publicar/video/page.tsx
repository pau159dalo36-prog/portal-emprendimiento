import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/session";
import { VideoUploadForm } from "@/components/video/video-upload-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageMetadataTitle } from "@/i18n/metadata";

export async function generateMetadata() {
  return { title: await pageMetadataTitle("videoNew") };
}

export default async function NewVideoPage() {
  await requireUser();
  const t = await getTranslations("videos");

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t("newTitle")}</CardTitle>
          <CardDescription>{t("newDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <VideoUploadForm />
        </CardContent>
      </Card>
    </div>
  );
}
