import CareerAgent from '@/components/acq/career/CareerAgent';

export const metadata = { title: 'Career Agent' };

export default function CareerPage() {
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Career Agent</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Upload your CV, say what job you want, and set what the agent may do. Your verified profile is the only source it works from.</p>
      </div>
      <CareerAgent />
    </div>
  );
}
