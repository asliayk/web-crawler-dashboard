import React, { useState, useEffect } from 'react';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import DashboardTable from '../components/DashboardTable';
import BulkActionBar from '../components/BulkActionBar';
// import UrlDetailModal from '../components/UrlDetailModal';

async function fetchUrls({ page = 1, pageSize = 10, sort = '', filter = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, filter });
  const res = await fetch(`/api/urls?${params}`);
  const data = await res.json();
  return data.urls || [];
}
async function bulkDelete(ids: GridRowSelectionModel) {
  await fetch('/api/urls/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: Array.from(ids) })
  });
}
async function bulkRestart(ids: GridRowSelectionModel) {
  await fetch('/api/urls/bulk-restart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: Array.from(ids) })
  });
}

export default function DashboardPage() {
  const [urls, setUrls] = useState<any[]>([]);
  const [selection, setSelection] = useState<GridRowSelectionModel>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rowCount, setRowCount] = useState(0);
  // const [detail, setDetail] = useState<any|null>(null);

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
        selected={Array.from(selection)}
        onDelete={() => bulkDelete(selection).then(load)}
        onRestart={() => bulkRestart(selection).then(load)}
      />
      <DashboardTable
        rows={urls}
        onRowClick={(row) => {/* detay modal aç */}}
        selectionModel={selection}
        onSelectionModelChange={setSelection}
        page={page}
        pageSize={pageSize}
        rowCount={rowCount}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
      {/* detail && <UrlDetailModal url={detail} onClose={() => setDetail(null)} /> */}
    </div>
  );
}