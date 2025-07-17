import * as React from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import StatusBadge from './StatusBadge';

interface DashboardTableProps {
  rows: any[];
  onRowClick: (row: any) => void;
  selectionModel: any[];
  onSelectionModelChange: (ids: any[]) => void;
  page: number;
  pageSize: number;
  rowCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const columns: GridColDef[] = [
  { field: 'title', headerName: 'Title', flex: 1 },
  { field: 'html_version', headerName: 'HTML Version', width: 120 },
  { field: 'internal_links', headerName: 'Internal', width: 100 },
  { field: 'external_links', headerName: 'External', width: 100 },
  { field: 'broken_links', headerName: 'Broken', width: 100 },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (params: GridRenderCellParams) => <StatusBadge status={params.value} />,
  },
];

export default function DashboardTable(props: DashboardTableProps) {
  return (
    <DataGrid
      rows={props.rows}
      columns={columns}
      page={props.page - 1}
      pageSize={props.pageSize}
      rowCount={props.rowCount}
      pagination
      paginationMode="server"
      checkboxSelection
      onRowClick={(params: { row: any; }) => props.onRowClick(params.row)}
      onSelectionModelChange={(ids: any[]) => props.onSelectionModelChange(ids as any[])}
      selectionModel={props.selectionModel}
      onPageChange={(page: number) => props.onPageChange(page + 1)}
      onPageSizeChange={props.onPageSizeChange}
      autoHeight
      disableSelectionOnClick
    />
  );
} 