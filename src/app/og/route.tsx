import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const dynamic = 'force-static';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#030712',
          backgroundImage: 'radial-gradient(circle at 78% 22%, rgba(147,51,234,0.35), transparent 55%), radial-gradient(circle at 15% 85%, rgba(249,115,22,0.25), transparent 50%)',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '96px',
            height: '96px',
            borderRadius: '28px',
            marginBottom: '40px',
            backgroundImage: 'linear-gradient(135deg, #9333ea 0%, #f97316 100%)',
            boxShadow: '0 20px 60px rgba(147,51,234,0.35)',
          }}
        >
          <div style={{ display: 'flex', color: 'white', fontSize: '52px', fontWeight: 800 }}>R</div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '76px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Runvax
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: '20px',
            fontSize: '34px',
            fontWeight: 500,
            color: '#a3adc2',
            maxWidth: '820px',
            lineHeight: 1.4,
          }}
        >
          Find businesses that need a website. Generate AI cold outreach in seconds.
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginTop: '52px',
          }}
        >
          {['No website?', 'AI proposal.', 'One click.'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                fontSize: '22px',
                fontWeight: 600,
                color: '#e5e9f2',
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '999px',
                padding: '10px 24px',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
