import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

interface UrlItem { id: number; url: string; status: string }
export default function UrlManagementPage() {
  const [list, setList] = useState<UrlItem[]>([])
  const [newUrl, setNewUrl] = useState('')
  useEffect(() => { fetchUrls() }, [])
  async function fetchUrls() {
    const res = await axios.get('/api/urls')
    setList(res.data.urls)
  }
  async function addUrl() {
    if (!newUrl) return
    await axios.post('/api/urls', { url: newUrl })
    setNewUrl('')
    fetchUrls()
  }
  async function toggleStatus(id: number, status: string) {
    const action = status === 'running' ? 'stop' : 'start'
    await axios.put(`/api/urls/${id}/${action}`)
    fetchUrls()
  }
  return (
    <div>
      <div className="flex mb-4">
        <input className="border p-2 flex-grow" placeholder="https://..." value={newUrl}
          onChange={e => setNewUrl(e.target.value)} />
        <button className="ml-2 px-4 py-2 bg-blue-600 text-white rounded" onClick={addUrl}>Add URL</button>
      </div>
      <table className="w-full bg-white shadow rounded">
        <thead><tr>
          <th className="p-2">ID</th>
          <th className="p-2">URL</th>
          <th className="p-2">Status</th>
          <th className="p-2">Actions</th>
        </tr></thead>
        <tbody>
          {list.map(item => (
            <tr key={item.id} className="border-t">
              <td className="p-2">{item.id}</td>
              <td className="p-2 break-all"><Link to={`/urls/${item.id}`} className="text-blue-600 hover:underline">{item.url}</Link></td>
              <td className="p-2 capitalize">{item.status}</td>
              <td className="p-2">
                <button className="px-2 py-1 bg-green-500 text-white rounded mr-2"
                  onClick={() => toggleStatus(item.id, item.status)}>
                  {item.status === 'running' ? 'Stop' : 'Start'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}