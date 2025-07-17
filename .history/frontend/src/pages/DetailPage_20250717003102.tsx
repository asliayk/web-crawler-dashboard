import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'

interface UrlDetail { id:number; url:string; html_version:string; title:string; internal_links:number; external_links:number; broken_links:number; has_login_form:boolean }
export default function DetailPage() {
  const { id } = useParams()
  const [detail, setDetail] = useState<UrlDetail|null>(null)
  useEffect(()=>{ axios.get(`/api/urls/${id}`).then(res=>setDetail(res.data)) },[id])
  if(!detail) return <div>Loading...</div>
  const data=[{name:'Internal',value:detail.internal_links},{name:'External',value:detail.external_links}]
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{detail.title}</h2>
      <p>HTML Version: {detail.html_version}</p>
      <PieChart width={300} height={200}><Pie data={data} dataKey="value" nameKey="name" outerRadius={80} fill="#8884d8">{data.map((entry,index)=><Cell key={index}/>)}</Pie><Tooltip/></PieChart>
    </div>
}