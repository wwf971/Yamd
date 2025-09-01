import React, { useState, useRef } from 'react'
import useCVSettings from './CVSetting.js'
import BackToHome from '@/navi/BackToHome.jsx'
import './ControlPanel.css'

const ControlPanel = () => {
  const { 
    displayStyle, 
    heightMode, 
    toggleDisplayStyle, 
    toggleHeightMode 
  } = useCVSettings()

  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: window.innerWidth - 300, y: 20 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const panelRef = useRef(null)

  const handleMouseDown = (e) => {
    if (e.target.closest('.control-group')) return // Don't drag when clicking buttons
    
    setIsDragging(true)
    const rect = panelRef.current.getBoundingClientRect()
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])

  return (
    <div 
      ref={panelRef}
      className={`control-panel no-render ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="control-panel-header">
        <h3 className="control-panel-title">CV Display Settings</h3>
        <div className="drag-handle">⋮⋮</div>
      </div>
      
      <div className="control-group">
        <BackToHome className="control-nav-button" />
      </div>

      <div className="control-group">
        <label className="control-label">Display Style:</label>
        <button 
          className={`toggle-button ${displayStyle === 'reading' ? 'active' : ''}`}
          onClick={toggleDisplayStyle}
        >
          {displayStyle === 'reading' ? 'Reading Mode' : 'Rendering Mode'}
        </button>
      </div>

      <div className="control-group">
        <label className="control-label">Page Height:</label>
        <button 
          className={`toggle-button ${heightMode === 'content' ? 'active' : ''}`}
          onClick={toggleHeightMode}
        >
          {heightMode === 'content' ? 'Auto Height' : 'A4 Height'}
        </button>
      </div>
    </div>
  )
}

export default ControlPanel