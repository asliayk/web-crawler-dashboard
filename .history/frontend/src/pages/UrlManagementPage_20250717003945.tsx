import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link as RouterLink } from 'react-router-dom'
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
} from '@mui/material'

interface UrlItem {
  id: number
  url: string
  status: string
}

export default function UrlManagementPage() {
  const [list, setList] = useState<UrlItem[]>([])
  const [newUrl, setNewUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUrls()
  }, [])

  async function fetchUrls() {
    setLoading(true)
    try {
      const res = await axios.get('/api/urls')
      setList(res.data.urls)
    } finally {
      setLoading(false)
    }
  }

  async function addUrl() {
    if (!newUrl.trim()) return
    setLoading(true)
    try {
      await axios.post('/api/urls', { url: newUrl.trim() })
      setNewUrl('')
      await fetchUrls()
    } finally {
      setLoading(false)
    }
  }

  async function toggleStatus(id: number, status: string) {
    setLoading(true)
    try {
      const action = status === 'running' ? 'stop' : 'start'
      await axios.put(`/api/urls/${id}/${action}`)
      await fetchUrls()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Crawler Dashboard
      </Typography>

      {/* URL Ekleme */}
      <Box
        component={Paper}
        sx={{
          p: 2,
          mb: 4,
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <TextField
          fullWidth
          label="https://..."
          variant="outlined"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addUrl()}
        />
        <Button
          variant="contained"
          size="large"
          onClick={addUrl}
          disabled={!newUrl.trim() || loading}
        >
          Add URL
        </Button>
      </Box>

      {/* Tablo */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                {['ID', 'URL', 'Status', 'Actions'].map((h) => (
                  <TableCell key={h}>
                    <Typography fontWeight={600}>{h}</Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.id}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-all' }}>
                    <RouterLink to={`/urls/${item.id}`} style={{ textDecoration: 'none' }}>
                      <Typography color="primary">{item.url}</Typography>
                    </RouterLink>
                  </TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>
                    {item.status}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => toggleStatus(item.id, item.status)}
                    >
                      {item.status === 'running' ? 'Stop' : 'Start'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
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
