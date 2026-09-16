import React from 'react';
import { createPortal } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { useDocStoreContext } from '../../DocStoreContext';
import './CompCreateDropdown.css';

// The dropdown of the comp create mode (see doc-mobx/comp_create.md). It is a
// pure view of the store's compCreateState: the match list, the selected
// index, and the anchor segment all come from the store. The hosting segment
// mounts it while the mode is active for that segment; the dropdown renders
// through a body portal, anchored below the '/' character.
//
// data-mobx-doc-control marks the dropdown as a document control, so pressing
// it does not count as a click outside the document (useDocUnfocusBoundary)
// and does not unfocus the hosting segment before the click applies.
const CompCreateDropdown = observer(() => {
  const contextDocStore = useDocStoreContext();
  const store = contextDocStore?.store;
  const docId = contextDocStore?.docId || '';
  const state = store ? store.getCompCreateState(docId) : null;
  const matchList = store ? store.compCreateGetMatchList(docId) : [];
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

  const segId = String(state?.segId || '');
  const offsetSlash = Number(state?.offsetSlash || 0);
  const textQuery = String(state?.textQuery || '');

  const updatePos = React.useCallback(() => {
    if (!store || !segId) return;
    const segEl = store.getCompElement(docId, segId);
    if (!segEl) return;
    const rectSlash = calcSlashClientRect(segEl, offsetSlash);
    const rectAnchor = rectSlash && rectSlash.height > 0 ? rectSlash : segEl.getBoundingClientRect();
    setPos({ left: rectAnchor.left, top: rectAnchor.bottom + 2 });
  }, [store, docId, segId, offsetSlash]);

  // Reposition when the mode region changes (typing can wrap the line) and on
  // window scroll/resize while the dropdown is open.
  React.useLayoutEffect(() => {
    updatePos();
  }, [updatePos, textQuery]);

  React.useEffect(() => {
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [updatePos]);

  if (!store || state?.isActive !== true || !pos) return null;

  return createPortal(
    <div
      className="mobx-comp-create-dropdown"
      style={{ left: pos.left, top: pos.top }}
      data-mobx-doc-control="true"
      onMouseDown={(event) => {
        // Keep the hosting segment focused; the click below does the work.
        event.preventDefault();
      }}
    >
      {matchList.length === 0 ? (
        <div className="mobx-comp-create-item-empty">No matching component</div>
      ) : matchList.map((entry, index) => (
        <div
          key={entry.compDefId}
          className={index === state.indexSelected
            ? 'mobx-comp-create-item is-selected'
            : 'mobx-comp-create-item'}
          onClick={() => {
            store.compCreateApply(docId, index);
          }}
        >
          {entry.compName}
        </div>
      ))}
    </div>,
    document.body,
  );
});

export default CompCreateDropdown;

// Client rect of the '/' character inside the segment element, found by
// walking the text nodes to the slash offset. Falls back to null when the
// offset is out of range (the caller then anchors at the segment box).
function calcSlashClientRect(segEl: HTMLElement, offsetSlash: number): DOMRect | null {
  const walker = document.createTreeWalker(segEl, NodeFilter.SHOW_TEXT);
  let offsetPassed = 0;
  while (true) {
    const nodeText = walker.nextNode();
    if (!nodeText) break;
    const lengthNode = String(nodeText.textContent || '').length;
    if (offsetSlash < offsetPassed + lengthNode) {
      const range = document.createRange();
      range.setStart(nodeText, offsetSlash - offsetPassed);
      range.setEnd(nodeText, Math.min(lengthNode, offsetSlash - offsetPassed + 1));
      return range.getBoundingClientRect();
    }
    offsetPassed += lengthNode;
  }
  return null;
}
