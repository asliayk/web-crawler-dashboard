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
// Burada baseURL'i set ediyoruz, böylece tüm `/urls` çağrıları
// http://localhost:8080/api/urls'a yönlenecek
// -----------------------------------------------------------------------------
axios.defaults.baseURL = 'http://localhost:8080/api'

// -----------------------------------------------------------------------------
// Types (shape we consume from backend)
// -----------------------------------------------------------------------------
interface UrlRow {
  id: number
  url: string
  status: string
  html_version: string
  title: string
  h1_count: number
  h2_count: number
  h3_count: number
  h4_count: number
  h5_count: number
  h6_count: number
  internal_links: number
  external_links: number
  broken_links: number
  has_login_form: boolean
}

type Order = 'asc' | 'desc'
type SortableKey =
  | 'title'
  | 'html_version'
  | 'h1_count'
  | 'h2_count'
  | 'h3_count'
  | 'h4_count'
  | 'h5_count'
  | 'h6_count'
  | 'internal_links'
  | 'external_links'
  | 'broken_links'
  | 'has_login_form'
  | 'status'

// -----------------------------------------------------------------------------
// Header label map for all sortable columns
// -----------------------------------------------------------------------------
const headerLabels: Record<SortableKey, string> = {
  title: 'Title',
  html_version: 'HTML Ver.',
  h1_count: 'H1',
  h2_count: 'H2',
  h3_count: 'H3',
  h4_count: 'H4',
  h5_count: 'H5',
  h6_count: 'H6',
  internal_links: '#Internal',
  external_links: '#External',
  broken_links: '#Broken',
  has_login_form: 'Login?',
  status: 'Status',
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------
function compare(a: any, b: any): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function hasActiveJobs(rows: UrlRow[]): boolean {
  return rows.some((r) => r.status === 'running' || r.status === 'queued')
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function DashboardPage() {
  const [rows, setRows] = useState<UrlRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // global search & column filters
  const [search, setSearch] = useState('')
  const [titleFilter, setTitleFilter] = useState('')
  const [htmlFilter, setHtmlFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all')
  const [loginFilter, setLoginFilter] = useState<'all' | 'yes' | 'no'>('all')

  // sorting
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<SortableKey>('title')

  // pagination
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // ---------------------------------------------------------------------------
  // Fetch data (eski kodunuz gibi `/urls`)
  // ---------------------------------------------------------------------------
  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get<{ urls: any[] }>('/urls')
      const data = (res.data?.urls ?? []).map((u) => ({
        id: u.id,
        url: u.url,
        status: u.status,
        html_version: u.html_version ?? '',
        title: u.title ?? '',
        h1_count: u.h1_count ?? 0,
        h2_count: u.h2_count ?? 0,
        h3_count: u.h3_count ?? 0,
        h4_count: u.h4_count ?? 0,
        h5_count: u.h5_count ?? 0,
        h6_count: u.h6_count ?? 0,
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

  // initial load
  useEffect(() => {
    loadData()
  }, [])

  // auto‑refresh while there are active jobs
  useEffect(() => {
    if (!hasActiveJobs(rows)) return
    const t = setInterval(loadData, 5000)
    return () => clearInterval(t)
  }, [rows])

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (needle && !(
          r.title.toLowerCase().includes(needle) ||
          r.url.toLowerCase().includes(needle)
        )) return false
      if (titleFilter && !r.title.toLowerCase().includes(titleFilter.trim().toLowerCase())) return false
      if (htmlFilter && !r.html_version.toLowerCase().includes(htmlFilter.trim().toLowerCase())) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
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

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------
  const paginated = useMemo(() => {
    const start = page * rowsPerPage
    return sorted.slice(start, start + rowsPerPage)
  }, [sorted, page, rowsPerPage])

  // ---------------------------------------------------------------------------
  // Handlers for sort & pagination
  // ---------------------------------------------------------------------------
  const handleRequestSort = (key: SortableKey) => {
    const isAsc = orderBy === key && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(key)
  }
  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage)
  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10) || 10
    setRowsPerPage(v)
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
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {(
                    [
                      'title','html_version',
                      'h1_count','h2_count','h3_count','h4_count','h5_count','h6_count',
                      'internal_links','external_links','broken_links',
                      'has_login_form','status'
                    ] as SortableKey[]
                  ).map((key) => (
                    <TableCell
                      key={key}
                      align={key.includes('links') || key.includes('count') ? 'right' : 'left'}
                      sortDirection={orderBy === key ? order : false}
                    >
                      <TableSortLabel
                        active={orderBy === key}
                        direction={orderBy === key ? order : 'asc'}
                        onClick={() => handleRequestSort(key)}
                      >
                        {headerLabels[key]}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {paginated.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.title || '(no title)'}</TableCell>
                    <TableCell>{r.html_version || '—'}</TableCell>
                    {[r.h1_count, r.h2_count, r.h3_count, r.h4_count, r.h5_count, r.h6_count].map((n, i) => (
                      <TableCell key={i} align="right">{n}</TableCell>
                    ))}
                    <TableCell align="right">{r.internal_links}</TableCell>
                    <TableCell align="right">{r.external_links}</TableCell>
                    <TableCell align="right">{r.broken_links}</TableCell>
                    <TableCell>{r.has_login_form ? 'Yes' : 'No'}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{r.status}</TableCell>
                    <TableCell>
                      <RouterLink to={`/urls/${r.id}`} style={{ textDecoration: 'none' }}>
                        View
                      </RouterLink>
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={15} align="center" sx={{ py: 4 }}>
                      No records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <TablePagination
          component="div"
          count={sorted.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      </Paper>
    </Container>
  )
}
