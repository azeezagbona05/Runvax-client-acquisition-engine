'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import DraftReview from '../../_components/DraftReview';
import { api } from '../../_components/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AcquisitionDraftPage({ params }: { params: { id: string } }) {
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const load = useCallback(async () => {
    try { setDetail(await api<any>(`/api/acquisition/drafts/${params.id}`)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-4">
      <Link href="/acquisition/drafts" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /> Review queue</Link>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!detail && !error && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      {detail && <DraftReview key={`${detail.draft.id}-${detail.draft.version}-${detail.draft.status}`} detail={detail} onChanged={(m) => { setFlash(m ?? ''); load(); }} flash={flash} />}
    </div>
  );
}
