import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CliArgs, CommandResult } from "../cli.ts";
import { readRawRecord, validateRecord, recordPath } from "../../lib/record.ts";
import { optimiseImage } from "../../lib/images.ts";
import type { Image } from "../../schema/business.ts";

/**
 * `fluidsite import` — one-off: optimise the exported site's images into
 * public/images/ (WebP, max 2000px) and rewrite the record's image paths to the
 * optimised copies, then write a review of anything ambiguous for the owner.
 *
 * Content was extracted into business.json from the export during scaffolding;
 * this command finalises the image pipeline and produces IMPORT_REVIEW.md and
 * PRICE_REVIEW.md. Idempotent: images already under /public/images are left as-is.
 */
export async function importCommand(args: CliArgs): Promise<CommandResult> {
  const site = resolve(args.site);
  const record = (await readRawRecord(site)) as Record<string, any>;
  const optimised: { from: string; to: string; width: number; height: number }[] = [];

  // Optimise one image field in place and return whether it changed.
  async function take(image: Image | undefined, destRel: string): Promise<Image | undefined> {
    if (!image?.src || !image.src.startsWith("/public/")) return image;
    if (image.src.startsWith("/public/images/")) return image; // already imported
    const srcAbs = join(site, image.src);
    if (!existsSync(srcAbs)) return image; // missing source: leave reference, flagged in review
    const destAbs = join(site, destRel);
    const quality = destRel.includes("pricelist") ? 90 : 82;
    const r = await optimiseImage(srcAbs, destAbs, { quality });
    optimised.push({ from: image.src, to: destRel, width: r.width, height: r.height });
    return { ...image, src: destRel, width: r.width, height: r.height };
  }

  if (record.logo) record.logo = await take(record.logo, "/public/images/logo.webp");
  if (Array.isArray(record.cover)) {
    for (let i = 0; i < record.cover.length; i++) {
      record.cover[i] = await take(record.cover[i], `/public/images/cover-${i + 1}.webp`);
    }
  }
  if (Array.isArray(record.gallery)) {
    for (let i = 0; i < record.gallery.length; i++) {
      record.gallery[i] = await take(record.gallery[i], `/public/images/gallery-${i + 1}.webp`);
    }
  }
  if (Array.isArray(record.team)) {
    for (const m of record.team) {
      if (m.photo) m.photo = await take(m.photo, `/public/images/team-${m.id}.webp`);
      if (m.priceListImage) {
        m.priceListImage = await take(m.priceListImage, `/public/images/team-${m.id}-pricelist.webp`);
      }
    }
  }

  // Validate and write the finalised record.
  const validated = validateRecord(record);
  await writeFile(recordPath(site), JSON.stringify(validated, null, 2) + "\n", "utf8");

  // --- review docs ---------------------------------------------------------
  const review = buildImportReview(validated);
  const prices = buildPriceReview(validated);
  await writeFile(join(site, "IMPORT_REVIEW.md"), review.md, "utf8");
  await writeFile(join(site, "PRICE_REVIEW.md"), prices.md, "utf8");

  return {
    ok: true,
    command: "import",
    imagesOptimised: optimised.length,
    optimised,
    reviewItems: review.items,
    priceReview: prices.summary,
    wrote: ["business.json", "IMPORT_REVIEW.md", "PRICE_REVIEW.md"],
  };
}

function buildImportReview(b: any): { md: string; items: string[] } {
  const items: string[] = [];
  if (!b.phone) items.push("Phone number is missing — not present in the export. Please provide one.");
  if (!b.email) items.push("Email is missing — not present in the export. Please provide one.");
  if ((b.faqs?.length ?? 0) === 0)
    items.push("FAQs are empty — the export's single FAQ was a placeholder and was dropped. Please supply real FAQs.");
  const noPrices = (b.team ?? []).filter((m: any) => !m.priceListImage && (m.services?.length ?? 0) === 0);
  if (noPrices.length)
    items.push(`No price list for: ${noPrices.map((m: any) => m.name).join(", ")}. Confirm whether services should be listed.`);
  items.push("Booking URLs had tracking params (utm_*, fbclid, cartId) stripped — please confirm each link still works.");
  items.push('The "Our story" text was truncated in the export; it has been completed in business.json — please confirm the wording.');
  items.push("Enquiry form posts nowhere yet — provide a destination email for the Cloudflare Pages Function.");

  const md =
    `# Import review — ${b.name}\n\n` +
    `Things to confirm after importing from the old Fluidsite export.\n\n` +
    items.map((i) => `- [ ] ${i}`).join("\n") +
    `\n`;
  return { md, items };
}

function buildPriceReview(b: any): { md: string; summary: Record<string, unknown> } {
  const rows = (b.team ?? []).map((m: any) => ({
    name: m.name,
    hasPriceListImage: !!m.priceListImage,
    servicesExtracted: m.services?.length ?? 0,
  }));
  const md =
    `# Price review — ${b.name}\n\n` +
    `Per practitioner. Services are not extracted yet; run \`fluidsite extract-prices\` on\n` +
    `each price-list image (Claude vision), then the practitioner confirms before anything\n` +
    `is marked \`verified: true\`.\n\n` +
    `| Practitioner | Price list image | Services extracted |\n| --- | --- | --- |\n` +
    rows
      .map((r: any) => `| ${r.name} | ${r.hasPriceListImage ? "yes" : "—"} | ${r.servicesExtracted} |`)
      .join("\n") +
    `\n`;
  return { md, summary: { practitioners: rows } };
}
