# Document Data Format

## Core Shape

```ts
{
  docId: string,
  docName: string,
  dataInitial: {
    text: string
  },
  configInitial: {
    isEditable: boolean
  },
  compIdRoot: string,
  compById: Record<string, CompData>
}
```

## In Store

`DocStore` stores runtime data of ducments. Documents' data is in a `docById` object, and document is keyed by their id.

```ts
docById: Record<string, DocRecord>
```

`DocRecord` holds:
- document state (`TextDocData`)
- document config (`TextDocConfig`)
- serializable component tree (`compDataById`, `compIdRoot`)
- runtime component event registry (`compById`, `compOrder`)

## Serialization Direction

- yaml/json keeps serializable part (`docName`, `dataInitial`, `configInitial`, `compIdRoot`, `compById`)
- runtime creates `docId` as random id (0-9 a-z) when loading
- mapping `compName -> React component` determines actual rendering

Current test yaml uses `docName: text-basic`, with `EventTester` root and `TextBasic` child.
