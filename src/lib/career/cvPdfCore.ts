import type { CareerProfileData } from '@/lib/career/types';

/** A clean single-column CV built ONLY from the given profile. Used by the browser download and by the submission worker (same bytes both ways). */
export async function cvPdfBytes(p: CareerProfileData): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, CW = W - M * 2;
  let y = M;
  const need = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const text = (t: string, size: number, o: { bold?: boolean; color?: [number, number, number]; gap?: number; indent?: number } = {}) => {
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...(o.color ?? [30, 41, 59]));
    for (const line of doc.splitTextToSize(t, CW - (o.indent ?? 0)) as string[]) { need(size + 3); doc.text(line, M + (o.indent ?? 0), y); y += size + 3; }
    y += o.gap ?? 0;
  };
  const section = (title: string) => { y += 8; need(30); text(title.toUpperCase(), 10.5, { bold: true, color: [109, 40, 217], gap: 1 }); doc.setDrawColor(226, 232, 240); doc.line(M, y - 2, W - M, y - 2); y += 4; };

  if (p.name) text(p.name, 22, { bold: true, gap: 2 });
  if (p.headline) text(p.headline, 12, { color: [71, 85, 105], gap: 2 });
  const contact = [p.email, p.phone, p.location].filter(Boolean).join('   |   '); if (contact) text(contact, 9.5, { color: [100, 116, 139] });
  if (p.summary) { section('Profile'); text(p.summary, 10.5, { gap: 2 }); }
  if (p.experience.length) {
    section('Experience');
    for (const r of p.experience) {
      text([r.title, r.company].filter(Boolean).join(' - '), 11, { bold: true });
      const meta = [[r.start, r.end].filter(Boolean).join(' - '), r.location].filter(Boolean).join('   |   '); if (meta) text(meta, 9.5, { color: [100, 116, 139], gap: 2 });
      for (const b of r.bullets) text(`•  ${b}`, 10.5, { indent: 8 });
      y += 6;
    }
  }
  if (p.education.length) { section('Education'); for (const e of p.education) { text([e.qualification, e.institution].filter(Boolean).join(' - '), 10.5, { bold: true }); const d = [e.start, e.end].filter(Boolean).join(' - '); if (d) text(d, 9.5, { color: [100, 116, 139] }); y += 4; } }
  if (p.skills.length) { section('Skills'); text(p.skills.join('  •  '), 10.5, { gap: 2 }); }
  if (p.certifications.length) { section('Certifications'); for (const c of p.certifications) text(`•  ${c}`, 10.5, { indent: 8 }); }
  if (p.achievements.length) { section('Achievements'); for (const a of p.achievements) text(`•  ${a}`, 10.5, { indent: 8 }); }
  return new Uint8Array(doc.output('arraybuffer'));
}

export const cvFileName = (p: CareerProfileData, label = '') => `${(p.name || 'cv').replace(/[^\w-]+/g, '_')}_CV${label ? '_' + label.replace(/[^\w-]+/g, '_').slice(0, 40) : ''}.pdf`;

