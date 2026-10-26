import { extractJobLinksFromUrl } from "@/lib/ai/extract-job-links";

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error("Usage: tsx scripts/check-import-discovery.ts <url>");
  const result = await extractJobLinksFromUrl(url);
  if (!result.ok) {
    console.log("FAILED:", result.reason);
    return;
  }
  console.log(`Found ${result.links.length} job link(s):`);
  result.links.forEach((l, i) => console.log(`${i + 1}. ${l.title ?? "(no title)"} -> ${l.url}`));
}

main();
