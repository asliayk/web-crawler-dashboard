import React, { useEffect, useState } from 'react'
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
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

interface UrlItem {
  id: number
  url: string
  created_at: string
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
      const res = await axios.get<{ urls: UrlItem[] }>('/urls')
      setList(res.data.urls)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function addUrl() {
    if (!newUrl.trim()) return
    setLoading(true)
    try {
      await axios.post('/urls', { url: newUrl.trim() })
      setNewUrl('')
      await fetchUrls()
      alert('URL başarıyla eklendi!')
    } catch (err) {
      console.error(err)
      alert('URL eklenirken hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  async function deleteUrl(id: number) {
    if (!window.confirm('Bu kaydı silmek istediğine emin misin?')) return
    setLoading(true)
    try {
      await axios.delete(`/urls/${id}`)
      await fetchUrls()
    } catch (err) {
      console.error(err)
      alert('Silme işlemi başarısız.')
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
                {['ID', 'URL', 'Created At', 'Actions'].map((h) => (
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
                    <RouterLink
                      to={`/urls/${item.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Typography color="primary">{item.url}</Typography>
                    </RouterLink>
                  </TableCell>
                  <TableCell>
                    {new Date(item.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Sil">
                      <IconButton
                        size="small"
                        onClick={() => deleteUrl(item.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
