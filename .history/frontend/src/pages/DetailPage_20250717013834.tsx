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
  html_version: string
  title: string
  internal_links: number
  external_links: number
  broken_links: number
  has_login_form: boolean
}

const COLORS = ['#4caf50', '#2196f3'] // internal, external

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<UrlDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    axios
      .get<UrlDetail>(`/urls/${id}`)
      .then((res) => setDetail(res.data))
      .finally(() => setLoading(false))
  }, [id])

  if (loading || !detail) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  const pieData = [
    { name: 'Internal', value: detail.internal_links },
    { name: 'External', value: detail.external_links },
  ]

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {detail.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          URL: {detail.url}
        </Typography>
        <Typography variant="subtitle1" sx={{ mt: 2 }}>
          HTML Version: <strong>{detail.html_version}</strong>
        </Typography>
        <Typography variant="subtitle1">
          Login Form:{' '}
          <strong>{detail.has_login_form ? 'Present' : 'Not Present'}</strong>
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius="80%"
                label
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography>
            Broken Links: <strong>{detail.broken_links}</strong>
          </Typography>
          <Typography>
            Internal Links: <strong>{detail.internal_links}</strong>
          </Typography>
          <Typography>
            External Links: <strong>{detail.external_links}</strong>
          </Typography>
        </Box>
      </Paper>
    </Container>
  )
}
