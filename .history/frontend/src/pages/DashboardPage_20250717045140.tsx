import React, { useState, useEffect } from 'react';
import DashboardTable from '../components/DashboardTable';
import BulkActionBar from '../components/BulkActionBar';

async function fetchUrls({ page = 1, pageSize = 10, sort = '', filter = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, filter });
  const res = await fetch(`/api/urls?${params}`);
  const data = await res.json();
  return data.urls || [];
}
async function bulkDelete(ids: (string | number)[]) {
  await fetch('/api/urls/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
}
async function bulkRestart(ids: (string | number)[]) {
  await fetch('/api/urls/bulk-restart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
}

export default function DashboardPage() {
  const [urls, setUrls] = useState<any[]>([]);
  const [selection, setSelection] = useState<{ type: 'include' | 'exclude'; ids: Set<string | number> }>({ type: 'include', ids: new Set() });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rowCount, setRowCount] = useState(0);
  const [detail, setDetail] = useState<any|null>(null);

  const load = async () => {
    const data = await fetch(`/api/urls?page=${page}&pageSize=${pageSize}`);
    const json = await data.json();
    setUrls(json.urls || []);
    setRowCount(json.total || 1000); // total yoksa tahmini
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [page, pageSize]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <h2>Dashboard</h2>
      <BulkActionBar
        selected={Array.from(selection.ids)}
        onDelete={() => bulkDelete(Array.from(selection.ids)).then(load)}
        onRestart={() => bulkRestart(Array.from(selection.ids)).then(load)}
      />
      <DashboardTable
        rows={urls}
        onRowClick={setDetail}
        selectionModel={selection}
        onSelectionModelChange={(model) => setSelection(model)}
        page={page}
        pageSize={pageSize}
        rowCount={rowCount}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}