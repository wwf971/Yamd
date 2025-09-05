



# About YAMD document.
YAMD is a markdown-like document I invented for writing/rendering/editing articles in my personal website and blog. It bascially reprensents document in a tree-like structrue, with attributes related to display styles stored in tree nodes. A parser and a React.js renderer is being designed to support writing YAMD document in yaml files and rendering it as markdown like document(hence its name).

The core grammar of YAMD document in yaml is a square bracket appended before or after text document, such as
- `xxx[a,b=c,d=e]`
- `[a=b,c,d=e]xxx`


# Idea
The purpose of this project is to provide a document writing/rendering/editing system based on a simple yet powerful internal representation of tree-like document. If markdown-like is essentially a tree-like structure, 