import React from 'react';
import ReactDOM from 'react-dom/client';
import TestRender from './src/dev/TestRender.jsx';
import TestEdit from './src/dev/TestEdit.jsx';
import TestCustom from './src/dev/TestCustom.jsx';
import { MasterDetail, Tab, SubTab } from '@fugu/layout';

/**
 * Main App component using slot-based MasterDetail API
 */
const App = () => {
  return (
    <MasterDetail
      title="YAMD Test Suite"
      sidebarWidth="200px"
    >
      <Tab label="Document Renderer">
        <SubTab label="Main Renderer">
            <TestRender />
        </SubTab>
      </Tab>

      <Tab label="Document Editor">
        <SubTab label="Main Editor">
          <TestEdit />
        </SubTab>
      </Tab>
      
      <Tab label="Custom Nodes">
        <SubTab label="Custom Node Test">
          <TestCustom />
        </SubTab>
      </Tab>
    </MasterDetail>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);