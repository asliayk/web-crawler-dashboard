import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import {
  Container,
  Box,
  TextField,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableSortLabel,
  TablePagination,
  Typography,
  CircularProgress,
} from '@mui/material'

interface UrlSummary {
  id: number
  title: string
  html_version: string
  internal_links: number
  external_links: number
  broken_links: number
  has_login_form: boolean
}

type Order = 'asc' | 'desc'

const columns: {
  id: keyof UrlSummary
  label: string
  numeric: boolean
}[] = [
  { id: 'title', label: 'Title', numeric: false },
  { id: 'html_version', label: 'HTML Version', numeric: false },
  { id: 'internal_links', label: '#Internal', numeric: true },
  { id: 'external_links', label: '#External', numeric: true },
  { id: 'broken_links', label: '#Broken', numeric: true },
  { id: 'has_login_form', label: 'Login Form', numeric: false },
]

export default function DashboardPage() {
  const [data, setData] = useState<UrlSummary[]>([])
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState<Order>('asc')
  const [orderBy, setOrderBy] = useState<keyof UrlSummary>('title')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
     const res = await axios.get<{ urls: UrlSummary[] }>('/urls')
     console.log('⟵ API /urls response:', res.status, res.data)
     // guard against null or undefined
     setData(res.data.urls ?? [])
    } catch (err: any) {
     console.error('Error fetching /urls:', err.response?.status, err.response?.data || err.message)
     // optionally show an alert so you see it immediately
     alert('Failed to load data: ' + (err.response?.data?.error || err.message))
    } finally {
     setLoading(false)
    }
  }

  const handleRequestSort = (property: keyof UrlSummary) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(e.target.value, 10))
    setPage(0)
  }

  // 1) Filtrele
  const filtered = useMemo(
    () =>
      data.filter((row) =>
        row.title.toLowerCase().includes(search.toLowerCase())
      ),
    [data, search]
  )

  // 2) Sırala
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[orderBy]
      const bVal = b[orderBy]
      let cmp = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal))
      }
      return order === 'asc' ? cmp : -cmp
    })
  }, [filtered, order, orderBy])

  // 3) Sayfala
  const paginated = useMemo(
    () =>
      sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sorted, page, rowsPerPage]
  )

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        URL Dashboard
      </Typography>

      <Box mb={2}>
        <TextField
          fullWidth
          placeholder="Global Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>

      <Paper>
        {loading ? (
          <Box
            sx={{
              p: 4,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        align={col.numeric ? 'right' : 'left'}
                        sortDirection={orderBy === col.id ? order : false}
                      >
                        <TableSortLabel
                          active={orderBy === col.id}
                          direction={orderBy === col.id ? order : 'asc'}
                          onClick={() => handleRequestSort(col.id)}
                        >
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginated.map((row) => (
                    <TableRow hover key={row.id}>
                      <TableCell>{row.title}</TableCell>
                      <TableCell>{row.html_version}</TableCell>
                      <TableCell align="right">
                        {row.internal_links}
                      </TableCell>
                      <TableCell align="right">
                        {row.external_links}
                      </TableCell>
                      <TableCell align="right">{row.broken_links}</TableCell>
                      <TableCell>
                        {row.has_login_form ? 'Yes' : 'No'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        align="center"
                        sx={{ py: 4 }}
                      >
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
              rowsPerPageOptions={[5, 10, 25]}
            />
          </>
        )}
      </Paper>
    </Container>
  )
}
