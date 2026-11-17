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

// Calibrated against a real rendered measurement from this exact pipeline
// (macOS Quick Look's system sans), not a generic font-metrics table. A
// first version guessed 0.6em/char and ran both the stat and the caption
// straight off the 1200px canvas. Re-measured directly off that failed
// render ("€3.680" at font-size 220 filled the full 1120px text area
// across 6 characters, ≈0.85em/char) and added real margin on top, since
// this only needs to reliably fit, not be typographically exact.
const BOLD_CHAR_WIDTH_EM = 0.95;
const REGULAR_CHAR_WIDTH_EM = 0.74;

function estimateWidth(text: string, fontSize: number, charWidthEm: number): number {
  return text.length * fontSize * charWidthEm;
}

/** Greedy word-wrap, breaking only on spaces, each line kept under
 *  `maxWidth` at the given font size. */
function wrapText(text: string, fontSize: number, charWidthEm: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateWidth(candidate, fontSize, charWidthEm) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * A branded stat card at the same 1200x800 (3:2) aspect ratio every other
 * post's own photographed `coverImage` already uses, this project has no
 * photo-sourcing step of its own, so a real, on-brand stat (not a stock
 * photo) is the honest substitute for a post that's fundamentally about
 * one real number, same "never fake it, show the real thing" discipline
 * as the bar charts above.
 */
function renderCover(eyebrow: string, stat: string, caption: string): string {
  const width = 1200;
  const height = 800;
  const maxTextWidth = width - 80 * 2;

  const maxStatFontSize = 220;
  const statFontSize = Math.min(maxStatFontSize, maxTextWidth / (stat.length * BOLD_CHAR_WIDTH_EM));

  const captionFontSize = 36;
  const captionLines = wrapText(caption, captionFontSize, REGULAR_CHAR_WIDTH_EM, maxTextWidth);
  const captionLineHeight = captionFontSize * 1.35;

  const statBaselineY = 400;
  const captionStartY = statBaselineY + 70;
  const captionText = captionLines
    .map((line, i) => `<tspan x="80" y="${captionStartY + i * captionLineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(eyebrow)}: ${escapeXml(stat)}, ${escapeXml(caption)}">
  <rect width="${width}" height="${height}" fill="${PINE}" />
  <text x="80" y="140" font-family="system-ui, sans-serif" font-size="28" font-weight="700" letter-spacing="2" fill="#ffffff" opacity="0.75">${escapeXml(eyebrow)}</text>
  <text x="80" y="${statBaselineY}" font-family="system-ui, sans-serif" font-size="${statFontSize.toFixed(1)}" font-weight="800" fill="#ffffff">${escapeXml(stat)}</text>
  <text font-family="system-ui, sans-serif" font-size="${captionFontSize}" font-weight="500" fill="#ffffff" opacity="0.92">${captionText}</text>
</svg>`;
}

function writeCover(outPath: string, eyebrow: string, stat: string, caption: string) {
  const svg = renderCover(eyebrow, stat, caption);
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

// ── onde-estao-vagas-it-portugal charts + cover ──────────────────────────
// Source: lidermagazine.sapo.pt, "Lisboa e Porto concentram 82% das vagas
// tech em Portugal" (21 Apr 2026), Teamlyzer's own analysis of 8,730 real
// tech job postings over the prior 12 months. Real regional percentages,
// not estimated or rounded beyond what the source itself published.

writeChart("blog/vagas-it-regiao-pt.svg", "Vagas de IT por região (Teamlyzer, 2026)", [
  { label: "Lisboa", value: 51.72 },
  { label: "Porto", value: 30.44 },
  { label: "Braga", value: 6.53 },
  { label: "Aveiro", value: 4.64 },
  { label: "Coimbra", value: 4.41 },
  { label: "Setúbal", value: 1.29 },
  { label: "Évora", value: 0.27 },
  { label: "Faro", value: 0.26 },
  { label: "Açores", value: 0.24 },
  { label: "Madeira", value: 0.23 },
  { label: "Outros distritos (combinados)", value: 0.77 },
]);

writeChart("blog/vagas-it-regiao-en.svg", "IT job postings by region (Teamlyzer, 2026)", [
  { label: "Lisbon", value: 51.72 },
  { label: "Porto", value: 30.44 },
  { label: "Braga", value: 6.53 },
  { label: "Aveiro", value: 4.64 },
  { label: "Coimbra", value: 4.41 },
  { label: "Setúbal", value: 1.29 },
  { label: "Évora", value: 0.27 },
  { label: "Faro", value: 0.26 },
  { label: "Azores", value: 0.24 },
  { label: "Madeira", value: 0.23 },
  { label: "Other districts (combined)", value: 0.77 },
]);

writeCover("blog/onde-estao-vagas-cover-pt.svg", "JUST IT", "82%", "das vagas de IT concentram-se em Lisboa e Porto");
writeCover("blog/onde-estao-vagas-cover-en.svg", "JUST IT", "82%", "of IT job postings sit in just Lisbon and Porto");

// ── visto-d8-regime-fiscal cover ─────────────────────────────────────────
// Source: vistos.mne.gov.pt (D8 income test) + CIRS art. 81º n.º 4 (the
// IFICI foreign-income exemption).

writeCover("blog/visto-d8-cover-pt.svg", "JUST IT", "€3.680", "rendimento mínimo mensal exigido para o Visto D8 em 2026");
writeCover("blog/visto-d8-cover-en.svg", "JUST IT", "€3,680", "minimum monthly income required for the D8 visa in 2026");
