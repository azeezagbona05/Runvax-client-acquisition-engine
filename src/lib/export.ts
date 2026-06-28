import { SavedProspect } from '@/types';

export function exportProspectsCSV(prospects: SavedProspect[]) {
  const headers = [
    'Name', 'Category', 'Address', 'Phone', 'Website', 'Has Website',
    'Stage', 'Score', 'Price Min (₦)', 'Price Max (₦)', 'Rating',
    'Reviews', 'Notes', 'Reminder Date', 'Saved Date',
  ];

  const rows = prospects.map((p) => [
    p.business.name,
    p.business.category,
    p.business.address,
    p.business.phone || '',
    p.business.website || '',
    p.business.hasWebsite ? 'Yes' : 'No',
    p.stage,
    p.score,
    p.estimatedPrice?.min ?? '',
    p.estimatedPrice?.max ?? '',
    p.business.rating ?? '',
    p.business.reviewCount ?? '',
    p.notes,
    p.reminderDate || '',
    new Date(p.savedAt).toLocaleDateString('en-NG'),
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prospects-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
