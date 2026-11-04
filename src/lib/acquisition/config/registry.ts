import { IndustryConfigSchema, type IndustryConfig, type Offer } from './schema';
import { dental } from './industries/dental';

// Adding an industry = add a data file under ./industries and list it here.
const RAW: unknown[] = [dental];

let cache: Map<string, IndustryConfig> | null = null;

/** Validates every pack once; an invalid pack fails loudly rather than half-loading. */
export function loadIndustries(raw: unknown[] = RAW): Map<string, IndustryConfig> {
  const map = new Map<string, IndustryConfig>();
  for (const r of raw) {
    const cfg = IndustryConfigSchema.parse(r);
    if (map.has(cfg.id)) throw new Error(`Duplicate industry id "${cfg.id}"`);
    map.set(cfg.id, cfg);
  }
  return map;
}

function industries(): Map<string, IndustryConfig> {
  if (!cache) cache = loadIndustries();
  return cache;
}

export function listIndustries(): IndustryConfig[] {
  return Array.from(industries().values());
}

export function getIndustry(id: string): IndustryConfig | null {
  return industries().get(id) ?? null;
}

export function getOffer(industry: IndustryConfig, offerId: string): Offer | null {
  return industry.offers.find((o) => o.id === offerId) ?? null;
}
