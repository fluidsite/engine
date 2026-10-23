/**
 * JSON-LD generation. The engine always injects this, whatever the site's design,
 * so the record feeds Google Business Profile, rich results and (later) MCP.
 *
 * Produces a LocalBusiness node (with address, geo, hours, socials, rating), a
 * FAQPage when FAQs exist, and Service/Offer nodes for priced services. Returns
 * an array of plain objects; `renderJsonLdScript` serialises them into a script.
 */
import type { Business } from "../schema/business.ts";

const DAY_SCHEMA: Record<string, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

type Json = Record<string, unknown>;

function localBusiness(b: Business): Json {
  const base = (b.meta.canonicalUrl ?? b.url ?? "").replace(/\/+$/, "");
  const abs = (src: string): string => (base && src.startsWith("/") ? base + src : src);

  const node: Json = {
    "@context": "https://schema.org",
    "@type": b.schemaType ?? "LocalBusiness",
    name: b.name,
  };

  if (b.description) node.description = b.description;
  if (b.url) node.url = b.url;
  const images = [b.logo, ...b.cover, ...b.gallery].filter(Boolean).map((img) => abs(img!.src));
  if (images.length) node.image = images.length === 1 ? images[0] : images;
  if (b.phone) node.telephone = b.phone;
  if (b.email) node.email = b.email;

  if (b.address) {
    node.address = {
      "@type": "PostalAddress",
      ...(b.address.street ? { streetAddress: b.address.street } : {}),
      ...(b.address.locality ? { addressLocality: b.address.locality } : {}),
      ...(b.address.region ? { addressRegion: b.address.region } : {}),
      ...(b.address.postalCode ? { postalCode: b.address.postalCode } : {}),
      ...(b.address.country ? { addressCountry: b.address.country } : {}),
    };
  }
  if (b.geo) node.geo = { "@type": "GeoCoordinates", latitude: b.geo.lat, longitude: b.geo.lng };

  const hours = b.openingHours
    .filter((h) => !h.closed && h.opens && h.closes)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_SCHEMA[h.day],
      opens: h.opens,
      closes: h.closes,
    }));
  if (hours.length) node.openingHoursSpecification = hours;

  const sameAs = b.social.map((s) => s.url);
  if (sameAs.length) node.sameAs = sameAs;

  const employees = b.team.map((m) => {
    const person: Json = { "@type": "Person", name: m.name };
    if (m.role) person.jobTitle = m.role;
    if (m.photo) person.image = abs(m.photo.src);
    if (m.bio) person.description = m.bio;
    const personSameAs = m.social.map((s) => s.url);
    if (personSameAs.length) person.sameAs = personSameAs;
    return person;
  });
  if (employees.length) node.employee = employees;

  if (b.reviews && b.reviews.count > 0) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: b.reviews.rating,
      reviewCount: b.reviews.count,
    };
    const reviews = b.reviews.items.map((it) => {
      const review: Json = {
        "@type": "Review",
        author: { "@type": "Person", name: it.author },
        reviewRating: { "@type": "Rating", ratingValue: it.rating, bestRating: 5 },
      };
      if (it.text) review.reviewBody = it.text;
      return review;
    });
    if (reviews.length) node.review = reviews;
  }
  return node;
}

function faqPage(b: Business): Json | null {
  if (b.faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: b.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function serviceNodes(b: Business): Json[] {
  const nodes: Json[] = [];
  for (const member of b.team) {
    for (const s of member.services) {
      const offerPrice = s.price ?? s.variants[0]?.price ?? null;
      const offer: Json | null =
        offerPrice !== null
          ? {
              "@type": "Offer",
              price: (offerPrice / 100).toFixed(2),
              priceCurrency: s.currency,
              ...(s.bookingUrl || member.booking?.url
                ? { url: s.bookingUrl ?? member.booking?.url }
                : {}),
            }
          : null;
      nodes.push({
        "@context": "https://schema.org",
        "@type": "Service",
        name: s.name,
        ...(s.category ? { category: s.category } : {}),
        ...(s.description ? { description: s.description } : {}),
        provider: { "@type": "Person", name: member.name },
        ...(offer ? { offers: offer } : {}),
      });
    }
  }
  return nodes;
}

/** Build all JSON-LD nodes for a record. */
export function buildJsonLd(b: Business): Json[] {
  const nodes: Json[] = [localBusiness(b)];
  const faq = faqPage(b);
  if (faq) nodes.push(faq);
  nodes.push(...serviceNodes(b));
  return nodes;
}

/** Serialise nodes into a single <script type="application/ld+json"> tag. */
export function renderJsonLdScript(b: Business): string {
  const nodes = buildJsonLd(b);
  const json = JSON.stringify(nodes.length === 1 ? nodes[0] : nodes);
  // Escape </ so the payload can't break out of the script element.
  const safe = json.replace(/<\//g, "<\\/");
  return `<script type="application/ld+json">${safe}</script>`;
}
