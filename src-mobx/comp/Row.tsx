import React from 'react';
import { useDocStoreContext } from '../DocStoreContext';
import { CompEvent } from '../docStore';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';

type RowProps = {
  data?: {
    compId?: string;
    labelText?: string;
  };
  config?: {
    isRoot?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const Row = React.forwardRef<any, RowProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompById, getCompDataById } = useDocCompRenderContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || 'row');
  const labelText = String(dataComp.labelText || '');
  const isRoot = configComp.isRoot === true;
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
  const segIdList = childIdList.filter((childIdRaw) => {
    const childId = String(childIdRaw || '');
    const childCompData = getCompDataById(childId);
    return String(childCompData?.compName || '') === 'TextSeg';
  });

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      const type = String(event?.type || '');
      if (type === 'focus') {
        rowRef.current?.focus();
        return { code: 0, message: 'Row focused.' };
      }
      if (type === 'clickSingle') {
        rowRef.current?.focus();
        return { code: 0, message: 'Row click received.' };
      }
      return { code: 0, message: `Ignored event: ${type}` };
    },
  }), []);

  return (
    <div className={`mobx-row ${isRoot ? 'is-root' : ''}`}>
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        className="mobx-row-main"
        onClick={() => {
          if (!onEvent) return;
          onEvent({
            type: 'clickSingle',
            sourceId,
            targetId: String(contextDocStore?.docId || ''),
            data: {},
          });
        }}
      >
        {labelText ? <span className="mobx-row-label">{labelText}</span> : null}
        <div className="mobx-row-seg-list">{segIdList.map((segId) => renderCompById(segId))}</div>
      </div>
    </div>
  );
});

export default Row;
