

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
