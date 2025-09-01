import React, { useState } from 'react';
import { useServerStore } from '@/Server.js';

const Server = () => {
  // Server configuration
  const { getServerUrl, setServerUrl, getPresets, setPreset } = useServerStore();
  const [serverUrlInput, setServerUrlInput] = useState(getServerUrl());

  return (
    /* Server URL Configuration */
    <div style={{ 
      backgroundColor: '#fff3e0', 
      padding: '15px', 
      borderRadius: '8px', 
      marginBottom: '20px',
      border: '1px solid #ffb74d'
    }}>
      <div>🔧 Development Server Configuration</div>
      <p>Configure the server URL for asset fetching (useful in development mode):</p>
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
        <label style={{ minWidth: '100px' }}>Server URL:</label>
        <input 
          type="text" 
          value={serverUrlInput} 
          onChange={(e) => setServerUrlInput(e.target.value)}
          placeholder="https://wwf194.myqnapcloud.com:10001"
          style={{ 
            flex: 1, 
            padding: '5px 10px', 
            border: '1px solid #ddd', 
            borderRadius: '4px' 
          }}
        />
        <button 
          onClick={() => setServerUrl(serverUrlInput)}
          style={{ 
            padding: '5px 15px', 
            backgroundColor: '#ff9800', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Update
        </button>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label style={{ marginRight: '10px' }}>Presets:</label>
        {Object.entries(getPresets()).map(([name, url]) => (
          <button
            key={name}
            onClick={() => {
              setPreset(name);
              setServerUrlInput(url);
            }}
            style={{
              padding: '3px 8px',
              margin: '2px',
              backgroundColor: getServerUrl() === url ? '#4caf50' : '#e0e0e0',
              color: getServerUrl() === url ? 'white' : '#333',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            {name}
          </button>
        ))}
      </div>
      
      <div style={{ fontSize: '12px', color: '#666' }}>
        <strong>Current:</strong> {getServerUrl() || 'None (using relative URLs)'}<br/>
        <strong>Mode:</strong> {process.env.NODE_ENV || 'development'}
      </div>
    </div>
  )
}

export default Server;