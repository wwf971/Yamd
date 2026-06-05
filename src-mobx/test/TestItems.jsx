import React from 'react';
import yaml from 'js-yaml';
import { observer } from 'mobx-react-lite';
import { compByNameDefault, renderCompById } from '../docMobx';
import { DocStoreProvider } from '../DocStoreContext';
import { DocStore } from '../docStore';
import DocViewer from '../comp/DocViewer';
import List from '../comp/List';
import Row from '../comp/Row';
import TextSeg from '../comp/TextSeg';
import { selectionStateReadFromDom } from '../event/eventLogicRow';
import EventTester from './EventTester';
import { DocCompRenderProvider } from './DocCompRenderContext';
import TEST_TEXT_BASIC_YAML_RAW from './test-text-basic.yaml?raw';
import TEST_ROW_YAML_RAW from './test-row.yaml?raw';
import TEST_LIST_ROW_EDITABLE_YAML_RAW from './test-list-row-editable.yaml?raw';
import TEST_LIST_ROW_NOT_EDITABLE_YAML_RAW from './test-list-row-not-editable.yaml?raw';
import TEST_LIST_ROW_YAML_RAW from './test-list-row.yaml?raw';
import './testMobx.css';

const compByNameForTest = {
  ...compByNameDefault,
  EventTester,
  DocViewer,
  List,
  Row,
  TextSeg,
};

const TestItemDoc = observer(function TestItemDoc({ yamlRaw }) {
  const docTemplate = React.useMemo(() => parseTestDocTemplate(yamlRaw), [yamlRaw]);
  const docIdRef = React.useRef('');
  const compRefById = React.useRef({});
  const storeRef = React.useRef(null);

  if (!docIdRef.current) {
    docIdRef.current = createRandomId();
  }
  if (!storeRef.current) {
    storeRef.current = new DocStore();
  }

  const storeDocTest = storeRef.current;
  const docId = docIdRef.current;
  const rootElRef = React.useRef(null);
  const isCopyModifierDownRef = React.useRef(false);
  const isApplyingSelectionFromStoreRef = React.useRef(false);
  const parentIdByCompId = React.useMemo(() => buildParentMap(docTemplate.compDataById, docTemplate.compIdRoot), [docTemplate]);

  React.useEffect(() => {
    storeDocTest.ensureDoc(docId, {
      docId,
      docName: docTemplate.docName,
      text: docTemplate.dataInitial.text,
    }, docTemplate.configInitial);
    storeDocTest.initDoc(docId, {
      docId,
      docName: docTemplate.docName,
      text: docTemplate.dataInitial.text,
    });
    storeDocTest.updateConfig(docId, docTemplate.configInitial);
    storeDocTest.initCompData(docId, docTemplate.compDataById, docTemplate.compIdRoot);
  }, [docId, docTemplate, storeDocTest]);

  React.useEffect(() => {
    const compIdList = Object.keys(docTemplate.compDataById);
    for (const compId of compIdList) {
      const parentId = parentIdByCompId[compId] || null;
      storeDocTest.registerComp(
        docId,
        compId,
        async (event) => {
          const compRef = compRefById.current[compId];
          if (!compRef?.dispatchEvent) {
            return { code: -1, message: `Component is not ready. compId=${compId}` };
          }
          return compRef.dispatchEvent(event);
        },
        { parentId },
      );
    }
    return () => {
      for (const compId of compIdList) {
        storeDocTest.unregisterComp(docId, compId);
      }
    };
  }, [docId, docTemplate, parentIdByCompId, storeDocTest]);

  const handleCompEvent = React.useCallback(async (eventInput, compIdSource) => {
    const eventNormalized = {
      type: String(eventInput?.type || ''),
      sourceId: String(eventInput?.sourceId || compIdSource),
      targetId: docId,
      data: eventInput?.data ?? {},
    };
    return storeDocTest.receiveEvent(docId, eventNormalized);
  }, [docId, storeDocTest]);

  const dataDoc = storeDocTest.getDocData(docId);
  const configDoc = storeDocTest.getDocConfig(docId);
  const interactionStateCurrent = storeDocTest.getInteractionState(docId);
  const selectionStateCurrent = interactionStateCurrent.selectionState;
  const compDataByIdCurrent = storeDocTest.getCompDataByIdMap(docId);

  React.useEffect(() => {
    const rootEl = rootElRef.current;
    if (!rootEl) return undefined;

    const handleFocusIn = (event) => {
      const targetEl = event.target instanceof Element ? event.target : null;
      const compEl = targetEl?.closest('[data-mobx-comp-id]');
      const compId = String(compEl?.dataset?.mobxCompId || '');
      storeDocTest.updateElActiveState(docId, compId);
    };

    const handleSelectionChange = () => {
      if (isApplyingSelectionFromStoreRef.current) {
        isApplyingSelectionFromStoreRef.current = false;
        return;
      }
      const selectionState = selectionStateReadFromDom(rootEl);
      const selectionStateCurrent = storeDocTest.getInteractionState(docId).selectionState;
      if (
        isCopyModifierDownRef.current
        && selectionStateCurrent.isSelectionActive === true
        && (!selectionState || selectionState.isSelectionActive !== true)
      ) {
        return;
      }
      if (!selectionState) {
        storeDocTest.clearSelectionState(docId);
        return;
      }
      storeDocTest.updateSelectionState(docId, selectionState);
      if (selectionState.isSelectionActive !== true && selectionState.pointFocus?.compId) {
        storeDocTest.updateFocusState(docId, {
          compIdFocused: selectionState.pointFocus.compId,
          segIdFocused: selectionState.pointFocus.segId,
          offsetFocused: selectionState.pointFocus.offset,
          reasonLast: 'selectionChange',
        });
      }
    };

    const handleCopy = (event) => {
      const textSelected = storeDocTest.getSelectionText(docId);
      if (!textSelected) {
        return;
      }
      event.preventDefault();
      event.clipboardData?.setData('text/plain', textSelected);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Control' || event.key === 'Meta' || event.ctrlKey || event.metaKey) {
        isCopyModifierDownRef.current = true;
      }
    };

    const handleKeyUp = (event) => {
      if (event.key === 'Control' || event.key === 'Meta' || (!event.ctrlKey && !event.metaKey)) {
        window.setTimeout(() => {
          isCopyModifierDownRef.current = false;
        }, 0);
      }
    };

    rootEl.addEventListener('focusin', handleFocusIn);
    rootEl.addEventListener('copy', handleCopy);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      rootEl.removeEventListener('focusin', handleFocusIn);
      rootEl.removeEventListener('copy', handleCopy);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [docId, storeDocTest]);

  React.useLayoutEffect(() => {
    const rootEl = rootElRef.current;
    if (!rootEl) return;
    if (selectionStateCurrent.isSelectionActive !== true) return;
    const pointAnchor = selectionStateCurrent.pointAnchor;
    const pointFocus = selectionStateCurrent.pointFocus;
    if (!pointAnchor || !pointFocus) return;
    const selectionFromDom = selectionStateReadFromDom(rootEl);
    if (isRangeSelectionEqual(selectionFromDom, selectionStateCurrent)) {
      return;
    }
    const isApplied = applyRangeSelectionToDom(rootEl, pointAnchor, pointFocus);
    if (isApplied) {
      isApplyingSelectionFromStoreRef.current = true;
    }
  }, [
    selectionStateCurrent.isSelectionActive,
    selectionStateCurrent.mode,
    selectionStateCurrent.pointAnchor?.compId,
    selectionStateCurrent.pointAnchor?.segId,
    selectionStateCurrent.pointAnchor?.offset,
    selectionStateCurrent.pointFocus?.compId,
    selectionStateCurrent.pointFocus?.segId,
    selectionStateCurrent.pointFocus?.offset,
  ]);

  const renderCompByIdInDoc = React.useCallback((compId) => {
    return renderCompById({
      compId,
      compDataById: compDataByIdCurrent,
      compByName: compByNameForTest,
      setCompRef: (compIdNext, element) => {
        if (element) {
          compRefById.current[compIdNext] = element;
          storeDocTest.registerComp(
            docId,
            compIdNext,
            async (event) => {
              const compRef = compRefById.current[compIdNext];
              if (!compRef?.dispatchEvent) {
                return { code: -1, message: `Component is not ready. compId=${compIdNext}` };
              }
              return compRef.dispatchEvent(event);
            },
            { parentId: storeDocTest.getParentCompId(docId, compIdNext) },
          );
          return;
        }
        delete compRefById.current[compIdNext];
        storeDocTest.unregisterComp(docId, compIdNext);
      },
      onEvent: (event, compData) => handleCompEvent(event, compData.compId),
      onDataChange: (dataPatch, compData) => {
        const compIdTarget = String(dataPatch?.compIdTarget || compData.compId);
        const patchData = dataPatch?.dataPatch || dataPatch;
        return storeDocTest.updateCompDataByPatch(docId, compIdTarget, patchData || {});
      },
      renderUnknown: (compData) => (
        <div key={compData.compId} className="mobx-test-note">
          Unsupported compName: {compData.compName}
        </div>
      ),
    });
  }, [compDataByIdCurrent, docId, handleCompEvent, storeDocTest]);

  return (
    <div className="mobx-test-page" ref={rootElRef} data-mobx-doc-id={docId}>
      <div className="mobx-test-shell">
        <div className="mobx-doc-meta-row">
          <div className="mobx-doc-meta-item">Doc: {docId}</div>
          <div className="mobx-doc-meta-item">Doc Name: {dataDoc.docName}</div>
          <div className="mobx-doc-meta-item">Mode: {configDoc.isEditable ? 'edit' : 'view'}</div>
        </div>
        <DocStoreProvider value={{ store: storeDocTest, docId }}>
          <DocCompRenderProvider
            value={{
              renderCompListByParentId: (parentId) => {
                const compDataParent = compDataByIdCurrent[parentId];
                const childIdList = Array.isArray(compDataParent?.childIdList) ? compDataParent.childIdList : [];
                return childIdList.map((childId) => renderCompByIdInDoc(childId));
              },
              renderCompById: (compId) => renderCompByIdInDoc(compId),
              getCompDataById: (compId) => compDataByIdCurrent[String(compId || '')] || null,
            }}
          >
            {renderCompByIdInDoc(docTemplate.compIdRoot)}
          </DocCompRenderProvider>
        </DocStoreProvider>
      </div>
    </div>
  );
});

const TestTextBasicYaml = () => <TestItemDoc yamlRaw={TEST_TEXT_BASIC_YAML_RAW} />;
const TestRowYaml = () => <TestItemDoc yamlRaw={TEST_ROW_YAML_RAW} />;
const TestListRowEditableYaml = () => <TestItemDoc yamlRaw={TEST_LIST_ROW_EDITABLE_YAML_RAW} />;
const TestListRowNotEditableYaml = () => <TestItemDoc yamlRaw={TEST_LIST_ROW_NOT_EDITABLE_YAML_RAW} />;
const TestListRowYaml = () => <TestItemDoc yamlRaw={TEST_LIST_ROW_YAML_RAW} />;

export const mobxYamlTestItems = [
  {
    key: 'mobx-text-basic',
    label: 'TextBasic Live',
    description: 'YAML viewer + EventTester + TextBasic.',
    Comp: TestTextBasicYaml,
  },
  {
    key: 'mobx-row-basic',
    label: 'Row.tsx',
    description: 'YAML viewer + EventTester + Row with TextSeg children only.',
    Comp: TestRowYaml,
  },
  {
    key: 'mobx-list',
    label: 'List.tsx',
    description: 'List tests for TextSeg editability modes.',
  },
  {
    key: 'mobx-list-text-seg-editable',
    label: 'TextSeg.tsx editable',
    description: 'List with editable TextSeg children only.',
    parentKey: 'mobx-list',
    Comp: TestListRowEditableYaml,
  },
  {
    key: 'mobx-list-text-seg-not-editable',
    label: 'TextSeg.tsx notEditable',
    description: 'List with not-editable TextSeg children only.',
    parentKey: 'mobx-list',
    Comp: TestListRowNotEditableYaml,
  },
  {
    key: 'mobx-list-text-seg-mixed',
    label: 'TextSeg.tsx editable/notEditable',
    description: 'YAML viewer + EventTester + nested List and Row.',
    parentKey: 'mobx-list',
    Comp: TestListRowYaml,
  },
];

export default TestTextBasicYaml;

function parseTestDocTemplate(textYaml) {
  const docTemplateRaw = parseYamlRaw(textYaml);
  const docName = String(docTemplateRaw?.docName || 'mobx-test-doc');
  const dataDocInitial = docTemplateRaw?.dataDocInitial || {};
  const configDocInitial = docTemplateRaw?.configDocInitial || {};
  const compIdRoot = String(docTemplateRaw?.compIdRoot || '');
  const compByIdRaw = docTemplateRaw?.compById || {};

  const compDataById = Object.entries(compByIdRaw).reduce((acc, [compId, compDataRaw]) => {
    const compData = {
      compId: String(compId),
      compName: String(compDataRaw?.compName || ''),
      childIdList: Array.isArray(compDataRaw?.childIdList) ? compDataRaw.childIdList.map((id) => String(id)) : [],
      mainCompId: compDataRaw?.mainCompId ? String(compDataRaw.mainCompId) : undefined,
      data: compDataRaw?.data ?? {},
      config: compDataRaw?.config ?? {},
    };
    acc[compData.compId] = compData;
    return acc;
  }, {});

  return {
    docName,
    dataInitial: {
      text: String(dataDocInitial?.text || findFirstTextBasicValue(compDataById, 'text') || ''),
    },
    configInitial: {
      isEditable: configDocInitial?.isEditable !== false,
    },
    compIdRoot,
    compDataById,
  };
}

function parseYamlRaw(textYaml) {
  const dataYaml = yaml.load(textYaml);
  return (dataYaml && typeof dataYaml === 'object') ? dataYaml : {};
}

function buildParentMap(compDataById, compIdRoot) {
  const parentByCompId = {};
  if (!compIdRoot || !compDataById[compIdRoot]) {
    return parentByCompId;
  }
  const stack = [{ compId: compIdRoot, parentId: null }];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) {
      continue;
    }
    parentByCompId[next.compId] = next.parentId;
    const compData = compDataById[next.compId];
    const childIdList = Array.isArray(compData?.childIdList) ? compData.childIdList : [];
    for (const childId of childIdList) {
      stack.push({ compId: childId, parentId: next.compId });
    }
    const mainCompId = String(compData?.mainCompId || '').trim();
    if (mainCompId) {
      stack.push({ compId: mainCompId, parentId: next.compId });
    }
  }
  return parentByCompId;
}

function findFirstTextBasicValue(compDataById, fieldName) {
  const compDataList = Object.values(compDataById || {});
  const compTextBasic = compDataList.find((compData) => compData.compName === 'TextBasic');
  return compTextBasic?.data?.[fieldName];
}

function createRandomId() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 12; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function applyRangeSelectionToDom(rootEl, pointAnchor, pointFocus) {
  if (!pointAnchor?.segId || !pointFocus?.segId) return false;
  const segAnchor = rootEl.querySelector(`[data-mobx-seg-id="${cssEscape(pointAnchor.segId)}"]`);
  const segFocus = rootEl.querySelector(`[data-mobx-seg-id="${cssEscape(pointFocus.segId)}"]`);
  if (!segAnchor || !segFocus) return false;
  const pointDomAnchor = getDomPointByOffset(segAnchor, Number(pointAnchor.offset || 0));
  const pointDomFocus = getDomPointByOffset(segFocus, Number(pointFocus.offset || 0));
  if (!pointDomAnchor || !pointDomFocus) return false;
  const selection = window.getSelection?.();
  if (!selection) return false;
  if (typeof selection.setBaseAndExtent === 'function') {
    selection.setBaseAndExtent(
      pointDomAnchor.node,
      pointDomAnchor.offset,
      pointDomFocus.node,
      pointDomFocus.offset,
    );
    return true;
  }
  const range = document.createRange();
  const order = compareDomPoint(pointDomAnchor, pointDomFocus);
  const pointStart = order <= 0 ? pointDomAnchor : pointDomFocus;
  const pointEnd = order <= 0 ? pointDomFocus : pointDomAnchor;
  range.setStart(pointStart.node, pointStart.offset);
  range.setEnd(pointEnd.node, pointEnd.offset);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function getDomPointByOffset(segEl, offsetRaw) {
  const offsetTarget = clampOffsetByText(segEl, offsetRaw);
  const walker = document.createTreeWalker(segEl, NodeFilter.SHOW_TEXT);
  let offsetPassed = 0;
  let textNodeLast = null;
  while (true) {
    const nodeCurrent = walker.nextNode();
    if (!nodeCurrent) break;
    textNodeLast = nodeCurrent;
    const textLength = String(nodeCurrent.textContent || '').length;
    if (offsetTarget <= offsetPassed + textLength) {
      return {
        node: nodeCurrent,
        offset: Math.max(0, offsetTarget - offsetPassed),
      };
    }
    offsetPassed += textLength;
  }
  if (textNodeLast) {
    return {
      node: textNodeLast,
      offset: String(textNodeLast.textContent || '').length,
    };
  }
  return {
    node: segEl,
    offset: 0,
  };
}

function clampOffsetByText(segEl, offsetRaw) {
  const textLength = String(segEl?.textContent || '').length;
  return Math.min(textLength, Math.max(0, Number(offsetRaw || 0)));
}

function compareDomPoint(pointA, pointB) {
  if (pointA.node === pointB.node) {
    return pointA.offset - pointB.offset;
  }
  const position = pointA.node.compareDocumentPosition(pointB.node);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }
  return 0;
}

function isRangeSelectionEqual(selectionStateDom, selectionStateStore) {
  if (!selectionStateDom || !selectionStateStore) return false;
  if (selectionStateDom.isSelectionActive !== true || selectionStateStore.isSelectionActive !== true) {
    return false;
  }
  const pointAnchorDom = selectionStateDom.pointAnchor;
  const pointFocusDom = selectionStateDom.pointFocus;
  const pointAnchorStore = selectionStateStore.pointAnchor;
  const pointFocusStore = selectionStateStore.pointFocus;
  if (!pointAnchorDom || !pointFocusDom || !pointAnchorStore || !pointFocusStore) {
    return false;
  }
  return (
    String(pointAnchorDom.compId || '') === String(pointAnchorStore.compId || '')
    && String(pointAnchorDom.segId || '') === String(pointAnchorStore.segId || '')
    && Number(pointAnchorDom.offset || 0) === Number(pointAnchorStore.offset || 0)
    && String(pointFocusDom.compId || '') === String(pointFocusStore.compId || '')
    && String(pointFocusDom.segId || '') === String(pointFocusStore.segId || '')
    && Number(pointFocusDom.offset || 0) === Number(pointFocusStore.offset || 0)
  );
}

function cssEscape(value) {
  const cssWithEscape = window.CSS;
  return cssWithEscape?.escape ? cssWithEscape.escape(String(value || '')) : String(value || '').replace(/"/g, '\\"');
}

