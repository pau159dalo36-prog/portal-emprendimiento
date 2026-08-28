import { AppShell } from "@/components/navigation/app-shell";

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
