import { makeAutoObservable } from 'mobx';
import yaml from 'js-yaml';

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
  data: any;
  config: any;
};

type CompRegistryEntry = {
  compId: string;
  parentId: string | null;
  eventHandler: (event: CompEvent) => Promise<CompEventResult> | CompEventResult;
};

type DocRecord = {
  data: TextDocData;
  config: TextDocConfig;
  compDataById: Record<string, CompData>;
  compIdRoot: string | null;
  compById: Record<string, CompRegistryEntry>;
  compOrder: string[];
};

const createEventId = (length = 12) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

export class DocStore {
  docById: Record<string, DocRecord> = {};

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  ensureDoc(
    docId: string,
    dataInitial: Partial<TextDocData> = {},
    configInitial: Partial<TextDocConfig> = {},
  ) {
    if (this.docById[docId]) {
      return this.docById[docId];
    }

    this.docById[docId] = {
      data: {
        docName: 'text-basic',
        text: '',
        lastEventType: '',
        ...dataInitial,
        docId,
      },
      config: {
        isEditable: true,
        ...configInitial,
      },
      compDataById: {},
      compIdRoot: null,
      compById: {},
      compOrder: [],
    };

    this.syncTextBasicCompData(docId);
    return this.docById[docId];
  }

  getDocData(docId: string) {
    return this.ensureDoc(docId).data;
  }

  getDocConfig(docId: string) {
    return this.ensureDoc(docId).config;
  }

  getDocIds() {
    return Object.keys(this.docById);
  }

  isDocDirty(docId: string) {
    this.ensureDoc(docId);
    return false;
  }

  initDoc(docId: string, dataNext: Partial<TextDocData>) {
    const docRecord = this.ensureDoc(docId);
    docRecord.data = {
      ...docRecord.data,
      ...dataNext,
      docId,
      text: dataNext.text ?? docRecord.data.text,
    };
    this.syncTextBasicCompData(docId);
  }

  updateConfig(docId: string, configNext: Partial<TextDocConfig>) {
    const docRecord = this.ensureDoc(docId);
    docRecord.config = { ...docRecord.config, ...configNext };
    this.syncTextBasicCompData(docId);
  }

  updateText(docId: string, textNext: string) {
    const docRecord = this.ensureDoc(docId);
    if (!docRecord.config.isEditable) {
      return { code: -1, message: 'Editing is disabled.' };
    }
    docRecord.data.text = String(textNext ?? '');
    this.syncTextBasicCompData(docId);
    return { code: 0, message: 'Text updated.' };
  }

  updateCompDataByPatch(docId: string, compId: string, dataPatch: Record<string, any>) {
    const docRecord = this.ensureDoc(docId);
    const compData = docRecord.compDataById[compId];
    if (!compData) {
      return { code: -1, message: `Component data not found. compId=${compId}` };
    }
    compData.data = {
      ...compData.data,
      ...(dataPatch || {}),
    };
    if (String(compData.compName || '') === 'TextBasic' && Object.prototype.hasOwnProperty.call(dataPatch || {}, 'text')) {
      return this.updateText(docId, String(dataPatch?.text ?? ''));
    }
    this.syncTextBasicCompData(docId);
    return { code: 0, message: 'Component data updated.' };
  }

  initCompData(
    docId: string,
    compDataByIdInitial: Record<string, CompData>,
    compIdRoot: string,
  ) {
    const docRecord = this.ensureDoc(docId);
    docRecord.compDataById = { ...compDataByIdInitial };
    docRecord.compIdRoot = compIdRoot;
    this.syncTextBasicCompData(docId);
  }

  getCompData(docId: string, compId: string) {
    const docRecord = this.ensureDoc(docId);
    return docRecord.compDataById[compId] || null;
  }

  getCompDataById(docId: string, compId: string) {
    return this.getCompData(docId, compId);
  }

  getDocYamlRaw(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const compDataByIdCurrent = docRecord.compDataById || {};
    const compDataByIdExtracted: Record<string, CompData> = {};
    const compIdRoot = String(docRecord.compIdRoot || '').trim();
    const stack = compIdRoot ? [compIdRoot] : [];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const compId = String(stack.pop() || '');
      if (!compId || visited.has(compId)) continue;
      visited.add(compId);
      const compData = compDataByIdCurrent[compId];
      if (!compData) continue;
      compDataByIdExtracted[compId] = {
        compId: compData.compId,
        compName: compData.compName,
        childIdList: Array.isArray(compData.childIdList) ? [...compData.childIdList] : [],
        data: { ...(compData.data || {}) },
        config: { ...(compData.config || {}) },
      };
      const childIdList = Array.isArray(compData.childIdList) ? compData.childIdList : [];
      for (let i = childIdList.length - 1; i >= 0; i -= 1) {
        stack.push(String(childIdList[i]));
      }
    }
    const dataYaml = {
      docName: docRecord.data.docName,
      dataDocInitial: {
        text: docRecord.data.text,
      },
      configDocInitial: {
        isEditable: docRecord.config.isEditable,
      },
      compIdRoot: compIdRoot || null,
      compById: compDataByIdExtracted,
    };
    return yaml.dump(dataYaml, { lineWidth: 120, noRefs: true });
  }

  getCompDataRoot(docId: string) {
    const docRecord = this.ensureDoc(docId);
    if (!docRecord.compIdRoot) return null;
    return this.getCompData(docId, docRecord.compIdRoot);
  }

  registerComp(
    docId: string,
    compId: string,
    eventHandler: (event: CompEvent) => Promise<CompEventResult> | CompEventResult,
    options: { parentId?: string | null } = {},
  ) {
    const docRecord = this.ensureDoc(docId);
    if (!docRecord.compOrder.includes(compId)) {
      docRecord.compOrder.push(compId);
    }
    docRecord.compById[compId] = {
      compId,
      parentId: options.parentId ?? null,
      eventHandler,
    };
  }

  unregisterComp(docId: string, compId: string) {
    const docRecord = this.ensureDoc(docId);
    delete docRecord.compById[compId];
    docRecord.compOrder = docRecord.compOrder.filter((id) => id !== compId);
  }

  async sendEventToComp(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const compEntry = docRecord.compById[compId];
    if (!compEntry) {
      return { code: -1, message: `Component not found. compId=${compId}` };
    }

    const targetId = String(event?.targetId || '').trim();
    if (targetId && targetId !== docId) {
      return { code: -1, message: `Target mismatch. targetId=${targetId}, docId=${docId}` };
    }

    const eventNormalized = this.normalizeEvent(docId, event);

    const result = await compEntry.eventHandler(eventNormalized);
    const isHandled = result?.code === 0;
    if (isHandled) {
      return result;
    }

    return this.routeEventDefault(docId, compId, eventNormalized);
  }

  async sendEventToCompDirect(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const compEntry = docRecord.compById[compId];
    if (!compEntry) {
      return { code: -1, message: `Component not found. compId=${compId}` };
    }

    const targetId = String(event?.targetId || '').trim();
    if (targetId && targetId !== docId) {
      return { code: -1, message: `Target mismatch. targetId=${targetId}, docId=${docId}` };
    }

    const eventNormalized = this.normalizeEvent(docId, event);
    return compEntry.eventHandler(eventNormalized);
  }

  async sendEventToParent(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const compEntry = docRecord.compById[compId];
    if (!compEntry) {
      return { code: -1, message: `Component not found. compId=${compId}` };
    }
    const parentId = compEntry.parentId;
    if (!parentId) {
      return { code: -1, message: `No parent component. compId=${compId}` };
    }
    return this.sendEventToComp(docId, parentId, event);
  }

  async receiveEvent(docId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    const dataDoc = docRecord.data;
    const eventNormalized = this.normalizeEvent(docId, event);
    dataDoc.lastEventType = eventNormalized.type;

    if (eventNormalized.type === 'sendEventToTarget') {
      const compIdTarget = String(eventNormalized?.data?.compIdTarget || '').trim();
      const eventTarget = eventNormalized?.data?.event;
      if (!compIdTarget || !eventTarget) {
        return { code: -1, message: 'sendEventToTarget requires compIdTarget and event.' };
      }
      return this.sendEventToCompDirect(docId, compIdTarget, eventTarget);
    }

    if (eventNormalized.type === 'focus') {
      return { code: 0, message: 'Focus event received.' };
    }

    if (eventNormalized.type === 'unfocus') {
      return { code: 0, message: 'Blur event received.' };
    }

    if (eventNormalized.type === 'clickSingle') {
      return { code: 0, message: 'Click event received.' };
    }

    if (eventNormalized.type === 'keyDown') {
      return { code: 0, message: 'Key down event received.' };
    }

    return { code: 0, message: `Ignored event: ${eventNormalized.type}` };
  }

  async onEvent(docId: string, event: CompEvent): Promise<CompEventResult> {
    return this.receiveEvent(docId, event);
  }

  private async routeEventDefault(docId: string, compId: string, event: CompEvent): Promise<CompEventResult> {
    const docRecord = this.ensureDoc(docId);
    if (event.type !== 'unfocus') {
      return { code: -1, message: `Unhandled event. type=${event.type}` };
    }

    const direction = String(event?.data?.direction || '');
    const compIndex = docRecord.compOrder.indexOf(compId);
    if (compIndex === -1) {
      return { code: -1, message: `Component not in order list. compId=${compId}` };
    }

    if (direction === 'left' && compIndex > 0) {
      const compIdPrev = docRecord.compOrder[compIndex - 1];
      return this.sendEventToComp(docId, compIdPrev, {
        type: 'focus',
        sourceId: event.sourceId,
        targetId: docId,
        data: { direction: 'fromRight' },
      });
    }

    if (direction === 'right' && compIndex < docRecord.compOrder.length - 1) {
      const compIdNext = docRecord.compOrder[compIndex + 1];
      return this.sendEventToComp(docId, compIdNext, {
        type: 'focus',
        sourceId: event.sourceId,
        targetId: docId,
        data: { direction: 'fromLeft' },
      });
    }

    if (direction === 'up' || direction === 'down') {
      return this.sendEventToParent(docId, compId, event);
    }

    return { code: -1, message: `No default route for direction=${direction}` };
  }

  private normalizeEvent(docId: string, event: CompEvent): CompEvent {
    return {
      id: String(event?.id || createEventId()),
      type: String(event?.type || ''),
      sourceId: String(event?.sourceId || 'unknown'),
      targetId: docId,
      data: event?.data ?? {},
    };
  }

  private syncTextBasicCompData(docId: string) {
    const docRecord = this.ensureDoc(docId);
    const dataDoc = docRecord.data;
    const configDoc = docRecord.config;
    const compIdList = Object.keys(docRecord.compDataById || {});
    for (const compId of compIdList) {
      const compData = docRecord.compDataById[compId];
      if (String(compData?.compName || '') !== 'TextBasic') {
        continue;
      }
      compData.data = {
        ...compData.data,
        text: dataDoc.text,
        sourceId: compData.compId,
        targetId: docId,
      };
      compData.config = {
        ...compData.config,
        isEditable: configDoc.isEditable,
      };
    }
  }
}

export const createDocStore = (
  dataInitial: Partial<TextDocData> = {},
  configInitial: Partial<TextDocConfig> = {},
) => {
  const store = new DocStore();
  const docId = String(dataInitial.docId || 'mobx-doc');
  store.ensureDoc(docId, dataInitial, configInitial);
  store.initDoc(docId, dataInitial);
  store.updateConfig(docId, configInitial);
  return store;
};
