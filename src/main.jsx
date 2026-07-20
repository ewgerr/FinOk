import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Initialize GA with environment variable
window.__GA_ID__ = import.meta.env.VITE_GA_ID;

if (window.__GA_ID__) {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${window.__GA_ID__}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', window.__GA_ID__);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
