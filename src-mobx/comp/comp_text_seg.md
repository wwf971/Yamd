

## Implementation Details

### Caret / Cursor

TextSeg draws its own caret. The browser caret is hidden (`caret-color: transparent`).

The caret bar must stay a 1px solid `#111827` bar. Do not lighten the color or
shrink it with `scaleX`; that makes the caret nearly invisible (this regressed
once already).

There are two drawing paths, chosen by whether the browser is currently
allowed to edit the element:

```text
logical caret mode (contentEditable off)
  -> split text at offsetFocused
  -> insert zero-width span.mobx-text-seg-caret between the two parts
  -> CSS ::after draws the bar on that span
  -> host span blinks via opacity animation

dom caret mode (contentEditable on, browser handles typing)
  -> children stay exactly one plain text node
  -> root gets class mobx-text-seg-caret-dom
  -> a layout effect measures the offset position (calcCaretOverlayPos)
     and writes --mobx-caret-left/top/height on the root
  -> CSS ::after on the root draws the bar at that position
```

The dom caret mode path must never insert an element between the text parts:
the browser mutates contentEditable children directly during typing and
deletion, and React crashes (`removeChild` NotFoundError) when it later
reconciles or unmounts nodes the browser already removed or merged. The caret
is only display; it never takes horizontal space in layout.

Firefox does not reliably extend native selection outside the contentEditable
editing host where a drag begins. For a drag that starts in an already focused
editable segment, prevent the native drag and build the DOM range from pointer
coordinates with Selection.setBaseAndExtent. Keep this fallback local to the
active editing segment; ordinary text keeps native browser selection. The
normal selectionchange listener still converts the resulting range into store
selection state.

After keyboard navigation crosses a segment or row boundary, a browser may
continue sending held-arrow keydown events to the previous editing host. When
the event target disagrees with the store-focused segment, restore that focus
and forward arrow events to the focused segment so key repeat continues. Do
not forward text-editing keys as synthetic keyboard events.

Firefox may enter another segment logically while leaving no usable native
caret in that editing host. Handle plain left- and right-arrow movement
explicitly from the current store offset, including during the render gap
immediately after focus moves.

Reset the caret CSS animation to time zero after every horizontal movement and
focus transition. The initial frame is visible, so the caret remains visible
during continuous movement and starts a fresh blink cycle after movement ends.
