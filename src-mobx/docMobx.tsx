import React from 'react';
import { observer } from 'mobx-react-lite';
import TextBasic from './comp/TextBasic';
import { DocStoreProvider } from './DocStoreContext';
import { DocStore, createDocStore } from './docStore';
import type { CompEvent } from './docStoreTypes';
import './docMobx.css';

export const compIdDocRoot = 'comp-doc-root';
export const compIdTextBasicMain = 'comp-text-basic-main';
export const compByNameDefault = {
  TextBasic,
};

export function getCompByName(compName: string, compByName: Record<string, any> = compByNameDefault) {
  return compByName[String(compName || '')] || null;
}

export function renderCompByCompData({
  compData,
  compByName = compByNameDefault,
  onEvent,
  onDataChange,
  setCompRef,
}: {
  compData: any;
  compByName?: Record<string, any>;
  onEvent: (event: CompEvent) => Promise<any> | any;
  onDataChange?: (dataPatch: Record<string, any>) => Promise<any> | any;
  setCompRef?: (compId: string, element: any) => void;
}) {
  const Comp = getCompByName(compData?.compName, compByName);
  if (!Comp) return null;
  return (
    <Comp
      key={compData.compId}
      ref={(element: any) => {
        if (!setCompRef) return;
        setCompRef(compData.compId, element);
      }}
      data={{
        compId: compData.compId,
      }}
      config={{}}
      onEvent={onEvent}
      onDataChange={onDataChange}
    />
  );
}

export function renderCompById({
  compId,
  compDataById,
  compByName = compByNameDefault,
  onEvent,
  onDataChange,
  setCompRef,
  renderUnknown,
}: {
  compId: string;
  compDataById: Record<string, any>;
  compByName?: Record<string, any>;
  onEvent: (event: CompEvent, compData: any) => Promise<any> | any;
  onDataChange?: (dataPatch: Record<string, any>, compData: any) => Promise<any> | any;
  setCompRef?: (compId: string, element: any) => void;
  renderUnknown?: (compData: any) => React.ReactNode;
}) {
  const compData = compDataById?.[compId];
  if (!compData) {
    return null;
  }
  const Comp = getCompByName(compData.compName, compByName);
  if (!Comp) {
    return renderUnknown ? renderUnknown(compData) : null;
  }
  return renderCompByCompData({
    compData,
    compByName,
    setCompRef,
    onEvent: (event) => onEvent(event, compData),
    onDataChange: onDataChange ? (dataPatch) => onDataChange(dataPatch, compData) : undefined,
  });
}

type DocMobxProps = {
  store?: DocStore;
  data?: {
    docId?: string;
    text?: string;
  };
  config?: {
    isEditable?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const DocMobxInner = (
  { store, data = {}, config = {}, onEvent }: DocMobxProps,
  ref: any,
) => {
  const storeRef = React.useRef<DocStore | null>(null);
  const textBasicRef = React.useRef<any>(null);
  const docId = String(data.docId || 'mobx-doc');

  if (!storeRef.current) {
    storeRef.current = store || createDocStore({
      docId,
      text: data.text || '',
    });
  }
  const storeDoc = storeRef.current;

  React.useEffect(() => {
    storeDoc.initDoc(docId, {
      docId: data.docId,
      text: data.text,
    });
  }, [storeDoc, docId, data.docId, data.text]);

  React.useEffect(() => {
    storeDoc.updateConfig(docId, {
      isEditable: config.isEditable,
    });
  }, [storeDoc, docId, config.isEditable]);

  React.useEffect(() => {
    storeDoc.initCompData(docId, {
      [compIdDocRoot]: {
        compId: compIdDocRoot,
        compName: 'DocRoot',
        childIdList: [compIdTextBasicMain],
        data: {},
        config: {},
      },
      [compIdTextBasicMain]: {
        compId: compIdTextBasicMain,
        compName: 'TextBasic',
        childIdList: [],
        data: {
          sourceId: compIdTextBasicMain,
          targetId: docId,
        },
        config: {},
      },
    }, compIdDocRoot);

    storeDoc.registerComp(
      docId,
      compIdDocRoot,
      async (event) => {
        return storeDoc.receiveEvent(docId, event);
      },
      { parentId: null },
    );

    storeDoc.registerComp(
      docId,
      compIdTextBasicMain,
      async (event) => {
        if (!textBasicRef.current?.dispatchEvent) {
          return { code: -1, message: 'TextBasic is not ready.' };
        }
        return textBasicRef.current.dispatchEvent(event);
      },
      { parentId: compIdDocRoot },
    );

    return () => {
      storeDoc.unregisterComp(docId, compIdTextBasicMain);
      storeDoc.unregisterComp(docId, compIdDocRoot);
    };
  }, [storeDoc, docId]);

  const handleEventFromComp = React.useCallback(
    async (eventInput: CompEvent) => {
      const eventNormalized: CompEvent = {
        type: String(eventInput?.type || ''),
        sourceId: String(eventInput?.sourceId || compIdTextBasicMain),
        targetId: docId,
        data: eventInput?.data ?? {},
      };
      const result = await storeDoc.receiveEvent(docId, eventNormalized);
      if (onEvent) {
        await onEvent(eventNormalized);
      }
      return result;
    },
    [storeDoc, docId, onEvent],
  );

  const dataDoc = storeDoc.getDocData(docId);
  const configDoc = storeDoc.getDocConfig(docId);
  const isEditable = configDoc.isEditable === true;
  const currentComponentId = String(dataDoc.docId || '').trim();

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      const sourceId = String(event?.sourceId || 'unknown');
      const targetId = String(event?.targetId || '').trim();
      if (targetId && targetId !== currentComponentId) {
        return {
          code: -1,
          message: `Target mismatch. sourceId=${sourceId}, targetId=${targetId}, current=${currentComponentId}`,
        };
      }
      return storeDoc.sendEventToComp(docId, compIdTextBasicMain, event);
    },
  }), [storeDoc, docId, currentComponentId]);

  return (
    <DocStoreProvider value={{ store: storeDoc, docId }}>
      <div className="mobx-doc-root">
        <div className="mobx-doc-meta-row">
          <div className="mobx-doc-meta-item">Doc: {dataDoc.docId}</div>
          <div className="mobx-doc-meta-item">Mode: {isEditable ? 'edit' : 'view'}</div>
        </div>
        <TextBasic
          ref={textBasicRef}
          data={{ compId: compIdTextBasicMain, text: dataDoc.text }}
          config={{}}
          onEvent={handleEventFromComp}
          onDataChange={(dataPatch: any) => {
            if (!Object.prototype.hasOwnProperty.call(dataPatch || {}, 'text')) {
              return { code: 0, message: 'No text patch.' };
            }
            return storeDoc.updateText(docId, String(dataPatch?.text ?? ''));
          }}
        />
        <div className="mobx-doc-footer-row">
          <button
            type="button"
            className="mobx-doc-action-btn"
            onClick={() => {
              storeDoc.updateConfig(docId, { isEditable: !isEditable });
            }}
          >
            {isEditable ? 'Switch To View' : 'Switch To Edit'}
          </button>
          <div className="mobx-doc-footer-text">
            Text edits apply to store immediately.
          </div>
        </div>
      </div>
    </DocStoreProvider>
  );
};

const DocMobx = observer(React.forwardRef<any, DocMobxProps>(DocMobxInner));

export default DocMobx;
