import dns from 'node:dns/promises';
import { normalizeEmail, splitEmail } from '../shared/normalize.js';
import { VerificationStatus as S, ROLE_LOCALS, DISPOSABLE_DOMAINS } from '../shared/constants.js';
import { smtpProbe } from './smtp.js';

// Mailbox providers that tarpit/lie to RCPT probes or block them. We do not SMTP-probe these.
const NO_PROBE_MX = /(google\.com|googlemail\.com|outlook\.com|protection\.outlook\.com|yahoodns\.net|icloud\.com|pphosted\.com|mimecast\.com|barracudanetworks\.com)\.?$/i;

export const defaultResolver = {
  async mx(domain) { try { return (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority); } catch (e) { if (['ENOTFOUND', 'ENODATA', 'NXDOMAIN'].includes(e.code)) return []; throw e; } },
  async addr(domain) { try { return [...(await dns.resolve4(domain)).map(String)]; } catch (e) { if (['ENOTFOUND', 'ENODATA', 'NXDOMAIN'].includes(e.code)) return []; throw e; } },
};

/**
 * Create a verifier. Everything external (DNS, SMTP) is injectable for tests.
 *  options.smtp: false (default) -> no mailbox probing at all, DNS/MX only. true -> conservative probe.
 *  options.probeFrom: envelope sender used for MAIL FROM (use a domain you control with valid DNS).
 * Never sends mail. At most 2 RCPT commands per domain (one real, one random for catch-all), cached per domain; the
 * catch-all probe is one-per-domain-per-run. A temp failure (4xx/timeout) is retried once with backoff, then => UNKNOWN.
 */
export function createVerifier({ resolver = defaultResolver, probe = smtpProbe, smtp = false, probeFrom = 'postmaster@verifier.invalid', retryDelayMs = 2000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), randomLocal = () => 'zz' + Math.random().toString(36).slice(2, 12) + 'qx' } = {}) {
  const domainCache = new Map();

  async function inspectDomain(domain) {
    if (domainCache.has(domain)) return domainCache.get(domain);
    const p = (async () => {
      let mx; try { mx = await resolver.mx(domain); } catch (e) { return { dnsError: String(e.code || e.message) }; }
      if (mx.length) return { mx };
      let a; try { a = await resolver.addr(domain); } catch (e) { return { dnsError: String(e.code || e.message) }; }
      return a.length ? { mx: [{ exchange: domain, priority: 0 }], implicit: true } : { mx: [] };
    })();
    domainCache.set(domain, p); return p;
  }
  const catchAllCache = new Map();

  async function probeWithRetry(host, rcpts) {
    let r = await probe(host, { from: probeFrom, rcpts });
    const temp = (x) => !x.ok && (x.kind === 'timeout') || (x.ok && x.results.some((y) => y.code >= 400 && y.code < 500));
    if (temp(r) && retryDelayMs >= 0) { await sleep(retryDelayMs); r = await probe(host, { from: probeFrom, rcpts }); }
    return r;
  }

  /** @param ctx.discovered true if this exact address was seen on a public page (raises LIKELY_VALID eligibility) */
  async function verify(input, ctx = {}) {
    const email = normalizeEmail(input);
    const checks = { syntax: !!email, dns: null, mx: null, smtp: 'skipped', catchAll: null, disposable: false, roleBased: false };
    const reasons = [];
    const out = (status, confidence, extra = {}) => ({ email: email || input, status, confidence: +confidence.toFixed(2), checks, reasons, checkedAt: new Date().toISOString(), ...extra });
    if (!email) { reasons.push('Failed syntax validation'); return out(S.INVALID, 0.01); }
    const { local, domain } = splitEmail(email);

    if (DISPOSABLE_DOMAINS.has(domain)) { checks.disposable = true; reasons.push('Domain is a known disposable-mail provider'); return out(S.DISPOSABLE, 0.02); }
    checks.roleBased = ROLE_LOCALS.has(local) || ROLE_LOCALS.has(local.replace(/[-_.]/g, ''));

    const d = await inspectDomain(domain);
    if (d.dnsError) { checks.dns = 'error'; reasons.push(`DNS lookup failed temporarily (${d.dnsError})`); return out(S.UNKNOWN, 0.2); }
    if (!d.mx.length) { checks.dns = 'no-records'; checks.mx = false; reasons.push('Domain has no MX or address records; cannot receive mail'); return out(S.INVALID, 0.01); }
    checks.dns = 'ok'; checks.mx = true; if (d.implicit) reasons.push('No MX record; falling back to A record (RFC 5321 implicit MX)');

    let smtpVerdict = null; // 'accepted' | 'rejected' | 'catch-all' | 'temp' | 'blocked'
    const host = d.mx[0].exchange.replace(/\.$/, '');
    if (!smtp) reasons.push('SMTP mailbox check not enabled');
    else if (NO_PROBE_MX.test(host)) { checks.smtp = 'not-attempted-provider'; reasons.push(`MX ${host} belongs to a provider that blocks or misreports recipient probes; not probing`); }
    else {
      if (!catchAllCache.has(domain)) catchAllCache.set(domain, null);
      const needCatch = catchAllCache.get(domain) === null;
      const rcpts = needCatch ? [email, `${randomLocal()}@${domain}`] : [email];
      const r = await probeWithRetry(host, rcpts);
      if (!r.ok) { checks.smtp = r.kind === 'connect' || r.kind === 'timeout' ? 'unreachable' : 'protocol-error'; smtpVerdict = 'blocked'; reasons.push(`SMTP check could not complete (${r.error}); port 25 may be blocked from this network`); }
      else {
        const real = r.results[0]; const rand = r.results[1];
        checks.smtp = `${real.code}`;
        if (rand) { const ca = rand.code >= 200 && rand.code < 300; catchAllCache.set(domain, ca); }
        checks.catchAll = catchAllCache.get(domain);
        if (real.code >= 500) { smtpVerdict = /user|mailbox|recipient|exist|unknown|no such|invalid|not found|reject/i.test(real.message) || real.code === 550 || real.code === 551 || real.code === 553 ? 'rejected' : 'blocked'; if (smtpVerdict === 'blocked') reasons.push(`Server refused for non-mailbox reasons (${real.code} ${real.message.slice(0, 60)}) — possible policy/blocklist`); }
        else if (real.code >= 400) { smtpVerdict = 'temp'; reasons.push(`Temporary failure ${real.code} (greylisting or rate limit)`); }
        else smtpVerdict = checks.catchAll ? 'catch-all' : 'accepted';
      }
    }

    if (smtpVerdict === 'rejected') { reasons.push('Mail server rejected this recipient'); return out(S.INVALID, 0.03); }
    if (smtpVerdict === 'temp') return out(S.UNKNOWN, 0.25);
    if (smtpVerdict === 'catch-all') { reasons.push('Domain accepts any recipient (catch-all): acceptance proves nothing about this mailbox'); return out(checks.roleBased ? S.ROLE_BASED : S.CATCH_ALL, 0.4); }
    if (checks.roleBased) { reasons.push('Role-based address (shared mailbox, not an individual)'); return out(S.ROLE_BASED, smtpVerdict === 'accepted' ? 0.8 : 0.6); }
    if (smtpVerdict === 'accepted') { reasons.push('Server accepted RCPT for this address and rejected/was not catch-all. This is strong evidence, not proof of inbox delivery.'); return out(S.VERIFIED, ctx.discovered ? 0.95 : 0.88); }
    if (ctx.discovered) { reasons.push('Address was published on a public page and the domain can receive mail; mailbox not individually checked'); return out(S.LIKELY_VALID, 0.7); }
    reasons.push('Domain can receive mail, but this specific mailbox was not confirmed'); return out(S.UNVERIFIED, 0.3);
  }
  return { verify, inspectDomain };
}
