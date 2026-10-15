// preview.ts — Studio default props for every promo composition (validated, no casts).
import preview from "../data/promo-preview.json";
import { parsePromoProps } from "./snapshot.ts";
import type { PromoFormat, PromoProps } from "./types.ts";

const base = parsePromoProps(preview);

export function previewProps(format: PromoFormat): PromoProps {
  return { ...base, variant: { ...base.variant, format } };
}
