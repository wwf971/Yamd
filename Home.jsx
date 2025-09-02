import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LinkInternal from '@/link/LinkInternal.jsx';
import SearchNote from '@/note/SearchNote.jsx';
import Text from '@/markdown/Text.jsx';
import Root from '@/markdown/Root.jsx';
import { useNoteStore } from '@/Note.js';
import { useAssetStore } from '@/asset/Asset.js';
import FetchText from '@/asset/FetchText.jsx';
import { useServerStore } from '@/Server.js';
import Server from '@/auth/Server.jsx';
import ProjectCard from '@/project/ProjectCard.jsx';
import NodeTimeline from '@/markdown-yaml/NodeTimeline.jsx';
import SkillTree from '@/home/SkillTree.jsx';
import Education from '@/home/Education.jsx';
import Motto from '@/home/Motto.jsx';
import Footer from '@/home/Footer.jsx';
import { useProjectsMetadataStore } from '@/project/ProjectsMetadataStore.js';
import '@/base.css';
import './Home.css';

function Home() {
  console.log('Home component rendering');


  // Get projects metadata from Zustand store (processed in App.jsx)
  const { projectsMetadata, isLoading: isProjectsLoading, error: projectsError } = useProjectsMetadataStore();

  // Get asset data (fetched centrally in App.jsx)
  const introAssetPath = 'file/project/home/0-intro.txt';
  const introAsset = useAssetStore((state) => state.assets[introAssetPath] || null);

  const skillsAssetPath = 'yaml/project/home/1-skill.yaml';
  const skillsAsset = useAssetStore((state) => state.assets[skillsAssetPath] || null);

  const eduAssetPath = 'yaml/project/home/2-edu.yaml';
  const eduAsset = useAssetStore((state) => state.assets[eduAssetPath] || null);

  const activityAssetPath = 'yaml/project/home/3-activity.yaml';
  const activityAsset = useAssetStore((state) => state.assets[activityAssetPath] || null);

  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="home-title">Wei-fan Wang's Home Page</h1>
          <div>
            {/* <div className="home-intro"><FetchText url='/file/project/home/0-intro.txt' isHtml /></div> */}

            {introAsset?.content?.data ? (
              // <div className="home-intro">{introAsset.content.data}</div>
              <div className="home-intro" dangerouslySetInnerHTML={{ __html: introAsset.content.data }}></div>
              ) : introAsset?.status === 'error' ? (
                <div className="home-intro" style={{ color: '#dc3545', fontStyle: 'italic' }}>
                  Failed to load intro: {introAsset.error}
                </div>
              ) : (
                <div className="home-intro">
                  Loading intro...
                </div>
            )}
              
            <Motto 
              motto_sentence="Keep looking. Don't settle."
              motto_people="Steve Jobs"
              motto_people_in_next_line={false}
            />
          </div>

        {/* Education Section */}
        <div className="home-section home-education-section">
          <Education eduAsset={eduAsset} />
        </div>

        {/* Skills Section */}
        <div className="home-section home-skills-section">
          <SkillTree skillsAsset={skillsAsset} />
        </div>

        {/* Projects Section */}
        <div className="home-section home-projects-section">
          <h3 className="home-projects-title">Project Experiences</h3>
          {projectsError ? (
            <div className="home-projects-error" style={{ color: '#dc3545', fontStyle: 'italic' }}>
              Failed to load projects: {projectsError}
            </div>
          ) : projectsMetadata ? (
            <div className="home-projects-container">
              {projectsMetadata.map((project, index) => (
                <ProjectCard key={project.name || project.key || index} project={project} />
              ))}
            </div>
          ) : (
            <div className="home-projects-loading">
              {isProjectsLoading ? 'Loading projects...' : 'Loading projects...'}
            </div>
          )}
        </div>

        {/* Activity Section */}
        {activityAsset?.content?.data ? (
          <div className="home-section home-activity-section">
            <h3 className="home-activity-title">Other Activities</h3>
            <NodeTimeline data={activityAsset.content.data} />
          </div>
        ) : activityAsset?.status === 'error' ? (
          <div className="home-activity-error" style={{ color: '#dc3545', fontStyle: 'italic' }}>
            Failed to load activities: {activityAsset.error}
          </div>
        ) : (
          <div className="home-activity-loading">
            Loading activities...
          </div>
        )}

      </div>
      <Footer />
      <LinkInternal to="/cv" text="CV" />
    </div>
  );
}


export default Home;
