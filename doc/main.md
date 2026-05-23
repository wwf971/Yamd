

## cross selection

root element has explicit `iscontenteditable="true"`. most descendant elements do not have explicit `iscontenteditable="true"`, but inherit implicitly from parent component.

## event signaling

Jotai atom is used as event bus to trigger re-render and execution of event handling logic at target component.

Each node has a state jotai atom. docsState, an instance of DocsState, accomodate state atoms of all the the nodes.

Each has have multiple event counter atoms, which are derived atoms from node's state atom. A node can listen to specific types of events, by subscribing to the corresponding couter atom.

### event issuing

When issuing an event to a node, the event data will be 

### click event

if click falls onto leaf-level components, it is naturally captured by them.

if click falls onto Segments(for example when clicking at gaps between child components), or root components(for example when clicking at gaps between Segments), Segments/root component uses event signaling to trigger focus onto the nearest leaf-level component.



# Potential Issues

1. `ResizeObserver` in `ListItem.jsx` is for ensuring recalculation and update of bullet vertical position when comopnent's size/position changes. But this might cause performance issues, if many components change size/position simultaneously, for example when the container width is changed by dragging.



### Debug

When natively forcused, a text segment will have blue backgroud color, but when programtically focused, it will have orange background color.



## Keyboard Event


## Node Edit

### Indent/Outdent

Preserve caret location after indent/output.

Before outdenting, capture the cursor position from the selection's DOM element (traverse up to find element with `data-segment-id`). After outdenting, trigger focus directly on the captured segment with the preserved cursor position via `triggerFocus(segmentId, 'outdented', { cursorPos })`. The segment's focus handler uses `cursorPos` to restore the cursor position.
