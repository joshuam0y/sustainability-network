import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import '../curriculum/curriculum.css'
import './review.css'
import ReviewApp from './ReviewApp.jsx'
import { applyColorVariables } from '../colors.js'

applyColorVariables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ReviewApp />
  </StrictMode>,
)
