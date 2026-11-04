/**
 * Phase 2 boundary: research only. Static checks over every acquisition
 * source file (lib, API routes, pages) so that no path — including retries and
 * direct API requests — can reach Google Places, a model, email, WhatsApp, the
 * draft queue or the delivery gate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const rel = (p: string) => path.relative(ROOT, p);
const FILES = [
  ...walk(path.join(ROOT, 'src/lib/acquisition')),
  ...walk(path.join(ROOT, 'src/app/api/acquisition')),
  ...walk(path.join(ROOT, 'src/app/acquisition')),
];
const src = (f: string) => fs.readFileSync(f, 'utf8');
const imports = (f: string) => Array.from(src(f).matchAll(/from\s+['"]([^'"]+)['"]/g), (m) => m[1]);

// Phase 1 files that legitimately hold the (unused in Phase 2) outreach pieces.
const PHASE1_OUTREACH = ['src/lib/acquisition/llm.ts', 'src/lib/acquisition/gate.ts'];

describe('Phase 2 boundaries', () => {
  it('scans a meaningful set of files', () => expect(FILES.length).toBeGreaterThan(25));

  it.each([
    ['nodemailer', /^nodemailer$/],
    ['the email library', /@\/lib\/email$/],
    ['the existing email routes', /api\/(send-email|proposal|emails|enrich-email|verify-email)/],
    ['WhatsApp code', /whatsapp|waMessage|waRateLimit/i],
    ['the outreach composer', /@\/lib\/outreach\//],
    ['the OpenAI SDK', /^openai/],
    ['the existing AI layer', /@\/lib\/ai$/],
    ['the existing Places client', /@\/lib\/google-places$/],
    ['the existing crawler / directory scraper', /api\/(emails|enrich-email)/],
  ])('no acquisition file imports %s', (_name, re) => {
    for (const f of FILES) {
      if (PHASE1_OUTREACH.includes(rel(f)) && /openai|outreach/.test(String(re))) continue;
      for (const i of imports(f)) expect(re.test(i), `${rel(f)} imports ${i}`).toBe(false);
    }
  });

  it('only Phase 1 llm.ts uses the model wrapper; no Phase 2 file imports it', () => {
    for (const f of FILES) {
      if (rel(f) === 'src/lib/acquisition/llm.ts') continue;
      expect(imports(f).some((i) => /\/llm$/.test(i)), rel(f)).toBe(false);
    }
  });

  it('nothing outside the gate references deliverDraft (there is still no delivery path)', () => {
    for (const f of FILES) {
      if (rel(f) === 'src/lib/acquisition/gate.ts') continue;
      expect(src(f), rel(f)).not.toMatch(/deliverDraft/);
    }
  });

  it('drafts are created only by the deterministic draft service', () => {
    for (const f of FILES) {
      if (rel(f) === 'src/lib/acquisition/drafts.ts') continue;
      expect(src(f), rel(f)).not.toMatch(/acquisitionDraft\.(create|upsert)/);
    }
  });

  it('draft status changes only in the draft service, the outcome recorder and the gate', () => {
    const allowed = ['src/lib/acquisition/drafts.ts', 'src/lib/acquisition/outcomes.ts', 'src/lib/acquisition/gate.ts'];
    for (const f of FILES) {
      if (allowed.includes(rel(f))) continue;
      expect(src(f), rel(f)).not.toMatch(/acquisitionDraft\.update/);
    }
  });

  it('pitch generation and review use no model and no network', () => {
    for (const name of ['pitch.ts', 'drafts.ts', 'draftEvidence.ts', 'evidence.ts', 'outcomes.ts']) {
      const f = path.join(ROOT, 'src/lib/acquisition', name);
      expect(imports(f).some((i) => /\/llm$|^openai|@\/lib\/ai$|@\/lib\/email$|nodemailer|whatsapp/i.test(i)), name).toBe(false);
      expect(src(f), name).not.toMatch(/\bfetch\(|node:(http|https|dns)/);
    }
  });

  it('no Phase 2 code enqueues an outreach-phase task', () => {
    for (const f of FILES) {
      expect(src(f), rel(f)).not.toMatch(/type:\s*['"]acq\.(draft_outreach|classify_reply|follow_up|qualify)['"]/);
    }
  });

  it('searchPlaces is called only by the adapter and the discover task handler; pages never import the adapter', () => {
    for (const f of FILES) {
      if (['src/lib/acquisition/places/adapter.ts', 'src/lib/acquisition/tasks/handlers.ts'].includes(rel(f))) continue;
      expect(src(f), rel(f)).not.toMatch(/searchPlaces\s*\(/);
      if (rel(f).startsWith('src/app/') && !rel(f).startsWith('src/app/api/')) expect(imports(f).some((i) => /places\/adapter/.test(i)), rel(f)).toBe(false);
    }
  });

  it('only the discovery run route enqueues Places discovery, and it checks the gate first', () => {
    for (const f of FILES.filter((x) => rel(x).startsWith('src/app/'))) {
      if (rel(f) === 'src/app/api/acquisition/discovery/run/route.ts') {
        const s = src(f);
        expect(s.indexOf('placesActivation()')).toBeGreaterThan(-1);
        expect(s.indexOf('placesActivation()')).toBeLessThan(s.indexOf('enqueueAcqTask('));
        continue;
      }
      expect(src(f), rel(f)).not.toMatch(/acq\.discover/);
    }
  });

  it('the only network transport in the module is the activation-guarded fetcher', () => {
    for (const f of FILES) {
      const s = src(f);
      const usesNet = /from\s+['"]node:(http|https|dns)['"]|\bfetch\(/.test(s);
      if (rel(f) === 'src/lib/acquisition/web/fetcher.ts') {
        expect(s).toMatch(/if \(!ACTIVATION\.liveWebFetch\) return Promise\.reject/);
        expect(s).toMatch(/if \(!ACTIVATION\.liveWebFetch\) throw new ActivationError/);
        continue;
      }
      if (rel(f) === 'src/lib/acquisition/places/adapter.ts') {
        // The one Places request lives in livePlacesTransport, which is reachable only as the default of searchPlaces(), after the gates.
        expect(s.match(/\bfetch\(/g)?.length).toBe(1);
        expect(s.indexOf('fetch(')).toBeGreaterThan(s.indexOf('export const livePlacesTransport'));
        expect(s.indexOf('fetch(')).toBeLessThan(s.indexOf('export type SearchOutcome'));
        const callSite = s.indexOf('params.transport ?? livePlacesTransport');
        expect(callSite).toBeGreaterThan(s.indexOf('if (!a.allowed) throw new ActivationError'));
        expect(s.split('livePlacesTransport').length - 1).toBe(2); // its definition and that single use
        continue;
      }
      if (rel(f) === 'src/lib/acquisition/llm.ts') continue; // Phase 1, unused in Phase 2 (checked above)
      if (rel(f).startsWith('src/app/acquisition/')) continue; // browser fetches to our own /api routes
      expect(usesNet, `${rel(f)} has network access`).toBe(false);
    }
  });

  it('pages never render fetched HTML', () => {
    for (const f of FILES.filter((x) => x.endsWith('.tsx'))) expect(src(f), rel(f)).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
