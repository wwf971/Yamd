import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

console.log('main.jsx loaded');

const rootElement = document.getElementById('root');
console.log('root element:', rootElement);

if (rootElement) {
  const root = createRoot(rootElement);
  console.log('createRoot successful');
  
  try {
    root.render(<App />);
    console.log('render called');
  } catch (error) {
    console.error('Render error:', error);
  }
} else {
  console.error('Root element not found!');
}