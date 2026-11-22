'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Results } from '@/lib/acqResults';
import { CURRENCIES, money } from '@/lib/acqResults';
import { Card, EmptyState, Pill, Skeleton } from '@/components/acq/ui';

const CUR_KEY = 'acq-results-currency';

export default function ResultsPage() {
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState('');
  const [cur, setCur] = useState('NGN');
  useEffect(() => { try { const v = localStorage.getItem(CUR_KEY); if (v && CURRENCIES.some((c) => c.code === v)) setCur(v); } catch { /* private window */ } }, []);
  useEffect(() => {
    let live = true;
    fetch('/api/client-acquisition/results').then(async (r) => { const j = await r.json(); if (!live) return; if (!r.ok) setError(j.error ?? 'Could not load your results.'); else setData(j as Results); }).catch(() => live && setError('Could not load your results.'));
    return () => { live = false; };
  }, []);
  const symbol = CURRENCIES.find((c) => c.code === cur)?.symbol ?? '';
  const t = data?.totals;
  const max = Math.max(1, ...(data?.funnel.map((f) => f.count) ?? [1]));

  return (
    <div className="acq-stack">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
        <div>
          <h1 className="acq-page-title">Results &amp; Revenue</h1>
          <p className="acq-sub" style={{ marginTop: 2 }}>From the first email to the paying customer, for every campaign. Revenue counts only contacts you marked as a customer with a deal value.</p>
        </div>
        <label className="acq-sub" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>Currency
          <select className="acq-select" style={{ width: 90, height: 34 }} value={cur} onChange={(e) => { setCur(e.target.value); try { localStorage.setItem(CUR_KEY, e.target.value); } catch { /* ignore */ } }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="acq-warn" role="alert">{error}</div>}
      {!data && !error && <Skeleton />}
      {data && t && t.leads === 0 && <EmptyState title="No results yet" body="Results appear once a campaign has leads and emails have gone out." action={<Link href="/client-acquisition/campaigns" className="acq-btn acq-btn-primary">Go to campaigns</Link>} />}
      {data && t && t.leads > 0 && (
        <>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              ['Revenue', money(t.revenue, symbol), `${t.customers} customer${t.customers === 1 ? '' : 's'}${t.customersWithoutValue ? ` · ${t.customersWithoutValue} with no value recorded` : ''}`],
              ['Open deals', money(t.openValue, symbol), 'meeting booked or proposal sent'],
              ['Average deal', t.avgDeal ? money(t.avgDeal, symbol) : '—', 'customers with a value'],
              ['Emailed to customer', `${t.customerRate}%`, `${t.customers} of ${t.sent} emailed`],
            ].map(([label, value, sub]) => (
              <div key={label} className="acq-card" style={{ padding: '14px 16px' }}>
                <p className="acq-stat-label">{label}</p><p className="acq-stat-value" style={{ fontSize: 26 }}>{value}</p><p className="acq-stat-foot">{sub}</p>
              </div>
            ))}
          </div>

          <Card title="Funnel">
            <div style={{ display: 'grid', gap: 8 }}>
              {data.funnel.map((f) => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 190px', gap: 12, alignItems: 'center', fontSize: 13.5 }}>
                  <span>{f.label}</span>
                  <div style={{ background: '#f3e8ff', borderRadius: 6, height: 18 }}><div style={{ width: `${Math.max(2, (f.count / max) * 100)}%`, background: '#9333ea', height: '100%', borderRadius: 6 }} /></div>
                  <span><b>{f.count}</b>{f.id !== 'sent' && <span className="acq-faint"> · {f.ofPrevious}% of previous</span>}</span>
                </div>
              ))}
            </div>
            <p className="acq-faint" style={{ fontSize: 12, marginTop: 10 }}>Meetings, proposals and customers are the stages you set on a contact in the CRM or Inbox. Open rates are estimates, because some mail apps load images automatically.</p>
          </Card>

          <Card title="By campaign" pad={false}>
            <div style={{ overflowX: 'auto' }}>
              <table className="acq-table" style={{ width: '100%', minWidth: 760 }}>
                <thead><tr><th>Campaign</th><th>Leads</th><th>Emailed</th><th>Replied</th><th>Interested</th><th>Meetings</th><th>Customers</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/client-acquisition/campaigns/${r.id}`} className="acq-link">{r.name}</Link> <Pill label={r.status === 'running' ? 'Running' : r.status === 'completed' ? 'Finished' : r.status === 'paused' ? 'Paused' : 'Not started'} /></td>
                      <td>{r.leads}</td><td>{r.sent}</td><td>{r.replied} <span className="acq-faint">({r.replyRate}%)</span></td><td>{r.interested}</td><td>{r.meetings}</td><td>{r.customers}</td><td><b>{money(r.revenue, symbol)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
