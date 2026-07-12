# TextBasic component contract

`TextBasic` is a render component for plain text display/edit.
It does not own document truth. `DocStore` is the source of truth.

## 1) React props shape

```ts
type TextBasicData = {
  compId?: string;      // injected by generic renderer
  sourceId?: string;    // event sender id (default: comp-text-basic)
  targetId?: string;    // doc id
  text: string;         // current text to render
}

type TextBasicConfig = {
  isEditable?: boolean;
  placeholder?: string;
}

type TextBasicProps = {
  data: TextBasicData;
  config?: TextBasicConfig;
  onEvent?: (event: CompEvent) => Promise<any> | any;
  onDataChange?: (dataPatch: object) => Promise<any> | any;
}
```

## 2) Inbound event shape (store/root -> TextBasic)

`TextBasic` exposes:

```ts
ref.dispatchEvent(event: CompEvent)
```

Supported `event.type`:

- `focus`
  - `data.direction`: `fromLeft | fromRight | fromUp | fromDown | fromAbove | fromBelow`
  - `data.mousePos` optional: `{ x?: number; y?: number; xRatio?: number }`
- `clickSingle`
  - `data.mousePos` optional

Other types return unsupported result.

## 3) Outbound event shape (TextBasic -> store)

Event envelope:

```ts
type CompEvent = {
  id?: string;     // store issues if missing
  type: string;
  sourceId: string;
  targetId: string;
  data: any;
}
```

`TextBasic` emits interaction events:

- `keyDown` with keyboard flags
- `clickSingle`
- `focus`
- `unfocus`

For data update, `TextBasic` uses direct data callback:

```ts
onDataChange({ text: string })
```

## 4) Store-side shape used by TextBasic

Document-level state:

```ts
type TextDocData = {
  docId: string;
  docName: string;
  text: string;
  lastEventType: string;
}

type TextDocConfig = {
  isEditable: boolean;
}
```

Component node-level data (for YAML/render tree):

```ts
type CompData = {
  compId: string;
  compName: 'TextBasic' | string;
  childIdList: string[];
  data: TextBasicData;
  config: TextBasicConfig;
}
```

`DocStore.syncTextBasicCompData(...)` keeps `CompData.data/config` aligned with document truth.

## 5) Minimal YAML example

```yaml
dataDocInitial:
  text: hello

compById:
  a1:
    compName: TextBasic
    childIdList: []
    data:
      text: hello
    config:
      isEditable: true
```

Runtime fields like `compId`, `sourceId`, and `targetId` can be injected/overridden by renderer/store.
