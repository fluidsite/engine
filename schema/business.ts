/**
 * The business record: the single source of truth for a Fluidsite client site.
 *
 * Loosely modelled on schema.org LocalBusiness. Every site reads its facts
 * from this record (never hardcoded), and the record also feeds JSON-LD, Google
 * Business Profile and, later, MCP. Services are deliberately booking-ready so an
 * AI agent can book them later.
 *
 * This file exports:
 *   - the Zod schema (`businessSchema`) for validation,
 *   - the inferred TypeScript types (`Business`, `TeamMember`, `Service`, …),
 *   - a JSON Schema version (`businessJsonSchema()`), via Zod v4's toJSONSchema.
 */
import { z } from "zod";

/** A time of day in 24h "HH:MM" form, e.g. "09:00". */
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24h), e.g. 09:00");

/** A calendar date in "YYYY-MM-DD" form. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const url = z.url();

// ---------------------------------------------------------------------------
// Shared value objects
// ---------------------------------------------------------------------------

export const imageSchema = z.object({
  /** Path relative to the site root, e.g. "/public/images/hero.webp". */
  src: z.string().min(1),
  /** Accessible alt text. Required so JSON-LD and a11y always have it. */
  alt: z.string().default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const addressSchema = z.object({
  /** Street address line, e.g. "Wood Lane". */
  street: z.string().optional(),
  /** Town/city, e.g. "Reading". */
  locality: z.string().optional(),
  /** County/state/region. */
  region: z.string().optional(),
  postalCode: z.string().optional(),
  /** ISO country code; defaults to GB. */
  country: z.string().default("GB"),
  /** Optional free-text display string if the parts aren't broken out. */
  raw: z.string().optional(),
});

export const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const dayOfWeek = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

/** One weekday's regular hours. `closed: true` means shut that day. */
export const openingHoursSchema = z.object({
  day: dayOfWeek,
  closed: z.boolean().default(false),
  opens: timeOfDay.optional(),
  closes: timeOfDay.optional(),
});

/** A one-off override for a specific date (holiday, early close, etc.). */
export const specialHoursSchema = z.object({
  date: isoDate,
  closed: z.boolean().default(false),
  opens: timeOfDay.optional(),
  closes: timeOfDay.optional(),
  /** e.g. "Bank holiday", "Christmas Eve — closing early". */
  note: z.string().optional(),
});

export const socialPlatform = z.enum([
  "instagram",
  "tiktok",
  "facebook",
  "linktree",
  "x",
  "youtube",
  "website",
  "other",
]);

export const socialLinkSchema = z.object({
  platform: socialPlatform,
  url,
  /** Optional display label, e.g. "@thecourtyardsalon_". */
  label: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Booking + services (booking-ready, per CLAUDE.md and IMPORT_NOTES)
// ---------------------------------------------------------------------------

/** How a practitioner takes bookings. Open-ended via "other". */
export const bookingProvider = z.enum([
  "fresha",
  "simplybook",
  "instagram_dm",
  "that_time",
  "external",
  "phone",
  "email",
  "other",
]);

export const bookingSchema = z.object({
  /** Tracking params (utm_*, fbclid, cartId) must be stripped before storing. */
  url: url.optional(),
  provider: bookingProvider,
  /** e.g. "Book via Instagram DM". */
  label: z.string().optional(),
});

export const priceType = z.enum(["fixed", "from", "consultation"]);

/** A pricing variant, e.g. short/medium/long hair. */
export const serviceVariantSchema = z.object({
  name: z.string().min(1),
  /** Price in pence. */
  price: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive().nullable().default(null),
});

export const serviceRequirementsSchema = z.object({
  patchTest: z.boolean().default(false),
  consultation: z.boolean().default(false),
  /** Deposit required to book, in pence. */
  depositPence: z.number().int().nonnegative().nullable().default(null),
  minAge: z.number().int().positive().nullable().default(null),
  notes: z.string().optional(),
});

/**
 * A bookable service. Prices are customer-facing: nothing is `verified` until
 * the practitioner confirms it, so extracted price lists land as verified:false.
 */
export const serviceSchema = z.object({
  /** Stable slug bookings reference, e.g. "amy-full-head-colour". */
  id: z.string().min(1),
  name: z.string().min(1),
  /** e.g. Colour, Cuts, Facials, Aesthetics, Training. */
  category: z.string().optional(),
  description: z.string().optional(),
  /** Base price in pence. Null when only variants carry prices, or unknown. */
  price: z.number().int().nonnegative().nullable().default(null),
  currency: z.string().default("GBP"),
  priceType: priceType.default("fixed"),
  /** Null (not zero) when not stated — flag it for review, never guess. */
  durationMinutes: z.number().int().positive().nullable().default(null),
  variants: z.array(serviceVariantSchema).default([]),
  requirements: serviceRequirementsSchema.prefault({}),
  /** Links to the owning team member's id. */
  practitionerId: z.string().optional(),
  /** Service-specific booking link; falls back to the member's booking url. */
  bookingUrl: url.optional(),
  bookingProvider: bookingProvider.optional(),
  /** False until the practitioner confirms the extracted price/detail. */
  verified: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

/**
 * A team member. This is a multi-practitioner model: each member can run their
 * own business with their own booking method, socials, price list and services.
 */
export const teamMemberSchema = z.object({
  /** Stable slug, e.g. "amy-duncan". Services reference it via practitionerId. */
  id: z.string().min(1),
  name: z.string().min(1),
  /** Role/title, e.g. "Co-Founder", "Holistic Facial Therapist". */
  role: z.string().optional(),
  /** Bio text; keep emoji exactly as written. */
  bio: z.string().optional(),
  photo: imageSchema.optional(),
  booking: bookingSchema.optional(),
  /** e.g. "Appointments available on Tuesdays". */
  availabilityNote: z.string().optional(),
  social: z.array(socialLinkSchema).default([]),
  /**
   * Original price-list image, kept until this member's services are verified.
   * While present, the site may render the image instead of the structured list.
   */
  priceListImage: imageSchema.optional(),
  services: z.array(serviceSchema).default([]),
});

// ---------------------------------------------------------------------------
// FAQs, reviews, content blocks
// ---------------------------------------------------------------------------

export const faqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const reviewItemSchema = z.object({
  author: z.string().min(1),
  rating: z.number().min(0).max(5),
  text: z.string().optional(),
  /** Link to the review or reviewer profile. */
  url: url.optional(),
  /** e.g. "in the last week" or an ISO date. */
  date: z.string().optional(),
});

/** A snapshot of an external review profile (e.g. Google). Live fetch comes later. */
export const reviewsSchema = z.object({
  provider: z.string().default("google"),
  rating: z.number().min(0).max(5),
  count: z.number().int().nonnegative(),
  /** "Leave a review" / profile link. */
  url: url.optional(),
  items: z.array(reviewItemSchema).default([]),
});

/**
 * A named narrative content block (e.g. "story", "directions", "cta"). Keeps the
 * schema flexible for page content without churn: site code references blocks by key.
 */
export const contentBlockSchema = z.object({
  heading: z.string().optional(),
  /** Plain text or light markdown. */
  body: z.string().optional(),
  images: z.array(imageSchema).default([]),
});

// ---------------------------------------------------------------------------
// The business record
// ---------------------------------------------------------------------------

export const businessSchema = z.object({
  /** Record schema version, for future migrations. */
  version: z.number().int().positive().default(1),

  name: z.string().min(1),
  legalName: z.string().optional(),
  /** Tagline / short description. */
  description: z.string().optional(),

  url: url.optional(),
  logo: imageSchema.optional(),

  address: addressSchema.optional(),
  geo: geoSchema.optional(),
  googlePlaceId: z.string().optional(),
  mapsUrl: url.optional(),

  phone: z.string().nullable().default(null),
  email: z.email().nullable().default(null),

  openingHours: z.array(openingHoursSchema).default([]),
  specialHours: z.array(specialHoursSchema).default([]),

  social: z.array(socialLinkSchema).default([]),

  /** Hero carousel images. */
  cover: z.array(imageSchema).default([]),
  /** Gallery images (e.g. the About section). */
  gallery: z.array(imageSchema).default([]),

  team: z.array(teamMemberSchema).default([]),
  faqs: z.array(faqSchema).default([]),
  reviews: reviewsSchema.optional(),

  /** Named narrative blocks keyed by slug (story, directions, cta, …). */
  content: z.record(z.string(), contentBlockSchema).default({}),

  /** Page metadata. */
  meta: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      canonicalUrl: url.optional(),
    })
    .default({}),

  /** Keep a small "Powered by Fluidsite" footer link. */
  poweredBy: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Image = z.infer<typeof imageSchema>;
export type Address = z.infer<typeof addressSchema>;
export type Geo = z.infer<typeof geoSchema>;
export type OpeningHours = z.infer<typeof openingHoursSchema>;
export type SpecialHours = z.infer<typeof specialHoursSchema>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type ServiceVariant = z.infer<typeof serviceVariantSchema>;
export type ServiceRequirements = z.infer<typeof serviceRequirementsSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type Faq = z.infer<typeof faqSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type Reviews = z.infer<typeof reviewsSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type Business = z.infer<typeof businessSchema>;

/** The record as authored (before defaults are applied). */
export type BusinessInput = z.input<typeof businessSchema>;

/** The JSON Schema representation of the business record. */
export function businessJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(businessSchema) as Record<string, unknown>;
}
