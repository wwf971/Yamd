import React from 'react';
import { useDocStoreContext } from '../DocStoreContext';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';

type DocViewerProps = {
  data?: {
    compId?: string;
  };
};

const DocViewer = ({ data = {} }: DocViewerProps) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompListByParentId } = useDocCompRenderContext();
  const compId = String(data.compId || '');
  const [yamlRaw, setYamlRaw] = React.useState('');

  const refreshYaml = React.useCallback(() => {
    if (!contextDocStore) return;
    const textYaml = contextDocStore.store.getDocYamlRaw(contextDocStore.docId);
    setYamlRaw(textYaml);
  }, [contextDocStore]);

  React.useEffect(() => {
    refreshYaml();
  }, [refreshYaml]);

  return (
    <div className="doc-viewer-root">
      <div className="doc-viewer-header">
        <div className="doc-viewer-subtitle">1. Test doc YAML</div>
        <button type="button" className="doc-viewer-refresh-btn" onClick={refreshYaml}>
          Refresh
        </button>
      </div>
      <pre className="doc-viewer-yaml-box">{yamlRaw}</pre>
      <div className="doc-viewer-children">
        {compId ? renderCompListByParentId(compId) : null}
      </div>
    </div>
  );
};

export default DocViewer;
