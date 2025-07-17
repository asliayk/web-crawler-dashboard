import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios, { AxiosError, CancelTokenSource } from 'axios'
import {
  Container,
  Box,
  Paper,
  Typography,
  CircularProgress,
  Divider,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  Link as MuiLink,
} from '@mui/material'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'

/****************************
 * Types
 ****************************/
// Backend "detail" cevabı iki şekilde dönebiliyor:
// 1) broken_links bir sayı (count)
// 2) broken_links bir dizi (BrokenLink[])
// Bunu normalize edeceğiz.

export interface BrokenLinkApi {
  id: number
  url_id: number
  link: string
  status: number // HTTP status code
}

interface UrlDetailBaseApi {
  id: number
  url: string
  status: string // crawl job status: running|queued|done|error...
  html_version: string | null
  title: string | null
  h1_count: number
  h2_count: number
  h3_count: number
  h4_count: number
  h5_count: number
  h6_count: number
  internal_links: number
  external_links: number
  has_login_form: boolean
  created_at: string
  // broken_links: number | BrokenLinkApi[]  <-- union; ayrıntı aşağıda
}

type UrlDetailApiWithCount = UrlDetailBaseApi & { broken_links: number }
type UrlDetailApiWithList = UrlDetailBaseApi & { broken_links: BrokenLinkApi[] }
export type UrlDetailApi = UrlDetailApiWithCount | UrlDetailApiWithList

// Frontend'te daima normalize edilmiş şekli kullanacağız.
export interface BrokenLink {
  id: number
  url_id: number
  link: string
  status: number
}

export interface UrlDetailNorm extends UrlDetailBaseApi {
  broken_links_count: number
  // Eğer backend detail cevabında dizi döndüyse doldurulur; yoksa boş kalır.
  broken_links_list: BrokenLink[]
}

/****************************
 * Yardımcı Fonksiyonlar
 ****************************/
function normalizeUrlDetail(raw: UrlDetailApi): UrlDetailNorm {
  let count = 0
  let list: BrokenLink[] = []

  const anyRaw: any = raw as any
  const rawBroken = anyRaw.broken_links

  if (Array.isArray(rawBroken)) {
    list = rawBroken.map((b: any) => ({
      id: b.id,
      url_id: b.url_id,
      link: b.link,
      status: b.status,
    }))
    count = list.length
  } else if (typeof rawBroken === 'number') {
    count = rawBroken
  }

  const {
    id,
    url,
    status,
    html_version,
    title,
    h1_count,
    h2_count,
    h3_count,
    h4_count,
    h5_count,
    h6_count,
    internal_links,
    external_links,
    has_login_form,
    created_at,
  } = raw

  return {
    id,
    url,
    status,
    html_version,
    title,
    h1_count,
    h2_count,
    h3_count,
    h4_count,
    h5_count,
    h6_count,
    internal_links,
    external_links,
    has_login_form,
    created_at,
    broken_links_count: count,
    broken_links_list: list,
  }
}

/****************************
 * Sabitler
 ****************************/
const COLORS = ['#4caf50', '#2196f3']

/****************************
 * Bileşen
 ****************************/
export default function DetailPage() {
  const { id } = useParams<{ id: string }>()

  const [detail, setDetail] = useState<UrlDetailNorm | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Broken link list (ayrı endpointten ya da detail içinden)
  const [brokenList, setBrokenList] = useState<BrokenLink[]>([])
  const [brokenLoading, setBrokenLoading] = useState(false)
  const [brokenError, setBrokenError] = useState<string | null>(null)

  // Request iptal yönetimi
  const cancelRef = useRef<CancelTokenSource | null>(null)

  const cancelInFlight = () => {
    if (cancelRef.current) {
      cancelRef.current.cancel('cancelled due to new request')
      cancelRef.current = null
    }
  }

  /****************************
   * Detail yükle (polling destekli)
   ****************************/
  const loadDetail = useCallback(async () => {
    if (!id) return
    cancelInFlight()
    const source = axios.CancelToken.source()
    cancelRef.current = source
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get<UrlDetailApi>(`/urls/${id}`, { cancelToken: source.token })
      const normalized = normalizeUrlDetail(res.data)
      setDetail(normalized)

      // Eğer backend detail içerisinde broken list gönderdiyse direkt al.
      if (normalized.broken_links_list.length) {
        setBrokenList(normalized.broken_links_list)
      } else {
        // Backend sadece count göndermişse ve count>0 => ayrı endpointten çek.
        if (normalized.broken_links_count > 0) {
          loadBrokenLinks() // async; hatayı kendi içinde yönetiyor
        } else {
          setBrokenList([])
        }
      }
    } catch (err) {
      const ax = err as AxiosError
      if (!axios.isCancel(ax)) {
        console.error('loadDetail error:', ax)
        //setError(ax.message || 'Detail could not be loaded')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetail()
    return () => {
      cancelInFlight()
    }
  }, [loadDetail])

  // Poll: detail.status running|queued ise 2s sonra tekrar
  useEffect(() => {
    if (!detail) return
    if (detail.status === 'running' || detail.status === 'queued') {
      const t = setTimeout(loadDetail, 2000)
      return () => clearTimeout(t)
    }
  }, [detail, loadDetail])

  /****************************
   * Manual Re-run
   ****************************/
  const handleRerun = useCallback(async () => {
    if (!id) return
    try {
      await axios.put(`/urls/${id}/start`)
      // optimistic: durumu running yap, polling tekrar çeksin
      setDetail((d) => (d ? { ...d, status: 'running' } : d))
    } catch (e) {
      console.error('rerun error:', e)
      alert('Re-run failed')
    }
  }, [id])

  /****************************
   * Broken linkleri ayrı endpointten çek
   ****************************/
  const loadBrokenLinks = useCallback(async () => {
    if (!id) return
    setBrokenLoading(true)
    setBrokenError(null)
    try {
      const res = await axios.get<{ broken_links: BrokenLinkApi[] }>(`/urls/${id}/broken`)
      const arr = res.data?.broken_links ?? []
      setBrokenList(
        arr.map((b) => ({ id: b.id, url_id: b.url_id, link: b.link, status: b.status }))
      )
    } catch (err) {
      const ax = err as AxiosError
      console.error('brokenLinks error:', ax)
      setBrokenList([])
      setBrokenError(ax.message || 'Broken links could not be loaded')
    } finally {
      setBrokenLoading(false)
    }
  }, [id])

  /****************************
   * Grafik verisi (memo)
   ****************************/
  const pieData = useMemo(
    () => [
      { name: 'Internal', value: detail?.internal_links ?? 0 },
      { name: 'External', value: detail?.external_links ?? 0 },
    ],
    [detail?.internal_links, detail?.external_links]
  )

  /****************************
   * Render yardımcıları
   ****************************/
  if (loading && !detail) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadDetail}>
          Retry
        </Button>
      </Box>
    )
  }

  if (!detail) return null

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Başlık */}
        <Typography variant="h5" gutterBottom>
          {detail.title || '(no title)'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ wordBreak: 'break-all' }}>
          URL: <MuiLink href={detail.url} target="_blank" rel="noopener noreferrer">{detail.url}</MuiLink>
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

        {detail.status !== 'running' && detail.status !== 'queued' && (
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
          <Typography>
            Broken: <strong>{detail.broken_links_count}</strong>
          </Typography>
          <Typography>
            Internal: <strong>{detail.internal_links}</strong>
          </Typography>
          <Typography>
            External: <strong>{detail.external_links}</strong>
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Headings */}
        <Typography variant="h6" gutterBottom>
          Headings
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))',
            gap: 1,
          }}
        >
          <Typography>
            H1: <strong>{detail.h1_count}</strong>
          </Typography>
          <Typography>
            H2: <strong>{detail.h2_count}</strong>
          </Typography>
          <Typography>
            H3: <strong>{detail.h3_count}</strong>
          </Typography>
          <Typography>
            H4: <strong>{detail.h4_count}</strong>
          </Typography>
          <Typography>
            H5: <strong>{detail.h5_count}</strong>
          </Typography>
          <Typography>
            H6: <strong>{detail.h6_count}</strong>
          </Typography>
        </Box>

        {/* Broken link list */}
        {detail.broken_links_count > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Broken Links
              </Typography>
              {brokenLoading && <CircularProgress size={20} />}
              {!brokenLoading && (
                <Button variant="outlined" size="small" onClick={loadBrokenLinks}>
                  Reload
                </Button>
              )}
            </Box>
            {brokenError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {brokenError}
              </Alert>
            )}
            {brokenList.length === 0 && !brokenLoading && !brokenError ? (
              <Typography variant="body2" color="text.secondary">
                (No broken link details loaded.)
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Link</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {brokenList.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell sx={{ wordBreak: 'break-all' }}>
                        <MuiLink href={b.link} target="_blank" rel="noopener noreferrer">
                          {b.link}
                        </MuiLink>
                      </TableCell>
                      <TableCell>{b.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Paper>
    </Container>
  )
}
