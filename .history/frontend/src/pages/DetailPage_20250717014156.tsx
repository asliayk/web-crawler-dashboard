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

const COLORS = ['#4caf50', '#2196f3'] // internal, external

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
    } catch (err) {
      console.error('Detail load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  const handleRerun = async () => {
    if (!id) return
    try {
      await axios.put(`/urls/${id}/start`)
      // optional: immediately mark as running in UI
      setDetail((d) => (d ? { ...d, status: 'running' } as UrlDetail : d))
      // poll again after short delay
      setTimeout(loadDetail, 2000)
    } catch (err) {
      console.error('Re-run error:
