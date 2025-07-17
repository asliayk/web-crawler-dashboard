import React from 'react';

interface BulkActionBarProps {
  selected: any[];
  onDelete: () => void;
  onRestart: () => void;
}

export default function BulkActionBar({ selected, onDelete, onRestart }: BulkActionBarProps) {
  if (!selected.length) return null;
  return (
    <div style={{ margin: '16px 0', display: 'flex', gap: 8 }}>
      <span>{selected.length} selected</span>
      <button onClick={onRestart} style={{ background: '#1976d2', color: 'white', border: 0, borderRadius: 4, padding: '4px 12px' }}>Re-run</button>
      <button onClick={onDelete} style={{ background: '#d32f2f', color: 'white', border: 0, borderRadius: 4, padding: '4px 12px' }}>Delete</button>
    </div>
  );
} 