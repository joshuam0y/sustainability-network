import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './programs.css'
import ProgramsApp from './ProgramsApp.jsx'
import { applyColorVariables } from '../colors.js'

applyColorVariables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ProgramsApp />
  </StrictMode>,
)
