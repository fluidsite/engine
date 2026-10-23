/**
 * SEO / AI-discovery assets the engine generates for every site, alongside the
 * JSON-LD it injects. All derive from the business record: robots.txt, sitemap.xml,
 * llms.txt, summary.txt, a web manifest, a public copy of business.json, and PNG
 * icons rendered from the logo. Written into the build's staging dir so they land
 * at dist/ root.
 */
import { cp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { Business, Service, TeamMember } from "../schema/business.ts";

const DAY_LONG: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/** Canonical base URL without a trailing slash, or null if the record has none. */
function canonicalBase(b: Business): string | null {
  const raw = b.meta.canonicalUrl ?? b.url;
  return raw ? raw.replace(/\/+$/, "") : null;
}

function robotsTxt(base: string): string {
  return `User-Agent: *\nAllow: /\n\nHost: ${base}\nSitemap: ${base}/sitemap.xml\n`;
}

function sitemapXml(base: string): string {
  const lastmod = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>${base}</loc>
<lastmod>${lastmod}</lastmod>
<changefreq>weekly</changefreq>
<priority>1</priority>
</url>
</urlset>`;
}

/** "£42", "from £40", with optional duration and description, matching the old export. */
function priceLine(s: Service): string {
  const amount = s.price ?? s.variants[0]?.price ?? null;
  const symbol = s.currency === "GBP" ? "£" : `${s.currency} `;
  const price =
    amount === null ? "" : `${s.priceType === "from" ? "from " : ""}${symbol}${amount / 100}`;
  const category = s.category ? ` (${s.category})` : "";
  const parts = [`${s.name}${category}`];
  const tail = [price];
  const mins = s.durationMinutes ?? s.variants[0]?.durationMinutes ?? null;
  if (mins) tail.push(`${mins} mins`);
  if (s.description) tail.push(s.description);
  const tailStr = tail.filter(Boolean).join(", ");
  return `- ${parts[0]}${tailStr ? `: ${tailStr}` : ""}`;
}

function pricesSection(team: TeamMember[]): string {
  const blocks = team
    .filter((m) => m.services.length > 0)
    .map((m) => `### ${m.name}\n\n${m.services.map(priceLine).join("\n")}`);
  return blocks.length ? `\n\n## Prices\n\n${blocks.join("\n\n")}` : "";
}

function llmsTxt(b: Business, base: string): string {
  const summary = b.description ? `\n\n> ${b.description}` : "";
  return `# ${b.name}${summary}

## Machine-readable

- [Business record (JSON)](${base}/business.json): Structured, versioned data about this business.
- [Text summary](${base}/summary.txt): A concise plain-text profile of this business.

## Pages

- [Home](${base}): The business's public page.${pricesSection(b.team)}
`;
}

function summaryTxt(b: Business): string {
  const lines: string[] = [];
  lines.push(`Name: ${b.name}`);
  if (b.description) lines.push(`Summary: ${b.description}`);
  lines.push(`Phone: ${b.phone ?? "Not provided"}`);
  lines.push(`Area: ${b.address?.raw ?? "Not provided"}`);

  lines.push("", "Hours:");
  const byDay = new Map(b.openingHours.map((h) => [h.day, h]));
  for (const day of DAY_ORDER) {
    const h = byDay.get(day as never);
    if (!h) continue;
    const value = h.closed || !h.opens || !h.closes ? "Closed" : `${h.opens}–${h.closes}`;
    lines.push(`- ${DAY_LONG[day]}: ${value}`);
  }

  const services = b.team.flatMap((m) => m.services);
  lines.push("", "Services:", services.length ? services.map((s) => `- ${s.name}`).join("\n") : "Not provided");
  lines.push("", "Work:", "Not provided");
  lines.push("", "Credentials:", "Not provided");

  lines.push("", "Team:");
  for (const m of b.team) {
    const bio = m.bio ? ` — ${m.bio.replace(/\s*\n+\s*/g, " ").trim()}` : "";
    const role = m.role ? ` — ${m.role}` : "";
    lines.push(`- ${m.name}${role}${bio}`);
    for (const s of m.social) lines.push(`  ${s.platform}: ${s.url}`);
  }

  return lines.join("\n") + "\n";
}

function manifest(b: Business): string {
  return JSON.stringify(
    {
      name: b.name,
      short_name: b.name,
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2,
  );
}

/** Render square PNG icons from the logo, if one exists on disk. */
async function writeIcons(stagingDir: string, b: Business, siteRoot: string): Promise<void> {
  if (!b.logo?.src) return;
  const logoPath = join(siteRoot, b.logo.src.replace(/^\/+/, ""));
  if (!existsSync(logoPath)) return;

  const sizes: [string, number][] = [
    ["favicon.png", 32],
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ];
  await Promise.all(
    sizes.map(([file, size]) =>
      sharp(logoPath)
        .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(join(stagingDir, file)),
    ),
  );
}

/** Generate all SEO/discovery assets into the staging dir (becomes dist/). */
export async function writeSeoAssets(
  stagingDir: string,
  business: Business,
  siteRoot: string,
): Promise<void> {
  const base = canonicalBase(business);
  if (base) {
    await writeFile(join(stagingDir, "robots.txt"), robotsTxt(base), "utf8");
    await writeFile(join(stagingDir, "sitemap.xml"), sitemapXml(base), "utf8");
    await writeFile(join(stagingDir, "llms.txt"), llmsTxt(business, base), "utf8");
  }
  await writeFile(join(stagingDir, "summary.txt"), summaryTxt(business), "utf8");
  await writeFile(join(stagingDir, "manifest.webmanifest"), manifest(business), "utf8");

  const recordPath = join(siteRoot, "business.json");
  if (existsSync(recordPath)) await cp(recordPath, join(stagingDir, "business.json"));

  await writeIcons(stagingDir, business, siteRoot);
}
