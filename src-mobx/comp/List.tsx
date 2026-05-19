import React from 'react';
import { useDocStoreContext } from '../DocStoreContext';
import { CompEvent } from '../docStore';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';

type ListProps = {
  data?: {
    compId?: string;
    labelText?: string;
    compIdMain?: string;
  };
  config?: {
    isRoot?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const List = React.forwardRef<any, ListProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompById, getCompDataById } = useDocCompRenderContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || 'list');
  const labelText = String(dataComp.labelText || '');
  const isRoot = configComp.isRoot === true;
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
  const compIdMainByData = String(dataComp.compIdMain || '').trim();

  const compIdMain = React.useMemo(() => {
    if (compIdMainByData) {
      const compDataMain = getCompDataById(compIdMainByData);
      if (String(compDataMain?.compName || '') === 'Row') {
        return compIdMainByData;
      }
    }
    return childIdList.find((childIdRaw) => {
      const childId = String(childIdRaw || '');
      const childCompData = getCompDataById(childId);
      return String(childCompData?.compName || '') === 'Row';
    }) || '';
  }, [childIdList, compIdMainByData, getCompDataById]);

  const childIdListNested = childIdList.filter((childIdRaw) => {
    const childId = String(childIdRaw || '');
    if (!childId || childId === compIdMain) {
      return false;
    }
    const childCompData = getCompDataById(childId);
    const compName = String(childCompData?.compName || '');
    return compName === 'List' || compName === 'Row';
  });

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      const type = String(event?.type || '');
      if (type === 'focus') {
        listRef.current?.focus();
        return { code: 0, message: 'List focused.' };
      }
      if (type === 'clickSingle') {
        listRef.current?.focus();
        return { code: 0, message: 'List click received.' };
      }
      return { code: 0, message: `Ignored event: ${type}` };
    },
  }), []);

  return (
    <div className={`mobx-list ${isRoot ? 'is-root' : ''}`}>
      <div
        ref={listRef}
        role="button"
        tabIndex={0}
        className="mobx-list-main"
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
        {labelText ? <span className="mobx-list-label">{labelText}</span> : null}
        {compIdMain ? <div className="mobx-list-row-main">{renderCompById(compIdMain)}</div> : null}
      </div>
      {childIdListNested.length > 0 ? (
        <div className="mobx-list-children">
          {childIdListNested.map((childId) => renderCompById(String(childId || '')))}
        </div>
      ) : null}
    </div>
  );
});

export default List;
