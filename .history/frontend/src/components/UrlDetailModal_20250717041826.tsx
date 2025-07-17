import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material'
import axios from 'axios'

interface BrokenLink {
  id: number
  url_id: number
  link: string
  status: number
}

interface UrlDetail {
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
  created_at: string
}

interface UrlDetailModalProps {
  url: UrlDetail | null
  onClose: () => void
}

export default function UrlDetailModal({ url, onClose }: UrlDetailModalProps) {
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (url) {
      console.log('UrlDetailModal opened for URL:', url)
      loadBrokenLinks()
    } else {
      console.log('UrlDetailModal opened for URL:', url)
      setBrokenLinks([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const loadBrokenLinks = async () => {
    if (!url) return
    console.log(`Fetching broken links for URL ID ${url.id}...`)
    setLoading(true)
    try {
      const { data } = await axios.get<{ broken_links: BrokenLink[] }>(
        `/urls/${url.id}/broken`
      )
      console.log('Response data:', data)
      setBrokenLinks(data.broken_links || [])
    } catch (err) {
      console.error('Failed fetching broken links', err)
      setBrokenLinks([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 500) return 'error'
    if (status >= 400) return 'warning'
    return 'default'
  }

  const getStatusText = (status: number) => {
    switch (status) {
      case 404:
        return 'Not Found'
      case 403:
        return 'Forbidden'
      case 500:
        return 'Internal Server Error'
      case 502:
        return 'Bad Gateway'
      case 503:
        return 'Service Unavailable'
      default:
        return `HTTP ${status}`
    }
  }

  if (!url) return null

  return (
    <Dialog open={!!url} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6">{url.title || '(No Title)'}</Typography>
        <Typography variant="body2" color="text.secondary">
          {url.url}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Chip
                label={`Status: ${url.status}`}
                color={
                  url.status === 'done'
                    ? 'success'
                    : url.status === 'error'
                    ? 'error'
                    : 'warning'
                }
              />
              <Chip label={`HTML: ${url.html_version || 'Unknown'}`} />
              <Chip label={`Login Form: ${url.has_login_form ? 'Yes' : 'No'}`} />
            </Box>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Link Statistics
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography>
                  Internal Links: <strong>{url.internal_links}</strong>
                </Typography>
                <Typography>
                  External Links: <strong>{url.external_links}</strong>
                </Typography>
                <Typography color="error">
                  Broken Links: <strong>{url.broken_links}</strong>
                </Typography>
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>
                Heading Counts
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1,
                }}
              >
                <Typography>
                  H1: <strong>{url.h1_count}</strong>
                </Typography>
                <Typography>
                  H2: <strong>{url.h2_count}</strong>
                </Typography>
                <Typography>
                  H3: <strong>{url.h3_count}</strong>
                </Typography>
                <Typography>
                  H4: <strong>{url.h4_count}</strong>
                </Typography>
                <Typography>
                  H5: <strong>{url.h5_count}</strong>
                </Typography>
                <Typography>
                  H6: <strong>{url.h6_count}</strong>
                </Typography>
              </Box>
            </Box>
          </Box>

          {url.broken_links > 0 && (
            <>
              <Divider />
              <Box>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
                >
                  <Typography variant="h6">Broken Links Details</Typography>
                  {loading && <CircularProgress size={20} />}
                </Box>

                {brokenLinks.length > 0 ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Link URL</TableCell>
                        <TableCell>Status Code</TableCell>
                        <TableCell>Description</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {brokenLinks.map((link) => (
                        <TableRow key={link.id}>
                          <TableCell
                            sx={{ wordBreak: 'break-all', maxWidth: 300 }}
                          >
                            {link.link}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={link.status}
                              color={
                                getStatusColor(link.status) as any
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{getStatusText(link.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  !loading && (
                    <Typography color="text.secondary">
                      No broken link details available.
                    </Typography>
                  )
                )}
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
