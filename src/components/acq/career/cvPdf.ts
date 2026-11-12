import type { CareerProfileData } from '@/lib/career/types';
import { cvFileName, cvPdfBytes } from '@/lib/career/cvPdfCore';

/** Browser download of the CV PDF. The bytes come from the shared core, so what you download is what the worker would upload. */
export async function downloadCvPdf(p: CareerProfileData, label = '') {
  const bytes = await cvPdfBytes(p);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = cvFileName(p, label); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
