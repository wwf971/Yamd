import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';

type DocViewerProps = {
  data?: {
    compId?: string;
  };
};

const DocViewer = observer(({ data = {} }: DocViewerProps) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompListByParentId } = useDocCompRenderContext();
  const compId = String(data.compId || '');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [yamlRaw, setYamlRaw] = React.useState('');

  const refreshYaml = React.useCallback(() => {
    if (!contextDocStore) return;
    const textYaml = contextDocStore.store.getDocYamlRaw(contextDocStore.docId);
    setYamlRaw(textYaml);
  }, [contextDocStore]);

  React.useEffect(() => {
    refreshYaml();
  }, [refreshYaml]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId) return undefined;
    const rootEl = rootRef.current;
    if (!rootEl) return undefined;
    contextDocStore.store.registerCompElement(contextDocStore.docId, compId, rootEl);
    return () => {
      contextDocStore.store.unregisterCompElement(contextDocStore.docId, compId, rootEl);
    };
  }, [contextDocStore, compId]);

  const handleMouseDown = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!contextDocStore || !compId) return;
    const rootEl = rootRef.current;
    const targetEl = event.target instanceof Element ? event.target : null;
    if (!rootEl || targetEl?.closest('[data-mobx-comp-id]') !== rootEl) return;
    contextDocStore.store.compIdFocus(contextDocStore.docId, compId, 'clickComponent');
  }, [contextDocStore, compId]);

  return (
    <div
      ref={rootRef}
      className="doc-viewer-root"
      data-mobx-comp-id={compId}
      data-mobx-comp-name="DocViewer"
      onMouseDown={handleMouseDown}
    >
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
});

export default DocViewer;
