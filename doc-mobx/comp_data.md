# Component Data Format

Component data should be serializable and tree-structured.

## Core Shape

```ts
type CompData = {
  compId: string;
  compName: string;
  childIdList: string[];
  data: object;
  config: object;
}
```

## Field Meaning

- `compId`: unique id (random 0-9 a-z string preferred)
- `compName`: logical component name in doc data (`eventTester`, `textBasic`, etc.)
- `childIdList`: ordered children list
- `data`: component business data
- `config`: component runtime config

## Doc-level Container

```ts
{
  compIdRoot: string,
  compById: Record<string, CompData>
}
```

## Rendering Rule

Keep a mapping from `compName` to React component:

```ts
{
  eventTester: EventTester,
  textBasic: TextBasic
}
```

Renderer walks `compIdRoot` and `childIdList`, picks React component by `compName`, and feeds `data/config`.

With this shape, component tree can be loaded from yaml/json and rendered without semantic ids.
