import { requireAdmin } from "@/auth/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Choke point único: cualquier página bajo /admin exige rol admin (fail-closed
  // aunque una página futura olvide su propia comprobación).
  await requireAdmin();
  return <>{children}</>;
}