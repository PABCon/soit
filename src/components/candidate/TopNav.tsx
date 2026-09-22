import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginMenu } from "@/components/nav/LoginMenu";

/**
 * Public top nav (§7.3): role-split Log in dropdown + Add offer + search +
 * language switcher. LoginMenu is the only client-side piece — everything
 * else here stays a server component.
 */
export function TopNav() {
  const t = useTranslations("nav");
  const brand = useTranslations("brand");

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/jobs" className="font-display text-lg font-bold text-pine">
          {brand("name")}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <label className="hidden sm:block">
            <span className="sr-only">{t("search")}</span>
            <input
              type="search"
              placeholder={t("search")}
              className="h-9 w-56 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-muted"
            />
          </label>

          <LanguageSwitcher />

          <LoginMenu />

          <Link
            href="/recruit"
            className="flex h-9 items-center rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90"
          >
            {t("addOffer")}
          </Link>
        </div>
      </div>
    </header>
  );
}
