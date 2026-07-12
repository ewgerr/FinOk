import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Initialize GA with environment variable
window.__GA_ID__ = import.meta.env.VITE_GA_ID;

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
