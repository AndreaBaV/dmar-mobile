import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Consola en el propio dispositivo (iPhone/Android) sin Mac: build con VITE_DEBUG_CONSOLE=true
if (import.meta.env.VITE_DEBUG_CONSOLE === 'true') {
  void import('vconsole').then((m) => {
    new m.default({ theme: 'dark' })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
