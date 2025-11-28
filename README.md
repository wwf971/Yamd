## Yamd: renderer/editor for markdown-like documents.  
This tool intentionally omits the process of parsing from raw text to markdown, and represents documents using JSON objects.

### Design focus:
- Support for infinitely nested lists (inspired by the design ideas of [RemNote](https://www.remnote.com/))
- Allowing custom React.js components that manage their own data and render logic