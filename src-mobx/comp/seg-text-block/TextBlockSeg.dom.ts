import { getCaretOffset } from '../../util/caretUtils';

// The block renders its text plus one trailing phantom newline, so a real
// trailing newline in data shows an empty last line. All logical offsets are
// therefore clamped to the data text length, never into the phantom.
export function getCaretOffsetClamped(rootEl: HTMLElement | null, lengthText: number) {
  return Math.min(Math.max(0, Number(lengthText || 0)), Math.max(0, getCaretOffset(rootEl)));
}

// Read the current DOM selection inside the block as a logical text range.
// A collapsed caret yields offsetStart === offsetEnd.
export function getSelectionOffsetRange(rootEl: HTMLElement, lengthText: number) {
  const lengthSafe = Math.max(0, Number(lengthText || 0));
  const selection = window.getSelection();
  if (
    !selection
    || selection.rangeCount === 0
    || !selection.anchorNode
    || !rootEl.contains(selection.anchorNode)
  ) {
    const offsetFallback = getCaretOffsetClamped(rootEl, lengthSafe);
    return { offsetStart: offsetFallback, offsetEnd: offsetFallback };
  }
  const range = selection.getRangeAt(0);
  const rangeStart = range.cloneRange();
  rangeStart.selectNodeContents(rootEl);
  rangeStart.setEnd(range.startContainer, range.startOffset);
  const offsetStartRaw = rangeStart.toString().length;
  const rangeEnd = range.cloneRange();
  rangeEnd.selectNodeContents(rootEl);
  rangeEnd.setEnd(range.endContainer, range.endOffset);
  const offsetEndRaw = rangeEnd.toString().length;
  return {
    offsetStart: Math.min(lengthSafe, Math.max(0, offsetStartRaw)),
    offsetEnd: Math.min(lengthSafe, Math.max(0, offsetEndRaw)),
  };
}
