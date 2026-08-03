import { AppShell } from "@/components/navigation/app-shell";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
