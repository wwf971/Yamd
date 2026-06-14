import React from 'react';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../DocStoreContext';
import type { CompEvent } from '../docStoreTypes';
import { eventRowClick, eventRowDispatch } from '../event/eventLogicRow';
import { useDocCompRenderContext } from '../test/DocCompRenderContext';
import { useDocDragInteraction } from '../util/useDocDragInteraction';
import './Row.css';

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
  const bulletPositionState = contextDocStore && compId
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compId)
    : null;
  const compIdProviderBullet = contextDocStore && compId
    ? contextDocStore.store.pickCompBulletProviderId(contextDocStore.docId, compId)
    : '';
  const bulletProviderState = contextDocStore && compIdProviderBullet
    ? contextDocStore.store.getCompBulletPosState(contextDocStore.docId, compIdProviderBullet)
    : null;
  const rowRootRef = React.useRef<HTMLDivElement | null>(null);
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
  const counterBulletMeasureReq = Number(bulletPositionState?.counterBulletMeasureReq || 0);
  const compIdBasisBullet = String(bulletPositionState?.compIdBasis || compId);
  const isBulletMeasureEnabled = bulletPositionState?.isBulletMeasureEnabled !== false;
  const counterBulletMeasureDoneProvider = Number(bulletProviderState?.counterBulletMeasureDone || 0);
  const compIdBasisBulletProvider = String(bulletProviderState?.compIdBasis || '');
  const posYBulletPreferredProvider = bulletProviderState?.posYBulletPreferred ?? null;
  const messageBulletMeasureProvider = String(bulletProviderState?.messageBulletMeasure || '');
  const segIdList = childIdList.filter((childIdRaw) => {
    const childId = String(childIdRaw || '');
    const childCompData = getCompDataById(childId);
    return String(childCompData?.compName || '') === 'TextSeg';
  });
  const dragItemId = compId ? `row:${compId}` : '';
  const dragRuntimeState = contextDocStore && dragItemId
    ? contextDocStore.store.getDragItemRuntimeState(contextDocStore.docId, dragItemId)
    : null;
  const dragSegListItemId = compId ? `rowSegList:${compId}` : '';
  const dragSegListRuntimeState = contextDocStore && dragSegListItemId
    ? contextDocStore.store.getDragItemRuntimeState(contextDocStore.docId, dragSegListItemId)
    : null;
  const className = [
    'mobx-row',
    isRoot ? 'is-root' : '',
    runtimeState?.isFocusedLogical ? 'mobx-row-focused-logical' : '',
    runtimeState?.isElActive ? 'mobx-row-el-active' : '',
    runtimeState?.isFocusWithin ? 'mobx-row-focus-within' : '',
    runtimeState?.isSelectionWithin ? 'mobx-row-selection-within' : '',
    dragRuntimeState?.isDragged ? 'mobx-drag-item-dragged' : '',
    dragRuntimeState?.isDragHovered ? 'mobx-drag-item-hovered' : '',
    dragRuntimeState?.isDropAllowed === false ? 'mobx-drag-item-drop-denied' : '',
    dragRuntimeState?.isInsertBefore ? 'mobx-drag-insert-before' : '',
    dragRuntimeState?.isInsertAfter ? 'mobx-drag-insert-after' : '',
    dragRuntimeState?.isInsertInside ? 'mobx-drag-insert-inside' : '',
  ].filter(Boolean).join(' ');
  const classNameSegList = [
    'mobx-row-seg-list',
    dragSegListRuntimeState?.isDragHovered ? 'mobx-row-seg-list-drag-hovered' : '',
    dragSegListRuntimeState?.isDropAllowed === false ? 'mobx-drag-item-drop-denied' : '',
  ].filter(Boolean).join(' ');
  const { handlePointerDownCapture } = useDocDragInteraction({
    docId: contextDocStore?.docId || '',
    compId,
    store: contextDocStore?.store,
  });

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
        childIdList,
        segIdList,
      });
    },
  }), [contextDocStore, compId, childIdList, segIdList]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId) return undefined;
    const rootEl = rowRootRef.current;
    if (!rootEl) return undefined;
    contextDocStore.store.registerCompElement(contextDocStore.docId, compId, rootEl);
    return () => {
      contextDocStore.store.unregisterCompElement(contextDocStore.docId, compId, rootEl);
    };
  }, [contextDocStore, compId]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId || counterBulletMeasureReq <= 0 || !isBulletMeasureEnabled) return;
    if (!compIdProviderBullet) {
      contextDocStore.store.updateCompBulletPosResult(contextDocStore.docId, compId, {
        compIdBasis: compIdBasisBullet,
        compIdProvider: '',
        posYBulletPreferred: null,
        messageBulletMeasure: 'Provider missing.',
      });
      return;
    }
    contextDocStore.store.requestCompBulletPos(contextDocStore.docId, compIdProviderBullet, {
      compIdRequester: compId,
      compIdBasis: compIdBasisBullet,
      compIdProvider: compIdProviderBullet,
      isBulletMeasureEnabled: true,
    });
  }, [
    contextDocStore,
    compId,
    compIdBasisBullet,
    compIdProviderBullet,
    counterBulletMeasureReq,
    isBulletMeasureEnabled,
  ]);

  React.useLayoutEffect(() => {
    if (!contextDocStore || !compId || counterBulletMeasureReq <= 0 || !compIdProviderBullet) return;
    if (compIdBasisBulletProvider !== compIdBasisBullet) return;
    contextDocStore.store.updateCompBulletPosResult(contextDocStore.docId, compId, {
      compIdBasis: compIdBasisBullet,
      compIdProvider: compIdProviderBullet,
      posYBulletPreferred: posYBulletPreferredProvider,
      messageBulletMeasure: messageBulletMeasureProvider,
    });
  }, [
    contextDocStore,
    compId,
    compIdBasisBullet,
    compIdBasisBulletProvider,
    compIdProviderBullet,
    counterBulletMeasureDoneProvider,
    counterBulletMeasureReq,
    messageBulletMeasureProvider,
    posYBulletPreferredProvider,
  ]);

  return (
    <div
      ref={rowRootRef}
      className={className}
      data-mobx-comp-id={compId}
      data-mobx-comp-name="Row"
      data-mobx-outline-item-id={dragItemId}
      data-mobx-drag-item-id={dragItemId}
      onPointerDownCapture={handlePointerDownCapture}
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
          if (event.shiftKey && contextDocStore.store.consumeFocusClickSuppressed(contextDocStore.docId)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
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
        <div className={classNameSegList} data-mobx-row-seg-list-id={compId}>{childIdList.map((childId) => renderCompById(String(childId || '')))}</div>
      </div>
    </div>
  );
}));

export default Row;
