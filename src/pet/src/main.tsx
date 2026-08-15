import React from 'react'
import ReactDOM from 'react-dom/client'
import { PetApp } from './PetApp'
import './index.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PetApp />
  </React.StrictMode>,
)
