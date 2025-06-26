import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'

export const LayoutTransition: React.FC = () => {
  const { layoutMode } = useStore()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [previousMode, setPreviousMode] = useState(layoutMode)

  useEffect(() => {
    if (layoutMode !== previousMode) {
      setIsTransitioning(true)
      
      // Reset transition state after animation completes
      const timer = setTimeout(() => {
        setIsTransitioning(false)
        setPreviousMode(layoutMode)
      }, 600) // Match CSS transition duration

      return () => clearTimeout(timer)
    }
  }, [layoutMode, previousMode])

  if (!isTransitioning) return null

  return (
    <div className="fixed top-16 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-lg" 
         style={{ 
           backgroundColor: 'var(--color-nightshift-darker)', 
           border: '1px solid var(--color-nightshift-accent)',
           color: '#f3f4f6'
         }}>
      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm">Switching to {layoutMode} mode...</span>
    </div>
  )
}