import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  Checkbox,
  Toolbar,
  Button,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
  Stack,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import AddLinkIcon from '@mui/icons-material/AddLink'
import { Link as RouterLink, useNavigate } from 'react-router-dom'

// -----------------------------------------------------------------------------
// Types (shape we consume from backend)
// -----------------------------------------------------------------------------
export interface UrlRow {
  id: number
  url: string
  status: 'queued' | 'running' | 'done' | 'error'
  html_version: string
  title: string
  internal_links: number
  external_links: number
  broken_links: number
  has_login_form: boolean
  // optional extra counts for drill‑down (not shown in list, but good to have cached)
  h1?: number
  h2?: number
  h3?: number
  h4?: number
  h5?: number
  h6?: number
}

export type Order = 'asc' | 'desc'
export type SortableKey =
  | 'title'
  | 'html_version'
  | 'internal_links'
  | 'external_links'
  | 'broken_links'
  | 'has_login_form'
  | 'status'

// -----------------------------------------------------------------------------
// Config: centralize API paths (adjust if your backend differs)
// -----------------------------------------------------------------------------
const API = {
  list: '/urls',
  create: '/urls', // POST {url}
  bulkDelete: '/urls/bulk-delete', // POST {ids:number[]}
  bulkRerun: '/urls/bulk-rerun', // POST {ids:number[]}
  start: (id: number) => `/urls/${id}/start`,
  stop: (id: number) => `/urls/${id}/stop`,
  rerun: (id: number) => `/urls/${id}/rerun`,
  detail: (id: number) => `/urls/${id}`,
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

// Narrow helper to coerce backend objects into UrlRow safely.
function normalize(u: any): UrlRow {
  return {
    id: u.id,
    url: u.url,
    status: u.status,
    html_version: u.html_version ?? '',
    title: u.title ?? '',
    internal_links: u.internal_links ?? 0,
    external_links: u.external_links ?? 0,
    broken_links: u.broken_links ?? 0,
    has_login_form: Boolean(u.has_login_form),
    h1: u.h1 ?? u.heading_counts?.h1 ?? 0,
    h2: u.h2 ?? u.heading_counts?.h2 ?? 0,
    h3: u.h3 ?? u.heading_counts?.h3 ?? 0,
    h4: u.h4 ?? u.heading_counts?.h4 ?? 0,
    h5: u.h5 ?? u.heading_counts?.h5 ?? 0,
    h6: u.h6 ?? u.heading_counts?.h6 ?? 0,
  }
}

// -----------------------------------------------------------------------------
// Dashboard Page
// -----------------------------------------------------------------------------
export default function DashboardPage() {
  const navigate = useNavigate()

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

  // selection for bulk actions
  const [selected, setSelected] = useState<number[]>([])

  // snackbars
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' | 'info'; } | null>(null)

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // axios.defaults.baseURL must be set (e.g., in main.tsx) to http://localhost:8080/api
      const res = await axios.get<{ urls: any[] }>(API.list)
      const data = (res.data?.urls ?? []).map(normalize)
      setRows(data)
    } catch (err: any) {
      console.error('Dashboard load error:', err)
      setError('Failed to load results.')
    } finally {
      setLoading(false)
    }
  }, [])

  // initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // auto‑refresh while there are active (running/queued) jobs
  useEffect(() => {
    if (!hasActiveJobs(rows)) return
    const t = setInterval(loadData, 5000) // poll every 5s
    return () => clearInterval(t)
  }, [rows, loadData])

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const tf = titleFilter.trim().toLowerCase()
    const hf = htmlFilter.trim().toLowerCase()

    return rows.filter((r) => {
      // global search: title OR url (simple substring; swap for fuzzy if desired)
      if (needle) {
        const match = r.title.toLowerCase().includes(needle) || r.url.toLowerCase().includes(needle)
        if (!match) return false
      }
      // title filter
      if (tf && !r.title.toLowerCase().includes(tf)) return false
      // HTML version filter
      if (hf && !r.html_version.toLowerCase().includes(hf)) return false
      // status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      // login form filter
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

  const handleRequestSort = (property: SortableKey) => {
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

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = parseInt(e.target.value, 10)
    setRowsPerPage(isNaN(val) ? 10 : val)
    setPage(0)
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------
  const allIdsOnPage = paginated.map((r) => r.id)
  const isAllSelected = allIdsOnPage.length > 0 && allIdsOnPage.every((id) => selected.includes(id))

  const toggleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      // add any missing page ids
      const newSel = [...new Set([...selected, ...allIdsOnPage])]
      setSelected(newSel)
    } else {
      // remove page ids
      setSelected((sel) => sel.filter((id) => !allIdsOnPage.includes(id)))
    }
  }

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelected((sel) => (checked ? [...sel, id] : sel.filter((x) => x !== id)))
  }

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------
  const doBulkDelete = async () => {
    if (selected.length === 0) return
    try {
      await axios.post(API.bulkDelete, { ids: selected })
      setSnack({ msg: 'Deleted selected URLs.', sev: 'success' })
      setSelected([])
      loadData()
    } catch (err) {
      console.error(err)
      setSnack({ msg: 'Delete failed.', sev: 'error' })
    }
  }

  const doBulkRerun = async () => {
    if (selected.length === 0) return
    try {
      await axios.post(API.bulkRerun, { ids: selected })
      setSnack({ msg: 'Re-running analysis.', sev: 'info' })
      loadData()
    } catch (err) {
      console.error(err)
      setSnack({ msg: 'Re-run failed.', sev: 'error' })
    }
  }

  // Individual start/stop (if you expose these endpoints)
  const handleStart = async (id: number) => {
    try {
      await axios.post(API.start(id))
      setSnack({ msg: 'Started crawl.', sev: 'info' })
      loadData()
    } catch (err) {
      console.error(err)
      setSnack({ msg: 'Start failed.', sev: 'error' })
    }
  }
  const handleStop = async (id: number) => {
    try {
      await axios.post(API.stop(id))
      setSnack({ msg: 'Stopped crawl.', sev: 'info' })
      loadData()
    } catch (err) {
      console.error(err)
      setSnack({ msg: 'Stop failed.', sev: 'error' })
    }
  }

  // Add URL dialog (lightweight inline implementation)
  const [newUrl, setNewUrl] = useState('')
  const addUrl = async () => {
    if (!newUrl.trim()) return
    try {
      await axios.post(API.create, { url: newUrl.trim() })
      setNewUrl('')
      setSnack({ msg: 'URL added. Crawl queued.', sev: 'success' })
      loadData()
    } catch (err) {
      console.error(err)
      setSnack({ msg: 'Failed to add URL.', sev: 'error' })
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Results Dashboard
      </Typography>

      {/* Add URL inline */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Add URL to crawl"
          size="small"
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addUrl()
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddLinkIcon />}
          onClick={addUrl}
          disabled={!newUrl.trim()}
        >
          Add
        </Button>
      </Stack>

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
        {/* Bulk toolbar */}
        <Toolbar
          sx={{
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="subtitle1">
            {selected.length} selected
          </Typography>
          <Box>
            <Tooltip title="Re-run analysis">
              <span>
                <IconButton onClick={doBulkRerun} disabled={selected.length === 0}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete URLs">
              <span>
                <IconButton onClick={doBulkDelete} disabled={selected.length === 0}>
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Toolbar>

        {/* Table / Loading / Error */}
        {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      color="primary"
                      indeterminate={!isAllSelected && selected.some((id) => allIdsOnPage.includes(id))}
                      checked={isAllSelected}
                      onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                      inputProps={{ 'aria-label': 'select all rows on page' }}
                    />
                  </TableCell>

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

                  <TableCell
                    align="right"
                    sortDirection={orderBy === 'internal_links' ? order : false}
                  >
                    <TableSortLabel
                      active={orderBy === 'internal_links'}
                      direction={orderBy === 'internal_links' ? order : 'asc'}
                      onClick={() => handleRequestSort('internal_links')}
                    >
                      #Internal
                    </TableSortLabel>
                  </TableCell>

                  <TableCell
                    align="right"
                    sortDirection={orderBy === 'external_links' ? order : false}
                  >
                    <TableSortLabel
                      active={orderBy === 'external_links'}
                      direction={orderBy === 'external_links' ? order : 'asc'}
                      onClick={() => handleRequestSort('external_links')}
                    >
                      #External
                    </TableSortLabel>
                  </TableCell>

                  <TableCell
                    align="right"
                    sortDirection={orderBy === 'broken_links' ? order : false}
                  >
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

                  <TableCell>Actions</TableCell>

                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {paginated.map((r) => {
                  const checked = selected.includes(r.id)
                  return (
                    <TableRow key={r.id} hover role="checkbox" selected={checked}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={checked}
                          onChange={(e) => toggleSelectOne(r.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{r.title || '(no title)'}</TableCell>
                      <TableCell>{r.html_version || '—'}</TableCell>
                      <TableCell align="right">{r.internal_links}</TableCell>
                      <TableCell align="right">{r.external_links}</TableCell>
                      <TableCell align="right">{r.broken_links}</TableCell>
                      <TableCell>{r.has_login_form ? 'Yes' : 'No'}</TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{r.status}</TableCell>
                      <TableCell>
                        {r.status === 'running' ? (
                          <IconButton size="small" onClick={() => handleStop(r.id)} title="Stop crawl">
                            <StopIcon fontSize="inherit" />
                          </IconButton>
                        ) : (
                          <IconButton size="small" onClick={() => handleStart(r.id)} title="Start crawl">
                            <PlayArrowIcon fontSize="inherit" />
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        {/* FIX: use template string, NOT regex literal */}
                        <RouterLink
                          to={`/urls/${r.id}`}
                          style={{ textDecoration: 'none' }}
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(`/urls/${r.id}`)
                          }}
                        >
                          View
                        </RouterLink>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      No records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination always visible */}
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