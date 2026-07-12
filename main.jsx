import React from 'react';
import ReactDOM from 'react-dom/client';
import TestRender from './src/dev/TestRender.jsx';
import TestEdit from './src/dev/TestEdit.jsx';
import TestCustom from './src/dev/TestCustom.jsx';
import CrossElementSelectTest from './src/test/0-cross-el-select.jsx';
import { ItemTree, PanelDual } from '@wwf971/react-comp-misc';
import { mobxYamlTestItems } from './src-mobx/test/TestItems.jsx';
import './main.css';

/**
 * Main App component using slot-based MasterDetail API
 */
const testItems = [
  { key: 'group-html-tests', label: 'HTML Tests', description: '' },
  {
    key: 'cross-element-select',
    label: 'Cross Element Select',
    description: 'Selection behavior across inline and block nodes.',
    parentKey: 'group-html-tests',
    Comp: CrossElementSelectTest,
  },
  { key: 'group-document-renderer', label: 'Document Renderer', description: '' },
  {
    key: 'main-renderer',
    label: 'Main Renderer',
    description: 'Pipeline from YAML to render output.',
    parentKey: 'group-document-renderer',
    Comp: TestRender,
  },
  { key: 'group-document-editor', label: 'Document Editor', description: '' },
  {
    key: 'main-editor',
    label: 'Main Editor',
    description: 'Editable document with live flattened data.',
    parentKey: 'group-document-editor',
    Comp: TestEdit,
  },
  { key: 'group-custom-nodes', label: 'Custom Nodes', description: '' },
  {
    key: 'custom-node-test',
    label: 'Custom Node Test',
    description: 'Custom node registration and rendering checks.',
    parentKey: 'group-custom-nodes',
    Comp: TestCustom,
  },
  { key: 'group-mobx-tests', label: 'MobX Tests', description: '' },
  ...mobxYamlTestItems.map((itemData) => ({
    ...itemData,
    parentKey: itemData.parentKey || 'group-mobx-tests',
  })),
];

const testItemByKey = testItems.reduce((acc, itemData) => {
  if (itemData.Comp) {
    acc[itemData.key] = itemData;
  }
  return acc;
}, {});

const App = () => {
  const [selectedItemKey, setSelectedItemKey] = React.useState('main-editor');
  const selectedItem = testItemByKey[selectedItemKey] || null;
  const SelectedComp = selectedItem?.Comp || null;

  return (
    <div className="yamd-test-page">
      <PanelDual orientation="vertical" initialWidth={240}>
        <div className="yamd-test-sidebar">
          <ItemTree
            data={{
              items: testItems,
              selectedItemKey,
            }}
            config={{
              className: 'yamd-item-tree',
              titleText: 'Yamd Test Suite',
              searchPlaceholder: 'Search tests...',
            }}
            onEvent={(eventType, eventData) => {
              if (eventType !== 'itemSelect') return;
              const nextItemKey = String(eventData.itemData?.key || '').trim();
              if (!nextItemKey) return;
              if (!testItemByKey[nextItemKey]) return;
              setSelectedItemKey(nextItemKey);
            }}
          />
        </div>
        <div className="yamd-test-content">
          <div className="yamd-test-content-header">
            <div className="yamd-test-content-title">{selectedItem?.label || 'Test'}</div>
            <div className="yamd-test-content-description">{selectedItem?.description || ''}</div>
          </div>
          <div className="yamd-test-content-body">
            {SelectedComp ? <SelectedComp /> : null}
          </div>
        </div>
      </PanelDual>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);