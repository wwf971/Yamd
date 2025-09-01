import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './ProjectCard.css';
import { useServerStore } from '@/Server.js';
import { formatProjectPeoplePlace } from './ProjectStore.js';

/**
 * ProjectCard Component
 * Displays a project card with cover image, title, intro, and links
 * Based on the Vue.js implementation in project.html
 * 
 * Props:
 * - project: object - Project data with cover, title, intro, link, status, people
 */
function ProjectCard({ project }) {
  const getFullUrl = useServerStore((state) => state.getFullUrl);
  const navigate = useNavigate();
  // console.log(project);
  const handleCardClick = () => {
    // Navigate to the project page using the project name
    if (project.name) {
      navigate(`/project/${project.name}`);
      return;
    }
    
    // Fallback: if no project name, try the old behavior (commented out)
    // if (!project.link) return;
    
    // Check if any link text includes "Project Page"
    // for (let text in project.link) {
    //   if (text.toLowerCase().includes('project page')) {
    //     window.open(project.link[text], '_blank');
    //     return;
    //   }
    // }
    
    // If no "Project Page", check for PDF links
    // for (let text in project.link) {
    //   if (project.link[text].toLowerCase().includes('.pdf') || text.toLowerCase().includes('pdf')) {
    //     window.open(project.link[text], '_blank');
    //     return;
    //   }
    // }
  };

  return (
    <div className="project-card"
      // onClick={handleCardClick}
    >
      {/* Project image on the left */}
      <div className="project-image-container">
        <div className="project-image">
          {project.cover ? (
            <img 
              src={getFullUrl(project.cover)} 
              alt={project.title}
              style={{ 
                objectFit: project.cover_object_fit ? project.cover_object_fit : 'cover' 
              }}
            />
          ) : (
            <div className="project-image-placeholder">
              <span>No Image</span>
            </div>
          )}
          
          {/* Ongoing banner overlay */}
          {project.status === 'ongoing' && (
            <div className="project-ongoing-banner">
              <span>ongoing</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Project content on the right */}
      <div className="project-content">
        <div>
          {/* Title at the top */}
          <div className="project-title">{project.title}</div>
          {/* Intro in the middle */}
          <div className="project-intro">{project.intro}</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'row', gap: '6px', flexWrap: 'wrap', justifyContent: 'space-between'}}>
          <div style={{flex: 1}}>
              {/* Project Metadata (People/Type) */}
              {formatProjectPeoplePlace(project, false) && (
                <div className="project-people">
                  {formatProjectPeoplePlace(project, false)}
                </div>
              )}
          </div>

          <div style={{ justifySelf: 'flex-end', display: 'flex', flexDirection: 'row',
              gap: '6px', flexWrap: 'wrap', alignSelf: 'stretch' }}>
            {/* Links at the bottom */}
              {project.link && Object.entries(project.link).map(([text, url]) => (
                <button 
                  key={text}
                  className="project-link-btn project-tag"
                  disabled={!project.name}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click
                    if (project.name) {
                      navigate(`/project/${project.name}`);
                    }
                  }}
                >
                  {text}
                </button>
            ))}

            {
              project.type && (
                <span className="project-type project-tag">
                  {project.type}
                </span>
              )
            }

            {/* {project.status && project.status.map((status, idx) => (
              <span key={idx} className="project-status project-tag">
                {status}
              </span>
            ))} */}

          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;