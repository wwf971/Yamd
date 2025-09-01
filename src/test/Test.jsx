import React from 'react';
import LinkInternal from '@/link/LinkInternal.jsx';
import Server from '@/auth/Server.jsx';
import FetchText from '@/asset/FetchText.jsx';
import BackToHome from '@/navi/BackToHome.jsx';

function Test() {
  return (
    <>
      <BackToHome />
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{maxWidth: '1200px', padding: '20px'}}>
          <h1 style={{textAlign:'center'}}>Test Page</h1>

          {/* Router Demo Section */}
          <div style={{ 
            backgroundColor: '#e3f2fd', 
            padding: '12px', 
            borderRadius: '6px', 
            marginBottom: '6px',
            border: '1px solid #90caf9'
          }}>
            <h3 style={{margin: '0px'}}>🔗 Router Demo</h3>
            <p>Test the routing system with these links:</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <LinkInternal to="/asset/">/asset/</LinkInternal>
              <LinkInternal to="/project/">/project/</LinkInternal>
              <LinkInternal to="/project/music-haptic">music-haptic</LinkInternal>
              <LinkInternal to="/project/mu">mu</LinkInternal>
              <LinkInternal to="/non-existent/">/non-existent/</LinkInternal>
              <LinkInternal to="/">Home</LinkInternal>
            </div>
          </div>

          <Server />

          <div style={{ marginBottom: '10px' }}>
            <strong>Caching Demo (same URL, multiple components):</strong><br/>
            <div style={{ backgroundColor: '#e8f5e8', padding: '5px', borderRadius: '3px', marginBottom: '5px' }}>
              First: <FetchText url="/file/project/home/0-intro.txt" style={{ fontWeight: 'bold' }} />
            </div>
            <div style={{ backgroundColor: '#e8f5e8', padding: '5px', borderRadius: '3px' }}>
              Second: <FetchText url="/file/version.txt" asText={true} /> (cached, no duplicate request)
            </div>
          </div>
        </div>
        {/* FetchText Demo Section */}
        <div style={{ 
          backgroundColor: '#f3e5f5', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          border: '1px solid #ce93d8'
        }}>
          <h3>📄 FetchText Component Demo</h3>
          <p>The FetchText component fetches text content from URLs:</p>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>As Span (with styling):</strong><br/>
            <FetchText 
              url="/file/README.md" 
              style={{ backgroundColor: '#fffde7', padding: '5px', borderRadius: '3px' }}
              fallback="Loading README..."
              errorMessage="Could not load README"
            />
          </div>
  
          <div style={{ marginBottom: '10px' }}>
            <strong>Error Example:</strong><br/>
            <FetchText 
              url="/file/nonexistent.txt" 
              errorMessage="File not found"
              style={{ color: '#d32f2f' }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default Test;
