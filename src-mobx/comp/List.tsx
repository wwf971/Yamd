import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import type { CompEvent } from '../docStoreTypes';
import { eventListClick, eventListDispatch } from '../event/eventLogicList';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';
import { useDocDragInteraction } from '../util/useDocDragInteraction';
import './List.css';

type ListProps = {
  data?: {
    compId?: string;
    bulletType?: string;
  };
  config?: {
    isRoot?: boolean;
    isBulletConnectLineEnabled?: boolean;
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
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(compId || 'list');
  const isRoot = configComp.isRoot === true;
  const bulletType = normalizeBulletType(dataComp.bulletType);
  const runtimeState = contextDocStore && compId
    ? contextDocStore.store.getCompRuntimeState(contextDocStore.docId, compId)
    : null;
  const bulletPositionState = contextDocStore && compId
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compId)
    : null;
  const listRootRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
  const mainCompId = String(compData?.mainCompId || '').trim();
  const counterBulletMeasureReq = Number(bulletPositionState?.counterBulletMeasureReq || 0);
  const compIdBasisBullet = String(bulletPositionState?.compIdBasis || compId);
  const isBulletMeasureEnabled = bulletPositionState?.isBulletMeasureEnabled !== false;

  const compIdMain = React.useMemo(() => {
    if (!mainCompId) {
      return '';
    }
    const compDataMain = getCompDataById(mainCompId);
    return String(compDataMain?.compName || '') === 'Row' ? mainCompId : '';
  }, [mainCompId, getCompDataById]);
  const bulletProviderState = contextDocStore && compIdMain
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compIdMain)
    : null;
  const counterBulletMeasureDoneProvider = Number(bulletProviderState?.counterBulletMeasureDone || 0);
  const compIdBasisBulletProvider = String(bulletProviderState?.compIdBasis || '');
  const posYBulletPreferredProvider = bulletProviderState?.posYBulletPreferred ?? null;
  const messageBulletMeasureProvider = String(bulletProviderState?.messageBulletMeasure || '');

  const childIdListNested = childIdList.filter((childIdRaw) => {
    const childId = String(childIdRaw || '');
    if (!childId || childId === compIdMain) {
      return false;
    }
    const childCompData = getCompDataById(childId);
    const compName = String(childCompData?.compName || '');
    return compName === 'List' || compName === 'Row';
  });
  const isMainless = !compIdMain;
  const isBulletFlat = bulletType === 'flat';
  const isBulletConnectLineEnabled = configComp.isBulletConnectLineEnabled === true
    || (!isRoot && configComp.isBulletConnectLineEnabled !== false);
  const isBulletConnectLineVisible = isMainless
    && isBulletConnectLineEnabled
    && bulletType !== 'flat'
    && childIdListNested.length > 1;
  const dragItemId = compId ? `list:${compId}` : '';
  const dragRuntimeState = contextDocStore && dragItemId
    ? contextDocStore.store.getDragItemRuntimeState(contextDocStore.docId, dragItemId)
    : null;
  const className = [
    'mobx-list',
    isRoot ? 'is-root' : '',
    isMainless ? 'is-mainless' : '',
    `mobx-list-bullet-type-${bulletType}`,
    runtimeState?.isFocusedLogical ? 'mobx-list-focused-logical' : '',
    runtimeState?.isElActive ? 'mobx-list-el-active' : '',
    runtimeState?.isFocusWithin ? 'mobx-list-focus-within' : '',
    runtimeState?.isSelectionWithin ? 'mobx-list-selection-within' : '',
    dragRuntimeState?.isDragged ? 'mobx-drag-item-dragged' : '',
    dragRuntimeState?.isDragHovered ? 'mobx-drag-item-hovered' : '',
    dragRuntimeState?.isDropAllowed === false ? 'mobx-drag-item-drop-denied' : '',
    dragRuntimeState?.isInsertBefore ? 'mobx-drag-insert-before' : '',
    dragRuntimeState?.isInsertAfter ? 'mobx-drag-insert-after' : '',
    dragRuntimeState?.isInsertInside ? 'mobx-drag-insert-inside' : '',
    dragRuntimeState?.isInsertMain ? 'mobx-drag-insert-main' : '',
    dragRuntimeState?.isInsertBeforeSibling ? 'mobx-drag-insert-before-sibling' : '',
  ].filter(Boolean).join(' ');
  const { handlePointerDownCapture } = useDocDragInteraction({
    docId: contextDocStore?.docId || '',
    compId,
    store: contextDocStore?.store,
  });

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

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId) return undefined;
    const rootEl = listRootRef.current;
    if (!rootEl) return undefined;
    contextDocStore.store.registerCompElement(contextDocStore.docId, compId, rootEl);
    return () => {
      contextDocStore.store.unregisterCompElement(contextDocStore.docId, compId, rootEl);
    };
  }, [contextDocStore, compId]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId || counterBulletMeasureReq <= 0 || !isBulletMeasureEnabled) return;
    if (!compIdMain) {
      contextDocStore.store.updateCompBulletPosResult(contextDocStore.docId, compId, {
        compIdBasis: compIdBasisBullet,
        compIdProvider: '',
        posYBulletPreferred: null,
        messageBulletMeasure: 'Main row missing.',
      });
      return;
    }
    contextDocStore.store.requestCompBulletPos(contextDocStore.docId, compIdMain, {
      compIdRequester: compId,
      compIdBasis: compIdBasisBullet,
      compIdProvider: compIdMain,
      isBulletMeasureEnabled: true,
    });
  }, [
    contextDocStore,
    compId,
    compIdBasisBullet,
    compIdMain,
    counterBulletMeasureReq,
    isBulletMeasureEnabled,
  ]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId || counterBulletMeasureReq <= 0 || !compIdMain) return;
    if (compIdBasisBulletProvider !== compIdBasisBullet) return;
    contextDocStore.store.updateCompBulletPosResult(contextDocStore.docId, compId, {
      compIdBasis: compIdBasisBullet,
      compIdProvider: compIdMain,
      posYBulletPreferred: posYBulletPreferredProvider,
      messageBulletMeasure: messageBulletMeasureProvider,
    });
  }, [
    contextDocStore,
    compId,
    compIdBasisBullet,
    compIdBasisBulletProvider,
    compIdMain,
    counterBulletMeasureDoneProvider,
    counterBulletMeasureReq,
    messageBulletMeasureProvider,
    posYBulletPreferredProvider,
  ]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId) return;
    childIdListNested.forEach((childIdRaw) => {
      const childId = String(childIdRaw || '');
      if (!childId) return;
      contextDocStore.store.requestCompBulletPos(contextDocStore.docId, childId, {
        compIdRequester: compId,
        compIdBasis: childId,
        compIdProvider: childId,
        isBulletMeasureEnabled: true,
      });
    });
  }, [contextDocStore, compId, childIdListNested.join('|')]);

  return (
    <div
      ref={listRootRef}
      className={className}
      data-mobx-comp-id={compId}
      data-mobx-comp-name="List"
      data-mobx-outline-item-id={dragItemId}
      data-mobx-drag-item-id={dragItemId}
      onPointerDownCapture={handlePointerDownCapture}
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
          if (event.shiftKey && contextDocStore.store.consumeFocusClickSuppressed(contextDocStore.docId)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
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
        <div className={getChildrenClassName(isBulletFlat, isMainless)}>
          {childIdListNested.map((childId, childIndex) => {
            const childIdSafe = String(childId || '');
            const childCompData = getCompDataById(childIdSafe);
            const isChildListMainless = getIsCompListMainless(childCompData, getCompDataById);
            if (isChildListMainless) {
              return <div key={childIdSafe} className="mobx-list-transparent-item">{renderCompById(childIdSafe)}</div>;
            }
            const bulletPositionStateChild = contextDocStore && childIdSafe
              ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, childIdSafe)
              : null;
            const posYBulletPreferred = Number.isFinite(bulletPositionStateChild?.posYBulletPreferred)
              ? Number(bulletPositionStateChild?.posYBulletPreferred)
              : null;
            const childIdNext = String(childIdListNested[childIndex + 1] || '');
            const bulletPositionStateChildNext = contextDocStore && childIdNext
              ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, childIdNext)
              : null;
            const posYBulletPreferredNext = Number.isFinite(bulletPositionStateChildNext?.posYBulletPreferred)
              ? Number(bulletPositionStateChildNext?.posYBulletPreferred)
              : null;
            const isBulletConnectLineItem = isBulletConnectLineVisible
              && posYBulletPreferred !== null
              && posYBulletPreferredNext !== null;
            const styleItem = posYBulletPreferred === null
              ? undefined
              : {
                '--mobx-list-bullet-y': `${posYBulletPreferred}px`,
                ...(isBulletConnectLineItem
                  ? { '--mobx-list-bullet-y-next': `${posYBulletPreferredNext}px` }
                  : {}),
              } as React.CSSProperties;
            if (isBulletFlat) {
              return <div key={childIdSafe} className="mobx-list-flat-item">{renderCompById(childIdSafe)}</div>;
            }
            const classNameItem = [
              'mobx-list-item',
              isBulletConnectLineItem ? 'mobx-list-item-bullet-connected' : '',
            ].filter(Boolean).join(' ');
            return (
              <div key={childIdSafe} className={classNameItem} style={styleItem}>
                <div className="mobx-list-bullet-box">
                  {renderBulletMarker(bulletType, childIndex)}
                </div>
                <div className="mobx-list-item-content">{renderCompById(childIdSafe)}</div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}));

export default List;

function normalizeBulletType(bulletTypeRaw: unknown) {
  const bulletType = String(bulletTypeRaw || 'circle');
  return bulletType === 'flat' || bulletType === 'index' ? bulletType : 'circle';
}

function renderBulletMarker(bulletType: string, childIndex: number) {
  if (bulletType === 'index') {
    return <div className="mobx-list-bullet-index">{childIndex + 1}.</div>;
  }
  return <div className="mobx-list-bullet-disc" />;
}

function getChildrenClassName(isBulletFlat: boolean, isMainless: boolean) {
  return [
    isBulletFlat ? 'mobx-list-children-flat' : 'mobx-list-children',
    isMainless ? 'mobx-list-children-mainless' : '',
  ].filter(Boolean).join(' ');
}

function getIsCompListMainless(compData: any, getCompDataById: (compId: string) => any) {
  if (String(compData?.compName || '') !== 'List') return false;
  const mainCompId = String(compData.mainCompId || '').trim();
  if (!mainCompId) return true;
  const compDataMain = getCompDataById(mainCompId);
  return String(compDataMain?.compName || '') !== 'Row';
}
