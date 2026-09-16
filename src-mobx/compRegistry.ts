// Unified component registry. Document data references a component only by
// compName; this registry maps that reference to a registered component
// definition, so render shells, parse/validation logic, and future authoring
// UI resolve components from one place. See doc-mobx/comp_registry.md.
//
// This is a module-level registry like the segment trait registry
// (docStoreSegTrait.ts) and the data diff handler registry
// (docStoreVersion.ts): a component registers at module load, and any logic
// fetches through the registry API. Registration only makes a component
// fetchable; doc-level logic treats every registered component uniformly.

export type CompRegistryEntry = {
  // Stable unique definition id, namespaced, e.g. 'yamd/TextSeg'. Lets a
  // component be referenced independently of its document-facing name.
  compDefId: string;
  // The name document data uses in CompData.compName, e.g. 'TextSeg'.
  compName: string;
  // Usage types, e.g. ['seg']. One component can declare multiple types and
  // a query on any of them finds it. The type list is open-ended; current
  // types are listed in doc-mobx/comp_registry.md.
  compTypeList: string[];
  // The React component.
  Comp: any;
};

// entryList keeps registration order (used by search results); the two maps
// index the same entry objects by their two reference forms.
const entryList: CompRegistryEntry[] = [];
const entryByCompName: Record<string, CompRegistryEntry> = {};
const entryByCompDefId: Record<string, CompRegistryEntry> = {};

// Register a component definition, or replace an earlier one with the same
// compDefId or compName (replacement also keeps hot reload sane). An entry
// missing id, name, or component is a programming error and throws.
export function registerCompEntry(entryInput: CompRegistryEntry) {
  const entry: CompRegistryEntry = {
    compDefId: String(entryInput?.compDefId || ''),
    compName: String(entryInput?.compName || ''),
    compTypeList: Array.isArray(entryInput?.compTypeList)
      ? entryInput.compTypeList.map((compType) => String(compType || '')).filter(Boolean)
      : [],
    Comp: entryInput?.Comp || null,
  };
  if (!entry.compDefId || !entry.compName || !entry.Comp) {
    throw new Error(`Comp registry entry rejected: compDefId, compName, and Comp are required. compDefId=${entry.compDefId}, compName=${entry.compName}`);
  }
  removeEntry(entryByCompDefId[entry.compDefId]);
  removeEntry(entryByCompName[entry.compName]);
  entryList.push(entry);
  entryByCompDefId[entry.compDefId] = entry;
  entryByCompName[entry.compName] = entry;
}

export function compRegistryGetByName(compName: string): CompRegistryEntry | null {
  return entryByCompName[String(compName || '')] || null;
}

export function compRegistryGetById(compDefId: string): CompRegistryEntry | null {
  return entryByCompDefId[String(compDefId || '')] || null;
}

// Fetch by either reference form: definition id first, then name.
export function compRegistryGetByRef(compRef: string): CompRegistryEntry | null {
  return compRegistryGetById(compRef) || compRegistryGetByName(compRef);
}

// Shorthand for render logic: the React component, or null when the
// reference is not registered.
export function compRegistryGetComp(compRef: string) {
  return compRegistryGetByRef(compRef)?.Comp || null;
}

// All entries declaring the type, in registration order.
export function compRegistrySearchByType(compType: string): CompRegistryEntry[] {
  const compTypeSafe = String(compType || '');
  return entryList.filter((entry) => entry.compTypeList.includes(compTypeSafe));
}

// True when the name is registered and declares the type.
export function compRegistryIsType(compName: string, compType: string) {
  const entry = compRegistryGetByName(compName);
  return entry ? entry.compTypeList.includes(String(compType || '')) : false;
}

function removeEntry(entry: CompRegistryEntry | undefined) {
  if (!entry) return;
  const index = entryList.indexOf(entry);
  if (index !== -1) {
    entryList.splice(index, 1);
  }
  delete entryByCompDefId[entry.compDefId];
  delete entryByCompName[entry.compName];
}
