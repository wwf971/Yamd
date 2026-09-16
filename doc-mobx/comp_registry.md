# Unified Component Registry

Document data references a component only by `compName`. The unified component registry maps that reference to a registered component definition, so render shells, parse/validation logic, and future authoring UI all resolve components from one place, without per-shell name maps or hard-coded component lists.

The registry lives in `src-mobx/compRegistry.ts`. It is a module-level registry, like the segment trait registry (`docStoreSegTrait.ts`) and the data diff handler registry (`docStoreVersion.ts`): a component registers at module load, and any logic fetches through the registry API.

## Registry entry

```ts
type CompRegistryEntry = {
  compDefId: string;       // stable unique definition id, e.g. 'yamd/TextSeg'
  compName: string;        // the name document data uses in CompData.compName
  compTypeList: string[];  // usage types; one component can declare several
  Comp: any;               // the React component
};
```

- `compName` is what document data stores. `compDefId` is a namespaced stable id, so a component can also be referenced independently of its document-facing name.
- `compTypeList` declares how the component can be used. A component with several types is found by a type query on any of them.

Current types and the components registered with them:

| type | meaning | components |
| --- | --- | --- |
| `doc` | document-level view directly under the doc root | `DocViewer`, `TextBasic` |
| `list` | list structure node | `List` |
| `row` | row structure node | `Row` |
| `seg` | segment usable directly inside a Row | `TextSeg`, `TextBlockSeg`, `MathInlineSeg` |
| `test` | test-panel helper, registered by the test shell | `EventTester`, `StyleTester` |

The type list is open-ended: a future component kind introduces a new type string without changing the registry.

## API

```ts
registerCompEntry(entry)               // register, or replace same compDefId/compName
compRegistryGetByName(compName)        // entry by document-facing name
compRegistryGetById(compDefId)         // entry by stable definition id
compRegistryGetByRef(compRef)          // entry by id first, then by name
compRegistryGetComp(compRef)           // shorthand: the React component, or null
compRegistrySearchByType(compType)     // entries declaring the type, in registration order
compRegistryIsType(compName, compType) // true when the name is registered with the type
```

Registration replaces an earlier entry with the same `compDefId` or `compName`, which also keeps hot reload sane. An entry missing id, name, or component is a programming error and throws.

## Registration is not specialness

Standard components (`DocViewer`, `TextBasic`, `List`, `Row`, `TextSeg`, `TextBlockSeg`, `MathInlineSeg`) are registered by the stable entry point `src-mobx/CompCommon.ts` at module load. Registration only makes a component fetchable; doc-level logic treats every registered component uniformly, exactly like a component registered later by an application.

The registry answers one question: which component does a reference resolve to, and how can it be used. Other component capabilities keep living in their own registries:

- structural traits (row-exclusive, clipboard text, paste parsing) in `docStoreSegTrait.ts`
- history diff handlers in `docStoreVersion.ts`
- `DocStore.registerComp()` is unrelated: it registers one mounted component instance of one document for event routing, not a component definition.

## Who uses the registry

- Render shells resolve `CompData.compName` through the registry: the render helpers in `docMobx.tsx` and the test shell in `src-mobx/test/TestItems.jsx`. An unregistered name renders as an "Unsupported compName" note instead of a component.
- The test yaml parse logic validates a document template through the registry: every `compName` must be registered, the root component must carry type `list`, and every direct child of a row-type component must carry type `seg`.
- The comp create mode (typing `/` in a text segment, see `comp_create.md`) fills its creation dropdown with `compRegistrySearchByType('seg')`.

Registering a new component from anywhere (application code, test shell) is one call:

```ts
import { registerCompEntry } from '../CompCommon';

registerCompEntry({
  compDefId: 'yamd-test/ExampleSeg',
  compName: 'ExampleSeg',
  compTypeList: ['seg'],
  Comp: ExampleSeg,
});
```
