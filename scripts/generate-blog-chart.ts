import fs from "node:fs";
import path from "node:path";

/**
 * Minimal, dependency-free horizontal bar-chart generator for blog content
 * (§content: lightweight static-asset images under /public/blog, same
 * convention as coverImage, no charting library, no client-side JS, just a
 * plain static SVG file referenced from markdown like any other image).
 * Deliberately a one-off script, not app infra, re-run by hand whenever a
 * future post needs a chart, same spirit as scripts/stripe-setup.mjs.
 */

const PINE = "#465bff";
const SUBTLE = "#eef2ff";
const INK = "#182230";
const MUTED = "#667085";
const LINE = "#e2e6ef";

type Bar = { label: string; value: number };

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderChart(title: string, bars: Bar[], unit = "%"): string {
  const width = 640;
  const padX = 24;
  const rowHeight = 56;
  const barHeight = 20;
  const labelGap = 6;
  const topPad = 56;
  const bottomPad = 20;
  const height = topPad + bars.length * rowHeight + bottomPad;
  const maxValue = Math.max(...bars.map((b) => b.value));
  const barAreaWidth = width - padX * 2 - 48; // reserve space for the value label after the bar

  const rows = bars
    .map((bar, i) => {
      const y = topPad + i * rowHeight;
      const barWidth = Math.max(4, (bar.value / maxValue) * barAreaWidth);
      const isTop = i === 0;
      const fill = isTop ? PINE : SUBTLE;
      const valueColor = isTop ? PINE : MUTED;
      return `
    <text x="${padX}" y="${y}" font-family="system-ui, sans-serif" font-size="13" fill="${INK}">${escapeXml(bar.label)}</text>
    <rect x="${padX}" y="${y + labelGap}" width="${barAreaWidth}" height="${barHeight}" rx="4" fill="${LINE}" opacity="0.4" />
    <rect x="${padX}" y="${y + labelGap}" width="${barWidth}" height="${barHeight}" rx="4" fill="${fill}" />
    <text x="${padX + barWidth + 10}" y="${y + labelGap + barHeight - 5}" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${valueColor}">${bar.value}${unit}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${padX}" y="30" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="${INK}">${escapeXml(title)}</text>
  ${rows}
</svg>`;
}

function writeChart(outPath: string, title: string, bars: Bar[]) {
  const svg = renderChart(title, bars);
  const full = path.join(process.cwd(), "public", outPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, svg, "utf8");
  console.log("wrote", outPath);
}

// ── inquerito-candidatos-it-2026 charts ──────────────────────────────────

writeChart("blog/inquerito-onde-encontraram-pt.svg", "Onde encontraram o último emprego", [
  { label: "LinkedIn", value: 84 },
  { label: "Recrutador ou headhunter", value: 32 },
  { label: "Rede pessoal / referência", value: 21 },
  { label: "Candidatura direta no site da empresa", value: 21 },
  { label: "Indeed", value: 11 },
  { label: "Net-Empregos", value: 6 },
  { label: "SAPO Emprego", value: 6 },
  { label: "ITJobs", value: 1 },
]);

writeChart("blog/inquerito-onde-encontraram-en.svg", "Where they found their last job", [
  { label: "LinkedIn", value: 84 },
  { label: "Recruiter or headhunter", value: 32 },
  { label: "Personal network / referral", value: 21 },
  { label: "Direct on the company's own site", value: 21 },
  { label: "Indeed", value: 11 },
  { label: "Net-Empregos", value: 6 },
  { label: "SAPO Emprego", value: 6 },
  { label: "ITJobs", value: 1 },
]);

writeChart("blog/inquerito-frustracoes-pt.svg", "Maiores frustrações na procura de emprego", [
  { label: "Salários nunca publicados", value: 74 },
  { label: "Demasiados intermediários/recrutadores", value: 63 },
  { label: "Ofertas irrelevantes ou de baixa qualidade", value: 45 },
  { label: "Empresas que publicam e nunca respondem", value: 39 },
]);

writeChart("blog/inquerito-frustracoes-en.svg", "Biggest job-hunting frustrations", [
  { label: "Salaries never published", value: 74 },
  { label: "Too many intermediaries/recruiters", value: 63 },
  { label: "Irrelevant or low-quality offers", value: 45 },
  { label: "Companies that post and never respond", value: 39 },
]);

writeChart("blog/inquerito-salario-visivel-pt.svg", "Se o salário estivesse sempre visível", [
  { label: "Usaria mais, mas não exclusivamente", value: 53 },
  { label: "Passaria a ser a minha plataforma principal", value: 31 },
  { label: "Não mudaria muito", value: 13 },
  { label: "Ficaria cético quanto à veracidade", value: 3 },
]);

writeChart("blog/inquerito-salario-visivel-en.svg", "If salary was always visible", [
  { label: "Would use it more, not exclusively", value: 53 },
  { label: "Would switch to it as primary platform", value: 31 },
  { label: "Wouldn't change much", value: 13 },
  { label: "Would be skeptical the ranges were accurate", value: 3 },
]);
