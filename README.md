# Yamd

A React-based package renderer and live editor of markdown-like documents based that intentionally omits the process of parsing from raw text to markdown, and represents documents using JSON objects.

Currently there are two versions: one using jotai for global status management(documents under /doc/), the other using mobx(documents under /doc-mobx/). The jotai version is being gradually deprecated, and the mobx version is under active development.
 
### Design focus:

- Support for infinitely nested lists (inspired by the design ideas of [RemNote](https://www.remnote.com/))

- Allowing custom React.js components that manage their own data and render logic.