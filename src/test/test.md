

## 0-cross-select.jsx

1. How To enable cross selection across elements?

container element has explicit `contenteditable="true"`, and all descedant elements do not explicitly set `contentediable` property.

2. How to make caret appear when clicking on element's text cotent?

either the element has `contenteditable="true"`, or its parent has `contenteditable="true"` and the element itself implicitly inherit from parent.