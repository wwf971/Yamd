import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Project from './Project.jsx';



const ProjectRouter = () => {
  // fetch project(a json dict) based on an url using zustand
  

  


  return (
    <Routes>
      {/* Route for specific projects: /project/music-haptic */}
      <Route path="/:projectName" element={<Project />} />
      
      {/* Default route for /project */}
      <Route path="/" element={
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Projects</h2>
          <p>Available projects:</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ margin: '10px 0' }}>
              <a href="/project/music-haptic" style={{ 
                color: '#1976d2', 
                textDecoration: 'none',
                padding: '5px 10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}>
                Music Haptic Project
              </a>
            </li>
            {/* Add more projects here */}
          </ul>
        </div>
      } />
    </Routes>
  );
};

export default ProjectRouter;