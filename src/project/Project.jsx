import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import DocumentRenderer from './DocumentRenderer.jsx';
import BackToHome from '@/navi/BackToHome.jsx';
import Footer from '@/home/Footer.jsx';
import { useAssetStore } from '@/asset/Asset.js';
import { useProjectStore, formatProjectPeoplePlace } from './ProjectStore.js';
import { useProjectsMetadataStore, extractKeywordNodeData } from './ProjectsMetadataStore.js';
import { cloneDeep } from 'lodash';
import { findKey, composeKeyWithAttributes } from '@/Note.js';
import { typesetMathJax } from '@/mathjax/MathJaxStore.js';


const addProjectInfo = (asset, projectData, projectMetadata) => {
  let dataProcessed = cloneDeep(projectData);
        
  let timelineResult = findKey(projectMetadata, "timeline", true);
  if (!timelineResult) {
    timelineResult = {
      value: [],
      attributes: {}
    }
  }
  console.error('🔍 timelineResult:', timelineResult);
  if (timelineResult) {
    // Compose the Progress key with merged attributes
    const progressKey = composeKeyWithAttributes("Progress", {
      child: "timeline", 
      self: "panel",
      ...(timelineResult.attributes && typeof timelineResult.attributes === 'object' ? timelineResult.attributes : {})
    });
    
    // Compose the Project Info key with panelDefault if it exists
    const projectInfoAttributes = { self: "panel", child: "ul" };
    if (timelineResult.attributes.panelDefault) {
      projectInfoAttributes.panelDefault = timelineResult.attributes.panelDefault;
    }
    const projectInfoKey = composeKeyWithAttributes("Project Info", projectInfoAttributes);
    
    // Get project metadata text using the extracted function
    const projectMetaText = formatProjectPeoplePlace(projectMetadata);

    const yaml_markdown_content = [];

    if(timelineResult.value?.length > 0){
      yaml_markdown_content.push(
        {[progressKey]:[
          ...(Array.isArray(timelineResult.value) ? timelineResult.value : []),
        ]}
      )
    }
    if(projectMetaText){
      yaml_markdown_content.push(
        projectMetaText
      )
    }
    
    // Extract keyword data using the shared function
    const keywordNodeData = extractKeywordNodeData(
      projectMetadata,
      "node-text-default",//selfClass
      "node-tag"//childClass
    );
    if(keywordNodeData){
      yaml_markdown_content.push(
        ...keywordNodeData
      )
    }
  
    let projectOngoingImage = null;
    console.error('🔍 projectMetadata:', projectMetadata);
    console.log('🔍 projectMetadata?.status:', projectMetadata?.status);
    if(projectMetadata?.status === 'ongoing'){
      console.error('🔍 projectMetadata?.status === ongoing');
      projectOngoingImage = {
        type: 'image',
        src: '/file/project/home/project-ongoing.png',
        alt: 'This project is ongoing',
        height: '300px',
        no_index: true,
      }
    }
  
    // insert project metadata
    dataProcessed[0].content = [
      ...(projectOngoingImage ? [projectOngoingImage] : []), // image saying this project is ongoing
      { // project metadata panel
        type: 'yaml-markdown',
        content: [
          {[projectInfoKey]: yaml_markdown_content}
        ]
      },
      ...(Array.isArray(dataProcessed[0].content) ? dataProcessed[0].content : []),
    ];
  }
  console.log('🔍 dataProcessed:', dataProcessed);
  return dataProcessed;
}

function Project() {
  const { projectName } = useParams();
  
  // Construct the project path based on the project name
  // For example: /project/music-haptic -> fetches from /yaml/project/music-haptic/music-haptic.yaml
  const projectPath = projectName ? `yaml/project/${projectName}/${projectName}.yaml` : null;

  // Asset and project store hooks
  const { fetchAsset } = useAssetStore();
  const { processProjectData, getProjectData, isProjectProcessed } = useProjectStore();
  
  // Get the asset and project data for this project
  const asset = useAssetStore((state) => state.assets[projectPath] || null);
  const projectData = useProjectStore((state) => projectPath ? state.projects[projectPath] : null);

  const projectsAssetPath = 'yaml/project/home/projects.yaml';
  const projectsAsset = useAssetStore((state) => state.assets[projectsAssetPath] || null);

  // fetch projectsMetadata from Zustand store (processed in App.jsx)
  const { projectsMetadata, getProjectByKey, receiveProjectsAsset } = useProjectsMetadataStore();
  
  // Use proper Zustand selector for reactive updates
  const projectMetadataCurrent = useProjectsMetadataStore(
    projectName ? getProjectByKey(projectName) : () => null
  );

  // Debug logging
  // console.log('🔍 projectMetadataCurrent:', projectMetadataCurrent);

  // More specific debugging for the failing condition
  if (!projectData) {
    console.log('❌ projectData is falsy:', projectData);
  } else if (!projectData.projectDataParsed) {
    console.log('❌ projectData.projectDataParsed is falsy:', projectData.projectDataParsed);
  } else if (!projectData.projectDataParsed.rootId) {
    console.log('❌ projectData.projectDataParsed.rootId is falsy:', projectData.projectDataParsed.rootId);
  } else {
    console.log('✅ All projectData checks passed, should render DocumentRenderer');
  }

  // Fetch project asset if needed
  useEffect(() => {
    if (!projectPath) return;
    
    const store = useAssetStore.getState();
    const currentAsset = store.assets[projectPath];
    
    if (!currentAsset || store.shouldRefetch(projectPath)) {
      store.fetchAsset(projectPath);
    }
  }, [projectPath]);

  // Ensure projects metadata is loaded when directly navigating to project page
  useEffect(() => {
    const store = useAssetStore.getState();
    const currentProjectsAsset = store.assets[projectsAssetPath];
    
    // If projects asset exists and is loaded, but metadata is not processed yet
    if (currentProjectsAsset?.content?.type === 'json' && 
        currentProjectsAsset.content.data && 
        !projectsMetadata) {
      console.log('🔄 Processing projects metadata in Project.jsx (direct navigation)');
      receiveProjectsAsset(currentProjectsAsset);
    }
    
    // If projects asset doesn't exist or needs refresh, fetch it
    if (!currentProjectsAsset || store.shouldRefetch(projectsAssetPath)) {
      console.log('📥 Fetching projects asset in Project.jsx (direct navigation)');
      store.fetchAsset(projectsAssetPath);
    }
  }, [projectsAssetPath, projectsMetadata, receiveProjectsAsset]);

  // Process projects asset when it becomes available
  useEffect(() => {
    if (projectsAsset?.content?.type === 'json' && 
        projectsAsset.content.data && 
        !projectsMetadata) {
      console.log('🔄 Processing projects metadata from asset change in Project.jsx');
      receiveProjectsAsset(projectsAsset);
    }
  }, [projectsAsset, projectsMetadata, receiveProjectsAsset]);

  // Process project data when asset is loaded
  useEffect(() => {
    if (!projectPath || !asset?.content?.data) return;
    
    if (asset.content.type === 'json' && asset.content.data) {
      const store = useProjectStore.getState();
      if (!store.isProjectProcessed(projectPath)) {
        console.log('🔄 Processing project data for:', projectPath);
        
        let dataProcessed = cloneDeep(asset.content.data);
        dataProcessed = addProjectInfo(asset, dataProcessed, projectMetadataCurrent);

        store.processProjectData(projectPath, dataProcessed).then(() => {
          console.log('✅ Project processing complete for:', projectPath);
        }).catch(error => {
          console.error('❌ Project processing failed:', error);
        });
      } else {
        console.log('ℹ️ Project already processed:', projectPath);
      }
    }
  }, [asset?.content, projectPath]);


  // Reprocess project data when metadata changes (only if already processed)
  useEffect(() => {
    if (!projectPath || !asset?.content?.data || !projectMetadataCurrent) return;
    
    if (asset.content.type === 'json' && asset.content.data) {
      const store = useProjectStore.getState();
      
      // Only reprocess if the project was already processed before
      // This prevents duplicate processing on initial load
      if (store.isProjectProcessed(projectPath)) {
        console.log(`🔄 Reprocessing project data for: ${projectPath} due to projectMetadataCurrent change`);
        
        // Process/modify the raw project data before parsing
        let dataProcessed = cloneDeep(asset.content.data);
        dataProcessed = addProjectInfo(asset, dataProcessed, projectMetadataCurrent);
        
        store.processProjectData(projectPath, dataProcessed).then(() => {
          console.log('✅ Project reprocessing complete for:', projectPath);
        }).catch(error => {
          console.error('❌ Project reprocessing failed:', error);
        });
      } else {
        console.log(`ℹ️ Skipping reprocessing for ${projectPath} - not yet initially processed`);
      }
    }
  }, [projectMetadataCurrent]);

  // Trigger MathJax typesetting after all components are rendered
  // NOTE: Disabled global typesetting to prevent DOM conflicts
  // MathJax should automatically detect LaTeX after manual initialization
  useEffect(() => {
    if (projectData && projectData.projectDataParsed && projectData.projectDataParsed.rootId) {
      console.log('🔄 Project fully rendered, triggering MathJax typeset...');
      
      // Use setTimeout to ensure React has finished all DOM updates
      const timer = setTimeout(async () => {
        try {
          const success = await typesetMathJax(); // Re-scan entire document
          if (success) {
            console.log('✅ MathJax typeset completed for project');
          } else {
            console.warn('⚠️ MathJax typeset failed or skipped');
          }
        } catch (error) {
          console.error('❌ MathJax typeset error:', error);
        }
      }, 1000); // Small delay to ensure DOM is ready
      
      return () => clearTimeout(timer);
    }
  }, [projectData?.projectDataParsed?.rootId]); // Trigger when project is fully parsed and ready
  
  if (!projectName) {
    return (
      <>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>No Project Selected</h2>
          <p>Please specify a project name in the URL.</p>
        </div>
        <BackToHome />
      </>
    );
  }

  // Handle loading state
  if (!asset || asset.status === 'loading') {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ flex: 1, padding: '20px', textAlign: 'center' }}>
            <div>Loading project...</div>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  // Handle error state
  if (asset?.status === 'error') {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ flex: 1, padding: '20px', textAlign: 'center' }}>
            <h3>Error Loading Project</h3>
            <p>{asset.error}</p>
            <button onClick={() => fetchAsset(projectPath)}>Retry</button>
            <br />
            <BackToHome />
          </div>
          <Footer />
        </div>
      </>
    );
  }

  // Handle invalid content type
  if (asset?.content?.type !== 'json') {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ flex: 1, padding: '20px', textAlign: 'center' }}>
            <h3>Invalid Project Type</h3>
            <p>Expected JSON project data, got {asset.content?.type}</p>
            <BackToHome />
          </div>
          <Footer />
        </div>
      </>
    );
  }

  // Handle processing state
  if (!projectData || !projectData.projectDataParsed || !projectData.projectDataParsed.rootId) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ flex: 1, padding: '20px', textAlign: 'center' }}>
            <div>Processing project...</div>
          </div>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ flex: 1 }}>
          <DocumentRenderer 
            projectData={projectData}
            projectMetadata={projectMetadataCurrent}
          />
        </div>
        <Footer />
      </div>
    </>
  );
}

export default Project;
