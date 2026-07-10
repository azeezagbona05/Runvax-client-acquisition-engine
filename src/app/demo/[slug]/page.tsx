import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface DemoData {
  content: {
    headline: string;
    subheadline: string;
    about: string;
    services: { title: string; desc: string }[];
    whyChooseUs: string[];
    ctaText: string;
    accent: string;
  };
  business: {
    name: string;
    category: string;
    address: string;
    city: string;
    phone: string | null;
    phoneIntl: string | null;
    rating: number | null;
    reviewCount: number | null;
    location: { latitude: number; longitude: number } | null;
    openingHours: string[];
    reviews: { author: string; rating: number; text: string; time: string }[];
  };
}

async function getDemo(slug: string) {
  const demo = await prisma.demoSite.findUnique({ where: { slug } });
  if (!demo) return null;
  return demo.data as unknown as DemoData;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getDemo(params.slug);
  if (!data) return { title: 'Site preview' };
  return {
    title: `${data.business.name} — ${data.business.category}`,
    description: data.content.subheadline,
  };
}

function waLink(phoneIntl: string | null, phone: string | null): string | null {
  const raw = phoneIntl || phone;
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent("Hi! I saw your website and I'd like to know more.")}` : null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`${rating} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= Math.round(rating) ? '#f5a623' : '#d8dde6' }}>★</span>
      ))}
    </span>
  );
}

export default async function DemoSitePage({ params }: { params: { slug: string } }) {
  const data = await getDemo(params.slug);
  if (!data) notFound();

  // Count the view once per render (fire-and-forget)
  prisma.demoSite.update({ where: { slug: params.slug }, data: { views: { increment: 1 } } }).catch(() => {});

  const { content, business } = data;
  const accent = content.accent || '#7c3aed';
  const wa = waLink(business.phoneIntl, business.phone);
  const tel = business.phone ? `tel:${business.phone.replace(/\s+/g, '')}` : null;
  const mapSrc = business.location
    ? `https://www.google.com/maps?q=${business.location.latitude},${business.location.longitude}&z=15&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(business.address)}&output=embed`;

  return (
    <main style={{ background: '#ffffff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #eef0f3' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{business.name}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {tel && <a href={tel} style={{ fontSize: 14, fontWeight: 700, color: accent, padding: '8px 14px', borderRadius: 10, border: `1px solid ${accent}33` }}>Call</a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 700, color: '#fff', background: accent, padding: '8px 14px', borderRadius: 10 }}>WhatsApp</a>}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: `linear-gradient(135deg, ${accent}14, #f8fafc 60%)`, borderBottom: '1px solid #eef0f3' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 20px 64px', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', fontSize: 13, fontWeight: 700, color: accent, background: `${accent}14`, padding: '6px 14px', borderRadius: 999, marginBottom: 18 }}>
            {business.category}{business.city ? ` · ${business.city}` : ''}
          </span>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 900, margin: '0 0 16px', maxWidth: 760, marginInline: 'auto' }}>{content.headline}</h1>
          <p style={{ fontSize: 18, color: '#475569', maxWidth: 600, margin: '0 auto 28px' }}>{content.subheadline}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, fontWeight: 800, color: '#fff', background: accent, padding: '14px 28px', borderRadius: 12 }}>{content.ctaText || 'Get in touch'}</a>}
            {tel && <a href={tel} style={{ fontSize: 16, fontWeight: 800, color: accent, background: '#fff', border: `1px solid ${accent}44`, padding: '14px 28px', borderRadius: 12 }}>Call now</a>}
          </div>
          {business.rating != null && (
            <div style={{ marginTop: 26, fontSize: 15, color: '#475569' }}>
              <Stars rating={business.rating} /> &nbsp;<strong>{business.rating}</strong>{business.reviewCount ? ` · ${business.reviewCount} reviews on Google` : ''}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: accent, marginBottom: 14 }}>About Us</h2>
        <p style={{ fontSize: 20, lineHeight: 1.6, color: '#1e293b' }}>{content.about}</p>
      </section>

      {/* Services */}
      {content.services?.length > 0 && (
        <section style={{ background: '#f8fafc', borderTop: '1px solid #eef0f3', borderBottom: '1px solid #eef0f3' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 20px' }}>
            <h2 style={{ textAlign: 'center', fontSize: 30, fontWeight: 900, marginBottom: 8 }}>What We Offer</h2>
            <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 40 }}>Services tailored to you</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              {content.services.map((s, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #eef0f3', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}14`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, marginBottom: 14 }}>{i + 1}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{s.title}</h3>
                  <p style={{ color: '#64748b', fontSize: 15, lineHeight: 1.5 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why choose us */}
      {content.whyChooseUs?.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 20px' }}>
          <h2 style={{ textAlign: 'center', fontSize: 30, fontWeight: 900, marginBottom: 40 }}>Why Choose {business.name}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {content.whyChooseUs.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ color: accent, fontWeight: 900, fontSize: 20, lineHeight: 1.3 }}>✓</span>
                <span style={{ fontSize: 16, color: '#334155', lineHeight: 1.5 }}>{w}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      {business.reviews?.length > 0 && (
        <section style={{ background: '#f8fafc', borderTop: '1px solid #eef0f3', borderBottom: '1px solid #eef0f3' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 20px' }}>
            <h2 style={{ textAlign: 'center', fontSize: 30, fontWeight: 900, marginBottom: 40 }}>What Our Customers Say</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {business.reviews.map((r, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #eef0f3', borderRadius: 16, padding: 24 }}>
                  <div style={{ marginBottom: 10, fontSize: 15 }}><Stars rating={r.rating} /></div>
                  <p style={{ color: '#334155', fontSize: 15, lineHeight: 1.6, marginBottom: 14 }}>&ldquo;{r.text}&rdquo;</p>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.author}{r.time ? <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {r.time}</span> : null}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Hours + Map */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'start' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 18 }}>Visit Us</h2>
          <p style={{ color: '#475569', fontSize: 16, lineHeight: 1.6, marginBottom: 18 }}>{business.address}</p>
          {business.phone && <p style={{ fontSize: 16, marginBottom: 18 }}>📞 <a href={tel ?? '#'} style={{ color: accent, fontWeight: 700 }}>{business.phone}</a></p>}
          {business.openingHours?.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', marginBottom: 10 }}>Opening Hours</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: '#334155', fontSize: 15, lineHeight: 1.9 }}>
                {business.openingHours.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #eef0f3', minHeight: 300 }}>
          <iframe title="Map" src={mapSrc} width="100%" height="320" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </section>

      {/* CTA band */}
      <section style={{ background: accent }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '56px 20px', textAlign: 'center', color: '#fff' }}>
          <h2 style={{ fontSize: 30, fontWeight: 900, marginBottom: 12 }}>Ready to get started?</h2>
          <p style={{ fontSize: 17, opacity: 0.9, marginBottom: 26 }}>Reach out today — we&apos;d love to hear from you.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ fontSize: 16, fontWeight: 800, color: accent, background: '#fff', padding: '14px 28px', borderRadius: 12 }}>{content.ctaText || 'Message us'}</a>}
            {tel && <a href={tel} style={{ fontSize: 16, fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,0.5)', padding: '14px 28px', borderRadius: 12 }}>Call now</a>}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0f172a', color: '#94a3b8' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontWeight: 800, color: '#fff', fontSize: 18, marginBottom: 6 }}>{business.name}</div>
          <div style={{ fontSize: 14, marginBottom: 18 }}>{business.address}</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Made with{' '}
            <a href="/" style={{ color: '#c4b5fd', fontWeight: 700 }}>Runvax</a>
            {' '}— a free preview of your website
          </div>
        </div>
      </footer>
    </main>
  );
}
