import React from 'react'
import ControlPanel from '@/cv/ControlPanel.jsx'
import A4Container from '@/cv/A4Container.jsx'
import CVEducation from '@/cv/CVEducation.jsx'
import CVProjectCard from '@/cv/CVProjectCard.jsx'
import SkillTree from '@/home/SkillTree.jsx'
import { useAssetStore } from '@/asset/Asset.js'
import '@/markdown-yaml/Node.css'
import './CV.css'

const CV = () => {
  // Get data from YAML (fetched centrally in App.jsx)
  const skillsAssetPath = 'yaml/project/home/1-skill.yaml';
  const skillsAsset = useAssetStore((state) => state.assets[skillsAssetPath] || null);
  
  const projectsAssetPath = 'yaml/project/home/projects.yaml';
  const projectsAsset = useAssetStore((state) => state.assets[projectsAssetPath] || null);

  const projectsDisplay = [
    'semantic-motion',
    'mu',
    'dimension-robotics',
    'music-haptic',
    'irr',
    'mocap-vis',
    'rnn-navi',
  ]

  // Get filtered and ordered projects for display
  const getProjectsForCV = () => {
    if (!projectsAsset?.content?.data) return []
    
    const allProjects = projectsAsset.content.data
    const projectsMap = {}
    
    // Create a map of project names to project data
    allProjects.forEach(projectItem => {
      const [key, project] = Object.entries(projectItem)[0]
      console.log(`Project ${key}:`, project)
      console.log(`Project ${key} place:`, project.place)
      projectsMap[key] = { ...project, key }
    })
    
    // Return projects in the specified order
    return projectsDisplay
      .map(name => projectsMap[name])
      .filter(project => project) // Remove any undefined projects
  }

  const cvProjects = getProjectsForCV()

  return (
    <div className="cv-page">
      <ControlPanel />
      <A4Container>
        <div className="cv-content">
          {/* Header */}
          <div className="cv-header">
            <div className="cv-name">Weifan Wang</div>
            <div className="cv-contact">
              <span>timwang194@gmail.com</span>
              <a href="https://wwf194.myqnapcloud.com:10001/home/">https://wwf194.myqnapcloud.com:10001/home/</a>
            </div>
          </div>
          {/* Education Section */}
          <CVEducation />

          {/* Research Projects Section */}
          <div className="cv-projects-section">
            <div className="cv-section-title">Project Experiences</div>
            {cvProjects.length > 0 ? (
              <div className="cv-projects-container">
                {cvProjects.map((project, index) => (
                  <CVProjectCard key={project.key || index} project={project} />
                ))}
              </div>
            ) : (
              <div className="cv-projects-loading">
                Loading research projects...
              </div>
            )}
          </div>

          {/* Skills Section */}
          <div className="cv-skills-section">
            <div className="cv-section-title">Skill Set</div>
            <SkillTree skillsAsset={skillsAsset} title={null} />
          </div>
        </div>
      </A4Container>
    </div>
  )
}

export default CV
