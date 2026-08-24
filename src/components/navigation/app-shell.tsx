import { getCurrentUser } from "@/auth/session";
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { TopHeader } from "@/components/navigation/top-header";

export type ShellUser = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role?: string;
};

export type ShellUnreadCounts = {
  notifications: number;
  messages: number;
};

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getCurrentUser();

  let shellUser: ShellUser | null = null;
  let unreadCounts: ShellUnreadCounts | null = null;
  if (user) {
    const [profile, claims, notificationCount, messageCount] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.auth.getClaims(),
      supabase.rpc("get_unread_notification_count"),
      supabase.rpc("get_unread_messages_total"),
    ]);
    if (profile.data) {
      shellUser = {
        ...profile.data,
        role: claims.data?.claims?.app_metadata?.role ?? undefined,
      };
    }
    // Fail-closed: si una RPC falla, el badge muestra 0 (nunca rompe el shell).
    unreadCounts = {
      notifications: Number(notificationCount.data ?? 0),
      messages: Number(messageCount.data ?? 0),
    };
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopHeader user={shellUser} unreadCounts={unreadCounts} />
      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <DesktopSidebar user={shellUser} />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
          {children}
        </main>
      </div>
      <MobileBottomNav user={shellUser} />
    </div>
  );
}
