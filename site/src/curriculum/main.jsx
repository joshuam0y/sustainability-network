import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './curriculum.css'
import CurriculumApp from './CurriculumApp.jsx'
import { applyColorVariables } from '../colors.js'

applyColorVariables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CurriculumApp />
  </StrictMode>,
)
