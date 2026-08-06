import { AppShell } from "@/components/navigation/app-shell";

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
