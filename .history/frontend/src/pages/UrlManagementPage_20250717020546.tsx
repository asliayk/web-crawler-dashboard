import React, { useEffect, useState, useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import axios from 'axios'
import {
  Container,
  Box,
  TextField,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Checkbox,
  TableSortLabel,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'

// -----------------------------------------------------------------------------
// Types
// Backend GET /api/urls returns these fields (plus others we ignore).
// -----------------------------------------------------------------------------
export interface UrlItem {
  id: number
  url: string
  status: string            // queued | running | done | error
  created_at: string        // ISO string
}

// Sorting
type Order = 'asc' | 'desc'
type OrderBy = keyof UrlItem | 'none'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

// generic compare helper
function compare<T>(a: T, b: T): number {
  if (a === b) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function UrlManagementPage() {
  const [list, setList] = useState<UrlItem[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [loading, setLoading] = useState(false)

  // selection state for bulk actions
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // global search
  const [search, setSearch] = useState('')

  // sort
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<OrderBy>('id')

  // ---------------------------------------------------------------------------
  // Fetch URLs (called on mount + after mutations)
  // ---------------------------------------------------------------------------
  async function fetchUrls() {
    setLoading(true)
    try {
      // NOTE: baseURL must already be configured to http://localhost:8080/api
      const res = await axios.get<{ urls: UrlItem[] }>('/urls')
      setList(res.data?.urls ?? [])
    } catch (err) {
      console.error('fetchUrls error:', err)
      alert('Failed to load URL list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUrls()
  }, [])

  // ---------------------------------------------------------------------------
  // Add new URL
  // ---------------------------------------------------------------------------
  async function addUrl() {
    const trimmed = newUrl.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      await axios.post('/urls', { url: trimmed }) // backend auto-starts crawl
      setNewUrl('')
      await fetchUrls()
    } catch (err) {
      console.error('addUrl error:', err)
      alert('Failed to add URL.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Delete one URL
  // ---------------------------------------------------------------------------
  async function deleteUrl(id: number) {
    if (!window.confirm('Delete this record?')) return
    setLoading(true)
    try {
      await axios.delete(`/urls/${id}`)
      await fetchUrls()
      setSelected((prev) => {
        const copy = new Set(prev)
        copy.delete(id)
        return copy
      })
    } catch (err) {
      console.error('deleteUrl error:', err)
      alert('Delete failed.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Start / Re-Run one URL
  // ---------------------------------------------------------------------------
  async function startUrl(id: number) {
    setLoading(true)
    try {
      await axios.put(`/urls/${id}/start`)
      await fetchUrls()
    } catch (err) {
      console.error('startUrl error:', err)
      alert('Failed to start crawl.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Stop (reset to queued) one URL
  // NOTE: Real cancellation requires backend context cancellation support.
  // ---------------------------------------------------------------------------
  async function stopUrl(id: number) {
    setLoading(true)
    try {
      await axios.put(`/urls/${id}/stop`)
      await fetchUrls()
    } catch (err) {
      console.error('stopUrl error:', err)
      alert('Failed to stop crawl.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk Actions
  // ---------------------------------------------------------------------------
  async function bulkDelete() {
    if (selected.size === 0) return
    if (!window.confirm(`Delete ${selected.size} URLs?`)) return
    setLoading(true)
    try {
      await Promise.all([...selected].map((id) => axios.delete(`/urls/${id}`)))
      setSelected(new Set())
      await fetchUrls()
    } catch (err) {
      console.error('bulkDelete error:', err)
      alert('Bulk delete failed.')
    } finally {
      setLoading(false)
    }
  }

  async function bulkStart() {
    if (selected.size === 0) return
    setLoading(true)
    try {
      await Promise.all([...selected].map((id) => axios.put(`/urls/${id}/start`)))
      await fetchUrls()
    } catch (err) {
      console.error('bulkStart error:', err)
      alert('Bulk re-run failed.')
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Selection logic
  // ---------------------------------------------------------------------------
  const allSelected = selected.size > 0 && selected.size === list.length
  const someSelected = selected.size > 0 && selected.size < list.length

  function toggleSelectOne(id: number) {
    setSelected((prev) => {
      const copy = new Set(prev)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === list.length) return new Set() // unselect all
      return new Set(list.map((i) => i.id))
    })
  }

  // ---------------------------------------------------------------------------
  // Filtering (global search across URL)
  // TODO: extend to per-column filters (status, date range, etc.)
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return list
    return list.filter((row) =>
      row.url.toLowerCase().includes(needle) ||
      String(row.id).includes(needle)
    )
  }, [list, search])

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------
  const sorted = useMemo(() => {
    if (orderBy === 'none') return filtered
    const arr = [...filtered]
    arr.sort((a, b) => {
      const cmp = compare(a[orderBy as keyof UrlItem], b[orderBy as keyof UrlItem])
      return order === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, order, orderBy])

  function handleSort(by: OrderBy) {
    if (orderBy === by) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(by)
      setOrder('asc')
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Crawler Dashboard
      </Typography>

      {/* Add URL + Bulk Actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
        <Paper sx={{ p: 2, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            fullWidth
            label="https://..."
            variant="outlined"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addUrl()}
            disabled={loading}
          />
          <Button
            variant="contained"
            size="large"
            onClick={addUrl}
            disabled={!newUrl.trim() || loading}
          >
            Add URL
          </Button>
        </Paper>

        {/* Global Search */}
        <TextField
          fullWidth
          placeholder="Search by URL or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
        />

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={bulkStart}
              disabled={loading}
            >
              Re-run ({selected.size})
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={bulkDelete}
              disabled={loading}
            >
              Delete ({selected.size})
            </Button>
          </Box>
        )}
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                {/* Select All checkbox */}
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </TableCell>

                {/* Sortable columns */}
                <TableCell sortDirection={orderBy === 'id' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'id'}
                    direction={orderBy === 'id' ? order : 'asc'}
                    onClick={() => handleSort('id')}
                  >
                    ID
                  </TableSortLabel>
                </TableCell>

                <TableCell sortDirection={orderBy === 'url' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'url'}
                    direction={orderBy === 'url' ? order : 'asc'}
                    onClick={() => handleSort('url')}
                  >
                    URL
                  </TableSortLabel>
                </TableCell>

                <TableCell sortDirection={orderBy === 'status' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleSort('status')}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>

                <TableCell sortDirection={orderBy === 'created_at' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'created_at'}
                    direction={orderBy === 'created_at' ? order : 'asc'}
                    onClick={() => handleSort('created_at')}
                  >
                    Created At
                  </TableSortLabel>
                </TableCell>

                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {sorted.map((item) => {
                const isSel = selected.has(item.id)
                const running = item.status === 'running'
                return (
                  <TableRow
                    key={item.id}
                    hover
                    selected={isSel}
                  >
                    {/* Row checkbox */}
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSel}
                        onChange={() => toggleSelectOne(item.id)}
                      />
                    </TableCell>

                    <TableCell>{item.id}</TableCell>

                    <TableCell sx={{ wordBreak: 'break-all' }}>
                      <RouterLink
                        to={`/urls/${item.id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Typography color="primary">{item.url}</Typography>
                      </RouterLink>
                    </TableCell>

                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {item.status}
                    </TableCell>

                    <TableCell>{formatDate(item.created_at)}</TableCell>

                    <TableCell>
                      {/* Start / Stop */}
                      {running ? (
                        <Tooltip title="Stop">
                          <IconButton
                            size="small"
                            onClick={() => stopUrl(item.id)}
                            disabled={loading}
                          >
                            <StopIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Start / Re-run">
                          <IconButton
                            size="small"
                            onClick={() => startUrl(item.id)}
                            disabled={loading}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}

                      {/* Delete */}
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => deleteUrl(item.id)}
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}

              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No URLs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Container>
  )
}
