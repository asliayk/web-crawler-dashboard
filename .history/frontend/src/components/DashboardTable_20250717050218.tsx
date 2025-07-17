// DashboardTable displays the main URL analysis results in a paginated, filterable, selectable MUI DataGrid.
// Props control pagination, selection, and row click behavior.
import * as React from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import StatusBadge from './StatusBadge';

interface DashboardTableProps {
  rows: any[]; // Data rows to display in the table
  onRowClick: (row: any) => void; // Callback when a row is clicked
  selectionModel: { type: 'include' | 'exclude'; ids: Set<string | number> }; // Selection state for bulk actions
  onSelectionModelChange: (model: { type: 'include' | 'exclude'; ids: Set<string | number> }) => void; // Callback for selection changes
  page: number; // Current page number (1-based)
  pageSize: number; // Number of rows per page
  rowCount: number; // Total number of rows (for server-side pagination)
  onPageChange: (page: number) => void; // Callback for page change
  onPageSizeChange: (size: number) => void; // Callback for page size change
}

const columns: GridColDef[] = [
  { field: 'title', headerName: 'Title', flex: 1 }, // Page title
  { field: 'html_version', headerName: 'HTML Version', width: 120 }, // HTML version detected
  { field: 'internal_links', headerName: 'Internal', width: 100 }, // Count of internal links
  { field: 'external_links', headerName: 'External', width: 100 }, // Count of external links
  { field: 'broken_links', headerName: 'Broken', width: 100 }, // Count of broken links
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (params: GridRenderCellParams) => <StatusBadge status={params.value} />, // Render status as a badge
  },
];

export default function DashboardTable(props: DashboardTableProps) {
  // Render the DataGrid with server-side pagination, selection, and custom row click handling
  return (
    <DataGrid
      rows={props.rows}
      columns={columns}
      paginationModel={{ page: props.page - 1, pageSize: props.pageSize }}
      rowCount={props.rowCount}
      pagination
      paginationMode="server"
      checkboxSelection
      onRowClick={(params: { row: any; }) => props.onRowClick(params.row)}
      onRowSelectionModelChange={(model) => props.onSelectionModelChange(model)}
      rowSelectionModel={props.selectionModel}
      onPaginationModelChange={(model) => {
        props.onPageChange(model.page + 1);
        props.onPageSizeChange(model.pageSize);
      }}
      autoHeight
      disableRowSelectionOnClick
    />
  );
} 