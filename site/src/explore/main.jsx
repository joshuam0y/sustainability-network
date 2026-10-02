import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './explore.css'
import ExploreApp from './ExploreApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ExploreApp />
  </StrictMode>,
)
