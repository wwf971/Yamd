import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import { CompEvent } from '../docStore';
import { eventRowClick, eventRowDispatch } from '../event/eventLogicRow';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';

type RowProps = {
  data?: {
    compId?: string;
  };
  config?: {
    isRoot?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const Row = observer(React.forwardRef<any, RowProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompById, getCompDataById } = useDocCompRenderContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || 'row');
  const isRoot = configComp.isRoot === true;
  const runtimeState = contextDocStore && compId
    ? contextDocStore.store.getCompRuntimeState(contextDocStore.docId, compId)
    : null;
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
  const segIdList = childIdList.filter((childIdRaw) => {
    const childId = String(childIdRaw || '');
    const childCompData = getCompDataById(childId);
    return String(childCompData?.compName || '') === 'TextSeg';
  });
  const className = [
    'mobx-row',
    isRoot ? 'is-root' : '',
    runtimeState?.isFocusedLogical ? 'mobx-row-focused-logical' : '',
    runtimeState?.isElActive ? 'mobx-row-el-active' : '',
    runtimeState?.isFocusWithin ? 'mobx-row-focus-within' : '',
    runtimeState?.isSelectionWithin ? 'mobx-row-selection-within' : '',
  ].filter(Boolean).join(' ');

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      if (!contextDocStore || !compId) {
        return { code: -1, message: 'Row context missing.' };
      }
      return eventRowDispatch({
        event,
        store: contextDocStore.store,
        docId: contextDocStore.docId,
        compId,
        rowEl: rowRef.current,
        segIdList,
      });
    },
  }), [contextDocStore, compId, segIdList]);

  return (
    <div
      className={className}
      data-mobx-comp-id={compId}
      data-mobx-comp-name="Row"
    >
      <div
        ref={rowRef}
        tabIndex={0}
        className="mobx-row-main"
        onFocus={() => {
          if (!contextDocStore || !compId) return;
          contextDocStore.store.updateElActiveState(contextDocStore.docId, compId);
        }}
        onClick={(event) => {
          if (!contextDocStore || !compId) return;
          eventRowClick({
            event,
            store: contextDocStore.store,
            docId: contextDocStore.docId,
            compId,
            sourceId,
            onEvent,
          });
        }}
      >
        <div className="mobx-row-seg-list">{childIdList.map((childId) => renderCompById(String(childId || '')))}</div>
      </div>
    </div>
  );
}));

export default Row;
