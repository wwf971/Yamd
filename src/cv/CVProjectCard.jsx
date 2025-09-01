import React from 'react'
import { Node } from '@/markdown-yaml/Node.jsx'
import { formatProjectPeoplePlace } from '@/project/ProjectStore.js'
import { extractKeywordNodeData } from '@/project/ProjectsMetadataStore.js'
import './CVProjectCard.css'
import '@/markdown-yaml/Node.css'

const CVProjectCard = ({ project }) => {
  console.warn('CVProjectCard - Full project object:', project)
  
  // Find the intro-cv entry
  const introKey = Object.keys(project).find(key => key.startsWith('intro-cv'))
  const introData = introKey ? project[introKey] : null
  
  // Extract keyword data using the shared function
  const keywordNodeData = extractKeywordNodeData(project);
  console.error('CVProjectCard - keywordNodeData:', keywordNodeData)
  
  // console.log('CVProjectCard - introData:', introData)
  // console.log('CVProjectCard - keywordResult:', keywordResult)
  // console.log('CVProjectCard - keywordNodeData:', keywordNodeData)

  let nodeData = null;
  if (introData) {
    nodeData = [{
      // ['intro-cv[self=none,child=ul]']: introData
      [introKey]: introData
    }];
  }
  console.warn('CVProjectCard - nodeData:', nodeData)


  // Format time - extract from time field if available
  const getTimeDisplay = (project) => {
    if (!project.time) return null
    const { start, end } = project.time
    
    // Helper to format month as 2 digits
    const formatMonth = (month) => {
      if (!month) return null
      return month.toString().padStart(2, '0')
    }
    
    // Helper to format year/month for date objects
    const formatDate = (dateObj) => {
      if (!dateObj || !dateObj.year) return null
      const year = dateObj.year
      const month = formatMonth(dateObj.month)
      return month ? `${year}/${month}` : year.toString()
    }
    
    // Helper to format end time (can be object or string)
    const formatEndTime = (endTime) => {
      if (typeof endTime === 'string') {
        return endTime // Return string as-is (e.g., "present")
      } else if (typeof endTime === 'object' && endTime !== null) {
        return formatDate(endTime) // Format as date object
      }
      return null
    }
    
    const startDate = formatDate(start)
    const endTime = formatEndTime(end)
    
    if (startDate && endTime) {
      return `${startDate} - ${endTime}`
    } else if (startDate) {
      return `${startDate} - present`
    } else if (endTime) {
      return `until ${endTime}`
    }
    
    return null
  }

  const timeDisplay = getTimeDisplay(project)

  return (
    <div className="cv-project-card">
      {/* Header: Title and Type */}
      <div className="cv-project-header">
        <div className="cv-project-title">
          {(() => {
            const displayTitle = project['title-cv'] || project.title;
            return displayTitle && displayTitle.split('\\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < displayTitle.split('\\n').length - 1 && <br />}
              </React.Fragment>
            ));
          })()}
        </div>
        <div className="cv-project-type">{project.type}</div>
      </div>

      {/* Divider */}
      <div className="cv-project-divider"></div>

      {/* Authors and Time */}
      <div className="cv-project-meta">
        <div className="cv-project-people">
          {formatProjectPeoplePlace(project)}
        </div>
        {timeDisplay && <div className="cv-project-time">{timeDisplay}</div>}
      </div>

      {/* Keywords */}
      {keywordNodeData && (
        <div className="cv-project-keywords">
          <Node data={keywordNodeData} rootStyle="default" />
        </div>
      )}

      {/* Intro CV Content */}
      {introData && (
        <div className="cv-project-intro">
          <Node data={nodeData} rootStyle="default" />
        </div>
      )}
    </div>
  )
}

export default CVProjectCard
