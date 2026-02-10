import React from 'react';
import ReactDOM from 'react-dom/client';
import TestRender from './src/dev/TestRender.jsx';
import TestEdit from './src/dev/TestEdit.jsx';
import TestCustom from './src/dev/TestCustom.jsx';
import CrossElementSelectTest from './src/test/0-cross-el-select.jsx';
import { MasterDetailInfiLevel, MasterDetailInfiLevelTab as Tab, MasterDetailInfiLevelSubTab as SubTab } from '@wwf971/react-comp-misc';

/**
 * Main App component using slot-based MasterDetail API
 */
const App = () => {
  return (
    <MasterDetailInfiLevel
      title="YAMD Test Suite"
      sidebarWidth="200px"
    >
      <Tab label="HTML Tests">
        <SubTab label="Cross Element Select">
          <CrossElementSelectTest />
        </SubTab>
      </Tab>
      
      <Tab label="Document Renderer">
        <SubTab label="Main Renderer">
            <TestRender />
        </SubTab>
      </Tab>

      <Tab label="Document Editor">
        <SubTab label="Main Editor" isDefault>
          <TestEdit />
        </SubTab>
      </Tab>
      
      <Tab label="Custom Nodes">
        <SubTab label="Custom Node Test">
          <TestCustom />
        </SubTab>
      </Tab>


    </MasterDetailInfiLevel>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);