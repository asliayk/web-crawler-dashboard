import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import axios from 'axios'

axios.defaults.baseURL = 'http://localhost:8080/api'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)