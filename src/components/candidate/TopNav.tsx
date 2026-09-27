import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginMenu } from "@/components/nav/LoginMenu";
import { SearchBar } from "@/components/nav/SearchBar";
import { getLocations } from "@/lib/db/locations";

/**
 * Public top nav (§7.3): role-split Log in dropdown + a real, centered
 * search (§7.1 phase 5) + language switcher. "Add offer" lives inside
 * LoginMenu — it only makes sense logged-out, and that's the one place
 * that already knows auth state. LoginMenu/SearchBar are the only
 * client-side pieces; this stays a server component so it can fetch the
 * curated locations list SearchBar's "near" picker needs.
 */
export async function TopNav() {
  const locale = await getLocale();
  const brand = await getTranslations({ locale, namespace: "brand" });
  const locations = await getLocations();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/jobs" className="shrink-0 leading-tight">
          <span className="block font-display text-lg font-bold text-pine">{brand("name")}</span>
          <span className="block text-[11px] text-muted">{brand("navTagline")}</span>
        </Link>

        <SearchBar locations={locations} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <LoginMenu />
        </div>
      </div>
    </header>
  );
}
