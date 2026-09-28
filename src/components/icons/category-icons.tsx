import {
  Code2,
  LayoutTemplate,
  Server,
  Smartphone,
  Cloud,
  BarChart3,
  Brain,
  CheckCircle2,
  ShieldCheck,
  Headset,
  Building2,
  Briefcase,
  Palette,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

/** Generic concept icons for the 14 curated job categories (§7.1, real-
 *  usage QA — matches the tech filter row's circular-icon treatment).
 *  Unlike tech tags these aren't brands with a real logo, so lucide-react
 *  (a real runtime dependency here, unlike simple-icons — see tech-
 *  icons.tsx) gives clean, consistent generic glyphs instead. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "software-development": Code2,
  "frontend-development": LayoutTemplate,
  "backend-development": Server,
  "mobile-development": Smartphone,
  "devops-cloud": Cloud,
  "data-analytics": BarChart3,
  "ai-ml": Brain,
  "qa-testing": CheckCircle2,
  cybersecurity: ShieldCheck,
  "it-support": Headset,
  "enterprise-systems": Building2,
  "product-management": Briefcase,
  "ux-ui-design": Palette,
  "project-management": ClipboardList,
};

export function CategoryIcon({ slug, className = "h-5 w-5" }: { slug: string; className?: string }) {
  const Icon = CATEGORY_ICONS[slug];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden="true" />;
}
