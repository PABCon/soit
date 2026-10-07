/**
 * §5.7.6: the registry lookup is an interface so the provider behind it can
 * change without touching callers. Phase 1 implements ViesProvider; a
 * commercial registry provider (layer 3) is a second implementation of the
 * same interface, added only if VIES misses prove more than a trickle.
 */
export type NifLookupResult = {
  outcome: "found" | "not_found" | "undetermined";
  legalName?: string;
  reference?: string;
  source: "vies" | "provider" | "manual";
  /** Registered street address and city, when the provider has them (VIES
   *  never does — it only confirms VAT-enrollment + name; nif.pt's own
   *  registry record does). Used to prefill the company's address/location
   *  on first verification, never to overwrite something already set. */
  address?: string;
  city?: string;
};

export interface NifRegistryProvider {
  lookup(nif: string): Promise<NifLookupResult>;
}
