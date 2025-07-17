import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Container,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  TableContainer,
  TablePagination,
  Typography,
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

// -----------------------------------------------------------------------------
// Types
// Backend /api/urls returns many fields; we pick what we need.
// -----------------------------------------------------------------------------
interface UrlRow {
  id: number
  url: string
  status: string
  html_version: string
  title: string
  internal_links: number
  external_links: number
  broken_links: number
  has_login_form: boolean
}

type Order = 'asc' | 'desc'
type SortableKey =
  | 'title'
  | 'html_version'
  | 'internal_links'
  | 'external_links'
  | 'broken_links'
  | 'has_login_form'
  | 'status'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function compare(a: any, b: any): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function DashboardPage() {
  const [rows, setRows] = useState<UrlRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // global search
  const [search, setSearch] = useState('')

  // column filters
  const [titleFilter, setTitleFilter] = useState('')
  const [htmlFilter, setHtmlFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [loginFilter, setLoginFilter] = useState<'all' | 'yes' | 'no'>('all')

  // sort
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<SortableKey>('title')

  // pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------
  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      // expects axios.defaults.baseURL = 'http://localhost:8080/api'
      const res = await axios.get<{ urls: any[] }>('/urls')
      const data = (res.data?.urls ?? []).map((u) => ({
        id: u.id,
        url: u.url,
        status: u.status,
        html_version: u.html_version ?? '',
        title: u.title ?? '',
        internal_links: u.internal_links ?? 0,
        external_links: u.external_links ?? 0,
        broken_links: u.broken_links ?? 0,
        has_login_form: Boolean(u.has_login_form),
      })) as UrlRow[]
      setRows(data)
    } catch (err: any) {
      console.error('Dashboard load error:', err)
      setError('Failed to load results.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const tf = titleFilter.trim().toLowerCase()
    const hf = htmlFilter.trim().toLowerCase()
    return rows.filter((r) => {
      // global search: match title OR url
      if (needle) {
        const match =
          r.title.toLowerCase().includes(needle) ||
          r.url.toLowerCase().includes(needle)
        if (!match) return false
      }
      // title column filter
      if (tf && !r.title.toLowerCase().includes(tf)) return false
      // html column filter
      if (hf && !r.html_version.toLowerCase().includes(hf)) return false
      // status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      // login filter
      if (loginFilter === 'yes' && !r.has_login_form) return false
      if (loginFilter === 'no' && r.has_login_form) return false
      return true
    })
  }, [rows, search, titleFilter, htmlFilter, statusFilter, loginFilter])

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------
  const sorted = useMemo(() => {
    const data = [...filtered]
    data.sort((a, b) => {
      const cmp = compare(a[orderBy], b[orderBy])
      return order === 'asc' ? cmp : -cmp
    })
    return data
  }, [filtered, order, orderBy])

  function handleRequestSort(property: SortableKey) {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------
  const paginated = useMemo(() => {
    const start = page * rowsPerPage
    return sorted.slice(start, start + rowsPerPage)
  }, [sorted, page, rowsPerPage])

  function handleChangePage(_: unknown, newPage: number) {
    setPage(newPage)
  }
  function handleChangeRowsPerPage(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setRowsPerPage(parseInt(e.target.value, 10))
    setPage(0)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Results Dashboard
      </Typography>

      {/* Filters */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' },
          gap: 2,
          mb: 2,
        }}
      >
        <TextField
          label="Global Search (title/url)"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <TextField
          label="Title filter"
          size="small"
          value={titleFilter}
          onChange={(e) => setTitleFilter(e.target.value)}
        />
        <TextField
          label="HTML Version filter"
          size="small"
          value={htmlFilter}
          onChange={(e) => setHtmlFilter(e.target.value)}
        />
        <FormControl size="small">
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="queued">Queued</MenuItem>
            <MenuItem value="running">Running</MenuItem>
            <MenuItem value="done">Done</MenuItem>
            <MenuItem value="error">Error</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Login Form</InputLabel>
          <Select
            label="Login Form"
            value={loginFilter}
            onChange={(e) => setLoginFilter(e.target.value as any)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Data Table */}
      <Paper>
        {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sortDirection={orderBy === 'title' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'title'}
                        direction={orderBy === 'title' ? order : 'asc'}
                        onClick={() => handleRequestSort('title')}
                      >
                        Title
                      </TableSortLabel>
                    </TableCell>

                    <TableCell sortDirection={orderBy === 'html_version' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'html_version'}
                        direction={orderBy === 'html_version' ? order : 'asc'}
                        onClick={() => handleRequestSort('html_version')}
                      >
                        HTML Version
                      </TableSortLabel>
                    </TableCell>

                    <TableCell align="right" sortDirection={orderBy === 'internal_links' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'internal_links'}
                        direction={orderBy === 'internal_links' ? order : 'asc'}
                        onClick={() => handleRequestSort('internal_links')}
                      >
                        #Internal
                      </TableSortLabel>
                    </TableCell>

                    <TableCell align="right" sortDirection={orderBy === 'external_links' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'external_links'}
                        direction={orderBy === 'external_links' ? order : 'asc'}
                        onClick={() => handleRequestSort('external_links')}
                      >
                        #External
                      </TableSortLabel>
                    </TableCell>

                    <TableCell align="right" sortDirection={orderBy === 'broken_links' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'broken_links'}
                        direction={orderBy === 'broken_links' ? order : 'asc'}
                        onClick={() => handleRequestSort('broken_links')}
                      >
                        #Broken
                      </TableSortLabel>
                    </TableCell>

                    <TableCell sortDirection={orderBy === 'has_login_form' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'has_login_form'}
                        direction={orderBy === 'has_login_form' ? order : 'asc'}
                        onClick={() => handleRequestSort('has_login_form')}
                      >
                        Login
                      </TableSortLabel>
                    </TableCell>

                    <TableCell sortDirection={orderBy === 'status' ? order : false}>
                      <TableSortLabel
                        active={orderBy === 'status'}
                        direction={orderBy === 'status' ? order : 'asc'}
                        onClick={() => handleRequestSort('status')}
                      >
                        Status
                      </TableSortLabel>
                    </TableCell>

                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {paginated.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.title || '(no title)'}</TableCell>
                      <TableCell>{r.html_version || '—'}</TableCell>
                      <TableCell align="right">{r.internal_links}</TableCell>
                      <TableCell align="right">{r.external_links}</TableCell>
                      <TableCell align="right">{r.broken_links}</TableCell>
                      <TableCell>{r.has_login_form ? 'Yes' : 'No'}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{r.status}</TableCell>
                      <TableCell>
                        <RouterLink
                          to={`/urls/${r.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          View
                        </RouterLink>
                      </TableCell>
                    </TableRow>
                  ))}

                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        No records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={sorted.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </Paper>
    </Container>
  )
}
