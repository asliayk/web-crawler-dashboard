import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface UrlItem {
  id: number;
  url: string;
}

export default function UrlList() {
  const [list, setList] = useState<UrlItem[]>([])

  useEffect(() => {
    axios.get('/api/urls').then(res => {
      setList(res.data.urls)
    })
  }, [])

  return (
    <table className="min-w-full border-collapse">
      <thead>
        <tr>
          <th className="border p-2">ID</th>
          <th className="border p-2">URL</th>
        </tr>
      </thead>
      <tbody>
        {list.map(item => (
          <tr key={item.id}>
            <td className="border p-2">{item.id}</td>
            <td className="border p-2">{item.url}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}