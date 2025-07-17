import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Table, Input } from 'antd'

interface UrlSummary { id: number; title: string; html_version: string; internal_links: number; external_links: number; broken_links: number; has_login_form: boolean }
export default function DashboardPage() {
  const [data, setData] = useState<UrlSummary[]>([])
  const [search, setSearch] = useState('')
  useEffect(() => { fetchData() }, [])
  async function fetchData() {
    const res = await axios.get('/api/urls')
    setData(res.data.urls)
  }
  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title', sorter: (a:any,b:any)=>a.title.localeCompare(b.title) },
    { title: 'HTML Version', dataIndex: 'html_version', key: 'html_version' },
    { title: '#Internal', dataIndex: 'internal_links', key: 'internal_links', sorter:(a:any,b:any)=>a.internal_links-b.internal_links },
    { title: '#External', dataIndex: 'external_links', key: 'external_links', sorter:(a:any,b:any)=>a.external_links-b.external_links },
    { title: '#Broken', dataIndex: 'broken_links', key: 'broken_links', sorter:(a:any,b:any)=>a.broken_links-b.broken_links },
    { title: 'Login Form', dataIndex: 'has_login_form', key: 'has_login_form', render:(v:boolean)=>v?'Yes':'No' }
  ]
  const filtered = data.filter(item=>item.title.toLowerCase().includes(search.toLowerCase()))
  return (
    <div>
      <Input.Search className="mb-4" placeholder="Global Search" value={search} onChange={e=>setSearch(e.target.value)} />
      <Table dataSource={filtered} columns={columns} rowKey="id" pagination={{pageSize:10}} />
    </div>
}