import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import { CompEvent } from '../docStore';
import { eventListClick, eventListDispatch } from '../event/eventLogicList';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';

type ListProps = {
  data?: {
    compId?: string;
  };
  config?: {
    isRoot?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const List = observer(React.forwardRef<any, ListProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompById, getCompDataById } = useDocCompRenderContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || 'list');
  const isRoot = configComp.isRoot === true;
  const runtimeState = contextDocStore && compId
    ? contextDocStore.store.getCompRuntimeState(contextDocStore.docId, compId)
    : null;
  const listRootRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
  const mainCompId = String(compData?.mainCompId || '').trim();

  const compIdMain = React.useMemo(() => {
    if (!mainCompId) {
      return '';
    }
    const compDataMain = getCompDataById(mainCompId);
    return String(compDataMain?.compName || '') === 'Row' ? mainCompId : '';
  }, [mainCompId, getCompDataById]);

  const childIdListNested = childIdList.filter((childIdRaw) => {
    const childId = String(childIdRaw || '');
    if (!childId || childId === compIdMain) {
      return false;
    }
    const childCompData = getCompDataById(childId);
    const compName = String(childCompData?.compName || '');
    return compName === 'List' || compName === 'Row';
  });
  const className = [
    'mobx-list',
    isRoot ? 'is-root' : '',
    runtimeState?.isFocusedLogical ? 'mobx-list-focused-logical' : '',
    runtimeState?.isElActive ? 'mobx-list-el-active' : '',
    runtimeState?.isFocusWithin ? 'mobx-list-focus-within' : '',
    runtimeState?.isSelectionWithin ? 'mobx-list-selection-within' : '',
  ].filter(Boolean).join(' ');

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      if (!contextDocStore || !compId) {
        return { code: -1, message: 'List context missing.' };
      }
      return eventListDispatch({
        event,
        store: contextDocStore.store,
        docId: contextDocStore.docId,
        compId,
        listEl: listRootRef.current,
      });
    },
  }), [contextDocStore, compId]);

  return (
    <div
      ref={listRootRef}
      className={className}
      data-mobx-comp-id={compId}
      data-mobx-comp-name="List"
    >
      <div
        ref={listRef}
        tabIndex={0}
        className="mobx-list-main"
        onFocus={() => {
          if (!contextDocStore || !compId) return;
          contextDocStore.store.updateElActiveState(contextDocStore.docId, compId);
        }}
        onClick={(event) => {
          if (!contextDocStore || !compId) return;
          eventListClick({
            event,
            store: contextDocStore.store,
            docId: contextDocStore.docId,
            compId,
            sourceId,
            onEvent,
          });
        }}
      >
        {compIdMain ? <div className="mobx-list-row-main">{renderCompById(compIdMain)}</div> : null}
      </div>
      {childIdListNested.length > 0 ? (
        <div className="mobx-list-children">
          {childIdListNested.map((childId) => (
            <div key={String(childId || '')} className="mobx-list-item">
              <div className="mobx-list-bullet-box">
                <div className="mobx-list-bullet-disc" />
              </div>
              <div className="mobx-list-item-content">{renderCompById(String(childId || ''))}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}));

export default List;
