import { create } from 'zustand'

const useCVSettings = create((set) => ({
  // Display style: 'reading' for screen reading, 'pdf' for print/PDF
  displayStyle: 'reading',
  
  // Height mode: 'content' for auto height, 'a4' for fixed A4 height
  heightMode: 'content',
  
  // Toggle between reading and PDF styles
  toggleDisplayStyle: () => set((state) => ({
    displayStyle: state.displayStyle === 'reading' ? 'pdf' : 'reading'
  })),
  
  // Toggle between content height and A4 height
  toggleHeightMode: () => set((state) => ({
    heightMode: state.heightMode === 'content' ? 'a4' : 'content'
  })),
  
  // Set specific display style
  setDisplayStyle: (style) => set({ displayStyle: style }),
  
  // Set specific height mode
  setHeightMode: (mode) => set({ heightMode: mode })
}))

export default useCVSettings
