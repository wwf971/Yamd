import React from 'react';
import { useDocStoreContext } from '../DocStoreContext';
import { CompEvent } from '../docStore';

type TextSegProps = {
  data?: {
    compId?: string;
    sourceId?: string;
    targetId?: string;
    text?: string;
  };
  config?: {
    isActive?: boolean;
  };
  onEvent?: (event: CompEvent) => Promise<any> | any;
};

const TextSeg = React.forwardRef<any, TextSegProps>(({ data = {}, config = {}, onEvent }, ref) => {
  const contextDocStore = useDocStoreContext();
  const compId = String(data.compId || '');
  const compData = contextDocStore && compId
    ? contextDocStore.store.getCompDataById(contextDocStore.docId, compId)
    : null;
  const dataComp = compData?.data || data || {};
  const configComp = compData?.config || config || {};
  const sourceId = String(dataComp.sourceId || compId || 'text-seg');
  const targetId = String(dataComp.targetId || contextDocStore?.docId || '');
  const text = String(dataComp.text || '');
  const isActive = configComp.isActive === true;
  const rootRef = React.useRef<HTMLButtonElement | null>(null);

  React.useImperativeHandle(ref, () => ({
    dispatchEvent: async (event: CompEvent) => {
      const type = String(event?.type || '');
      if (type === 'focus') {
        rootRef.current?.focus();
        return { code: 0, message: 'TextSeg focused.' };
      }
      if (type === 'clickSingle') {
        rootRef.current?.focus();
        return { code: 0, message: 'TextSeg click received.' };
      }
      return { code: 0, message: `Ignored event: ${type}` };
    },
  }), []);

  return (
    <button
      ref={rootRef}
      type="button"
      className={`mobx-text-seg ${isActive ? 'is-active' : ''}`}
      onClick={() => {
        if (!onEvent) return;
        onEvent({
          type: 'clickSingle',
          sourceId,
          targetId,
          data: {},
        });
      }}
    >
      {text}
    </button>
  );
});

export default TextSeg;
