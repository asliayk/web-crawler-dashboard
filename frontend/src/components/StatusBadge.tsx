import React from 'react';

const statusColors: Record<string, string> = {
  queued: '#888',
  running: '#1976d2',
  done: '#43a047',
  error: '#d32f2f',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      background: statusColors[status] || '#888',
      color: 'white',
      borderRadius: 8,
      padding: '2px 8px',
      fontSize: 12,
      textTransform: 'capitalize',
    }}>{status}</span>
  );
} 