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
  interactionState: DocInteractionState;
};
