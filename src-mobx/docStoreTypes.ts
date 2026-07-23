export type CompEvent = {
  id?: string;
  type: string;
  sourceId: string;
  targetId: string;
  data: any;
};

export type CompEventResult = {
  code: number;
  message: string;
  data?: any;
};

export type CompFocusTarget = {
  compId: string;
  point?: any;
  direction?: string;
};

export type CompEditResult = {
  op: 'replaceSelf' | 'replaceRange' | 'deleteSelf' | 'noop';
  compIdListOriginal: string[];
  compListNext: CompData[];
  focus?: CompFocusTarget;
};

export type DocEditState = {
  isApplying: boolean;
  versionEdit: number;
  typeEditLast: string;
};

export type DocEditOptions = {
  typeEdit: string;
  groupKey?: string;
  timeGroupMs?: number;
};

export type CompFieldChange = {
  fieldName: string;
  isFieldRemoved?: boolean;
  value?: any;
};

export type CompVersionDiff = {
  dataDiff?: any;
  fieldChangeListData?: CompFieldChange[];
  fieldChangeListConfig?: CompFieldChange[];
  childIdList?: string[];
  mainCompId?: string;
};

export type CompVersion = {
  versionId: string;
  compId: string;
  compName: string;
  kind: 'full' | 'diff';
  timeCreated: number;
  lengthChain: number;
  compData?: CompData;
  versionIdBase?: string;
  diff?: CompVersionDiff;
};

export type CompVersionStore = {
  versionById: Record<string, CompVersion>;
  versionIdListByCompId: Record<string, string[]>;
};

export type CompDataDiffHandler = {
  createDataDiff: (dataBefore: any, dataAfter: any) => any | null;
  applyDataDiff: (dataBase: any, dataDiff: any) => any;
};

export type CompChange = {
  compId: string;
  versionBefore: string;
  versionAfter: string;
};

export type DocChange = {
  compIdRootBefore?: string | null;
  compIdRootAfter?: string | null;
  textDocBefore?: string;
  textDocAfter?: string;
};

export type DocEditChangeSet = {
  compChangeList: CompChange[];
  docChange: DocChange | null;
};

export type DocEditKind = 'compData' | 'structure';

export type DocHistoryNode = {
  nodeId: string;
  nodeIdParent: string | null;
  nodeIdChildList: string[];
  typeEdit: string;
  kindEdit: DocEditKind;
  timeCreated: number;
  changeSet: DocEditChangeSet;
  focusBefore?: CompFocusTarget;
  focusAfter?: CompFocusTarget;
  groupKey?: string;
};

export type DocHistoryState = {
  nodeById: Record<string, DocHistoryNode>;
  nodeIdRoot: string;
  nodeIdCurrent: string;
  nodeIdRedoPreferredByNodeId: Record<string, string>;
  versionStore: CompVersionStore;
  isApplying: boolean;
  isUndoAvailable: boolean;
  isRedoAvailable: boolean;
  versionHistory: number;
  limitNode: number;
};

export type TextDocData = {
  docId: string;
  docName: string;
  text: string;
  lastEventType: string;
};

export type TextDocConfig = {
  isEditable: boolean;
};

export type CompData = {
  compId: string;
  compName: string;
  versionId?: string;
  childIdList: string[];
  mainCompId?: string;
  data: any;
  config: any;
};

export type FocusState = {
  compIdFocused: string;
  segIdFocused: string;
  offsetFocused: number;
  reasonLast: string;
};

export type ElActiveState = {
  compIdElActive: string;
  versionElActive: number;
};

export type SelectionTrackPoint = {
  compId: string;
  segId: string;
  offset: number;
};

export type SelectionState = {
  isSelectionActive: boolean;
  mode: 'caret' | 'range';
  pointAnchor: SelectionTrackPoint | null;
  pointFocus: SelectionTrackPoint | null;
};

export type CompRuntimeState = {
  isFocusedLogical: boolean;
  isElActive: boolean;
  isFocusWithin: boolean;
  isSelectionWithin: boolean;
};

export type DragDropKind = 'none' | 'segment' | 'outline' | 'mainRow';

export type DragItemKind = 'segment' | 'row' | 'list';

export type DragDropInfo = {
  kind: DragDropKind;
  targetId: string;
  drop: any;
};

export type DragItemRuntimeState = {
  isDragged: boolean;
  isDragHovered: boolean;
  isDropAllowed: boolean;
  isInsertBefore: boolean;
  isInsertAfter: boolean;
  isInsertInside: boolean;
  isInsertMain: boolean;
  isInsertBeforeSibling: boolean;
  isInsertSegmentBefore: boolean;
  isInsertSegmentAfter: boolean;
};

export type DragState = {
  isDragging: boolean;
  itemIdDragged: string;
  itemKindDragged: DragItemKind | '';
  compIdDragged: string;
  dropInfoActive: DragDropInfo | null;
  runtimeStateByItemId: Record<string, DragItemRuntimeState>;
  versionDrag: number;
  isFocusClickSuppressed: boolean;
};

export type CompBulletPosState = {
  isBulletMeasureEnabled?: boolean;
  counterBulletMeasureReq: number;
  counterBulletMeasureDone: number;
  compIdRequester: string;
  compIdBasis: string;
  compIdProvider: string;
  posYBulletPreferred: number | null;
  messageBulletMeasure: string;
};

export type DocInteractionState = {
  focusState: FocusState;
  elActiveState: ElActiveState;
  selectionState: SelectionState;
  dragState: DragState;
  runtimeStateByCompId: Record<string, CompRuntimeState>;
  bulletPosStateByCompId: Record<string, CompBulletPosState>;
};

export type CompRegistryEntry = {
  compId: string;
  parentId: string | null;
  eventHandler: (event: CompEvent) => Promise<CompEventResult> | CompEventResult;
};

export type DocRecord = {
  data: TextDocData;
  config: TextDocConfig;
  compDataById: Record<string, CompData>;
  compIdRoot: string | null;
  compById: Record<string, CompRegistryEntry>;
  compOrder: string[];
  editState: DocEditState;
  historyState: DocHistoryState;
  interactionState: DocInteractionState;
};
