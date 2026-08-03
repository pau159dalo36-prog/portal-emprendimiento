import { PublicHeader } from "@/components/shared/public-header";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
