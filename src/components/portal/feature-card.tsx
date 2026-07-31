import { ArrowRight } from "lucide-react";

type FeatureCardProps = {
  title: string;
  description: string;
  badge: string;
};

export function FeatureCard({ title, description, badge }: FeatureCardProps) {
  return (
    <article className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
        {badge}
      </div>
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
      <div className="mt-6 flex items-center text-sm font-medium text-primary">
        Explorar <ArrowRight className="ml-2 h-4 w-4" />
      </div>
    </article>
  );
}
