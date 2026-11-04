/**
 * Synthetic clinic websites for the Phase 2 scenarios. Entirely made up:
 * the clinics, people, addresses and numbers don't exist. Domains use the
 * .ng TLD for realism but are only ever served by the fixture transport.
 */

const filler = (topic: string) =>
  `<p>${topic} We welcome new patients from across Lagos and offer gentle, family-friendly care. ` +
  'Our team explains every option before treatment and we are happy to answer questions about costs, ' +
  'insurance and aftercare. Parking is available on site and the clinic is wheelchair accessible. ' +
  'We look forward to seeing you and your family at your next check-up visit with our friendly staff.</p>';

export const ROBOTS_ALLOW = { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nAllow: /\n' };

// S1 — modern site: booking provider, WhatsApp, chat widget, JSON-LD Dentist, contact form.
export const S1 = {
  domain: 'pearlsmile-s1.ng',
  responses: {
    'https://pearlsmile-s1.ng/robots.txt': ROBOTS_ALLOW,
    'https://pearlsmile-s1.ng/': { body: `<!doctype html><html><head><title>Pearl Smile Dental | Lekki</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:site_name" content="Pearl Smile Dental">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Dentist","name":"Pearl Smile Dental","address":{"@type":"PostalAddress","streetAddress":"12 Fixture Way","addressLocality":"Lekki"},"openingHours":"Mo-Sa 08:00-18:00"}</script>
<script src="https://embed.tawk.to/fixture/default"></script></head><body>
<h1>Pearl Smile Dental</h1>${filler('Teeth whitening, braces, dental implants and root canal treatment.')}
<a href="https://calendly.com/pearlsmile-fixture/consult">Book an appointment online</a>
<a href="https://wa.me/2348000000101">Chat on WhatsApp</a>
<a href="tel:+2348000000101">Call us</a>
<a href="/contact">Contact</a></body></html>` },
    'https://pearlsmile-s1.ng/contact': { body: `<html><body><h1>Contact</h1>${filler('Reach our front desk.')}
<form action="/send"><input type="email" name="email"><textarea name="message"></textarea></form>
<p>Email: <a href="mailto:info@pearlsmile-s1.ng">info@pearlsmile-s1.ng</a></p></body></html>` },
  },
};

// S2 — readable, phone-only site: no booking, no form, no WhatsApp, no JSON-LD.
export const S2 = {
  domain: 'coralteeth-s2.ng',
  responses: {
    'https://coralteeth-s2.ng/robots.txt': { status: 404 },
    'https://coralteeth-s2.ng/': { body: `<!doctype html><html><head><title>Coral Teeth Clinic - Ikeja</title>
<meta name="viewport" content="width=device-width"></head><body>
<h1>Coral Teeth Clinic</h1>${filler('We provide scaling and polishing, fillings and extraction.')}
<p>Open Monday to Friday 9am - 5pm.</p>
<p>To book, call <a href="tel:08000000202">0800 000 0202</a> or email reception@coralteeth-s2.ng</p>
<a href="/about">About</a></body></html>` },
    'https://coralteeth-s2.ng/about': { body: `<html><body><h1>About</h1>${filler('Serving Ikeja since 2009.')}</body></html>` },
  },
};

// S3 — JavaScript-only shell: nothing readable without a browser.
export const S3 = {
  domain: 'glowdental-s3.ng',
  responses: {
    'https://glowdental-s3.ng/robots.txt': ROBOTS_ALLOW,
    'https://glowdental-s3.ng/': { body: '<!doctype html><html><head><title>Glow Dental</title><script src="/a.js"></script><script src="/b.js"></script><script src="/c.js"></script></head><body><div id="root"></div><noscript>You need to enable JavaScript to run this app.</noscript></body></html>' },
  },
};

// S15 — Cloudflare-protected role inbox plus a named address (the named one must not be stored).
const cf = (email: string, key = 0x5a) => key.toString(16).padStart(2, '0') + Array.from(email, (ch) => (ch.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');
export const S15 = {
  domain: 'bluecrest-s15.ng',
  cfInbox: 'info@bluecrest-s15.ng',
  responses: {
    'https://bluecrest-s15.ng/robots.txt': ROBOTS_ALLOW,
    'https://bluecrest-s15.ng/': { body: `<html><head><meta name="viewport" content="width=device-width"></head><body><h1>Bluecrest Dental</h1>${filler('Orthodontic care and veneers.')}
<p>Write to <a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="${cf('info@bluecrest-s15.ng')}">[email protected]</a>.</p>
<p>Our principal, Dr Fixture Adeyemi, can be reached at dr.adeyemi@bluecrest-s15.ng. Site by <a href="mailto:info@webagency-fixture.com">info@webagency-fixture.com</a></p>
</body></html>` },
  },
};

export const ALL_SITES = [S1, S2, S3, S15];
export const allResponses = () => Object.assign({}, ...ALL_SITES.map((s) => s.responses));
