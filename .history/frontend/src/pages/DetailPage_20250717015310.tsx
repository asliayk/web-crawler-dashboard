import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import {
  Container,
  Box,
  Paper,
  Typography,
  CircularProgress,
  Divider,
  Button,
} from '@mui/material'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'

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

const COLORS = ['#4caf50', '#2196f3']

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<UrlDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await axios.get<UrlDetail>(`/urls/${id}`)
      setDetail(res.data)
    } catch (e) {
      console.error('detail load', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  // simple poll while running
  useEffect(() => {
    if (!detail) return
    if (detail.status === 'running' || detail.status === 'queued') {
      const t = setTimeout(loadDetail, 2000)
      return () => clearTimeout(t)
    }
  }, [detail])

  const handleRerun = async () => {
    if (!id) return
    try {
      await axios.put(`/urls/${id}/start`)
      setDetail((d) => (d ? { ...d, status: 'running' } as UrlDetail : d))
    } catch (e) {
      console.error('rerun', e)
      alert('Re-run failed')
    }
  }

  if (loading && !detail) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }
  if (!detail) return null

  const pieData = [
    { name: 'Internal', value: detail.internal_links },
    { name: 'External', value: detail.external_links },
  ]

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {detail.title || '(no title)'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          URL: {detail.url}
        </Typography>
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          Status: <strong>{detail.status}</strong>
        </Typography>
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          HTML Version: <strong>{detail.html_version || '—'}</strong>
        </Typography>
        <Typography variant="subtitle1">
          Login Form: <strong>{detail.has_login_form ? 'Present' : 'Not Present'}</strong>
        </Typography>

        {detail.status !== 'running' && (
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" size="small" onClick={handleRerun}>
              Re-run Analysis
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Chart */}
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius="80%" label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Counts */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Typography>Broken Links: <strong>{detail.broken_links}</strong></Typography>
          <Typography>Internal: <strong>{detail.internal_links}</strong></Typography>
          <Typography>External: <strong>{detail.external_links}</strong></Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Headings */}
        <Typography variant="h6" gutterBottom>Headings</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 1 }}>
          <Typography>H1: <strong>{detail.h1_count}</strong></Typography>
          <Typography>H2: <strong>{detail.h2_count}</strong></Typography>
          <Typography>H3: <strong>{detail.h3_count}</strong></Typography>
          <Typography>H4: <strong>{detail.h4_count}</strong></Typography>
          <Typography>H5: <strong>{detail.h5_count}</strong></Typography>
          <Typography>H6: <strong>{detail.h6_count}</strong></Typography>
        </Box>
      </Paper>
    </Container>
  )
}
