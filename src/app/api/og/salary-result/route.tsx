import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { decodeState } from "@/lib/salary-calculator/url-state";
import { calculateEmploymentNet } from "@/lib/salary-calculator/engine/mode-a";
import { calculateFreelanceNet } from "@/lib/salary-calculator/engine/freelance";
import { calculateCompanyNet } from "@/lib/salary-calculator/engine/company";

export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

function money(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-PT" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Per-result share image (growth plan, Nov 2026) — every link the
 *  calculator's own `handleShare()` builds used to preview as the same
 *  generic `/og-image.png` brand card, regardless of what the person
 *  actually calculated. This renders the real number instead, so a shared
 *  link reads as "look what I'd take home," not an ad. Pure function of
 *  `?s=` (the calculator's own existing shareable-state encoding) — same
 *  square-crop-safety discipline as `og-image.png` (everything centered,
 *  nothing load-bearing near the left/right edges a square crop would cut). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const encoded = searchParams.get("s");
  const locale = searchParams.get("locale") === "pt" ? "pt" : "en";
  const state = encoded ? decodeState(encoded) : null;

  if (!state) return NextResponse.redirect(`${origin}/og-image.png`);

  const t = await getTranslations({ locale, namespace: "salaryCalculator" });

  let label: string;
  let headline: string;
  let sub: string | null = null;

  try {
    if (state.mode === "employment") {
      const result = calculateEmploymentNet(state.profile, state.employmentInput);
      label = t("ogImageLabelEmployment");
      headline = money(result.monthly.netIncludingMeal, locale);
      sub = t("ogImageGrossPrefix", { amount: money(result.monthly.gross, locale) });
    } else if (state.mode === "freelance") {
      const result = calculateFreelanceNet(state.profile, state.freelanceInput);
      label = t("ogImageLabelFreelance");
      headline = money(result.monthly.trueNet, locale);
    } else {
      const result = calculateCompanyNet(state.profile, state.companyInput);
      label = t("ogImageLabelCompany");
      headline = money(result.person.takeHomeMonthlyEquivalent, locale);
    }
  } catch {
    return NextResponse.redirect(`${origin}/og-image.png`);
  }

  const ink = "#182230";
  const pine = "#465bff";
  const muted = "#667085";

  const image = new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e3e7ff 0%, #eee3ff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>
          <span style={{ color: ink }}>just</span>
          <span style={{ color: pine }}>it</span>
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 24, color: muted }}>{label}</div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 92, fontWeight: 800, color: ink }}>{headline}</div>
        {sub && <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: pine, fontWeight: 600 }}>{sub}</div>}
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );

  image.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return image;
}
