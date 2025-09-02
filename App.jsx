import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './Home.jsx'
import CV from '@/cv/CV.jsx'
import Test from '@/test/Test.jsx'
import TestMarkdown from '@/test/TestMarkdown.jsx'
import AssetInfo from '@/asset/AssetInfo.jsx'
import ProjectRouter from '@/project/ProjectRouter.jsx'
import { useAssetStore } from '@/asset/Asset.js'
import { useProjectsMetadataStore } from '@/project/ProjectsMetadataStore.js'

// centralized asset fetching hook
function useGlobalAssetFetch() {
  const assetPaths = [
    'file/project/home/0-intro.txt',
    'yaml/project/home/projects.yaml',
    'yaml/project/home/1-skill.yaml',
    'yaml/project/home/2-edu.yaml',
    'yaml/project/home/3-activity.yaml'
  ];

  const { receiveProjectsAsset } = useProjectsMetadataStore();

  React.useEffect(() => {
    const store = useAssetStore.getState();
    
    // Fetch all assets that need refreshing
    assetPaths.forEach(assetPath => {
      const currentAsset = store.assets[assetPath];
      if (!currentAsset || store.shouldRefetch(assetPath)) {
        store.fetchAsset(assetPath);
      }
    });
  }, []);

  // Subscribe to projects asset changes and process metadata
  const projectsAssetPath = 'yaml/project/home/projects.yaml';
  const projectsAsset = useAssetStore((state) => state.assets[projectsAssetPath] || null);
  
  React.useEffect(() => {
    if (projectsAsset?.content?.type === 'json' && projectsAsset.content.data) {
      console.log('🔄 Processing projects metadata in App.jsx');
      receiveProjectsAsset(projectsAsset);
    }
  }, [projectsAsset, receiveProjectsAsset]);
}

function App() {
  console.log('App component rendering');
  // initialize global asset fetching
  useGlobalAssetFetch();
  
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<div>Root works!</div>} />
          {/* Root route */}
          {/* <Route path="/" element={<Home />} /> */}
          
            {/* CV routes - both with and without trailing slash */}
            <Route path="/cv" element={<CV />} />
            <Route path="/cv/" element={<CV />} />

          {/* Home routes - both with and without trailing slash */}
          <Route path="/home" element={<Home />} />
          <Route path="/home/" element={<Home />} />


          {/* Test routes */}
          <Route path="/test" element={<Test />} />
          <Route path="/test/" element={<Test />} />

          <Route path="/test-markdown" element={<TestMarkdown />} />
          <Route path="/test-markdown/" element={<TestMarkdown />} />
          
          {/* Asset routes - captures any URL starting with /asset/ */}
          <Route path="/asset/*" element={<AssetInfo />} />

          {/* Show routes - same component as asset routes */}
          <Route path="/show/*" element={<AssetInfo />} />

          {/* Project routes */}
          <Route path="/project/*" element={<ProjectRouter />} />

          {/* Catch-all route for 404 */}
          <Route path="*" element={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
              <a href="/home/" style={{ color: '#007acc' }}>Go back to Home</a>
            </div>
          } />
        </Routes>
      </div>
    </Router>
  )
}

export default App