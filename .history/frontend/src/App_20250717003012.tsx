import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import UrlManagementPage from './pages/UrlManagementPage'
import DashboardPage from './pages/DashboardPage'
import DetailPage from './pages/DetailPage'

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow p-4">
          <h1 className="text-xl font-bold">Crawler Dashboard</h1>
        </header>
        <main className="p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/urls" />} />
            <Route path="/urls" element={<UrlManagementPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/urls/:id" element={<DetailPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}