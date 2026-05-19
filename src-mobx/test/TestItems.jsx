import React from 'react';
import yaml from 'js-yaml';
import { compByNameDefault, renderCompById } from '../docMobx';
import { DocStoreProvider } from '../DocStoreContext';
import { DocStore } from '../docStore';
import DocViewer from '../comp/DocViewer';
import List from '../comp/List';
import Row from '../comp/Row';
import TextSeg from '../comp/TextSeg';
import EventTester from './EventTester';
import { DocCompRenderProvider } from './DocCompRenderContext';
import TEST_TEXT_BASIC_YAML_RAW from './test-text-basic.yaml?raw';
import TEST_ROW_YAML_RAW from './test-row.yaml?raw';
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

function TestItemDoc({ yamlRaw }) {
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

  const renderCompByIdInDoc = React.useCallback((compId) => {
    return renderCompById({
      compId,
      compDataById: docTemplate.compDataById,
      compByName: compByNameForTest,
      setCompRef: (compIdNext, element) => {
        if (element) {
          compRefById.current[compIdNext] = element;
          return;
        }
        delete compRefById.current[compIdNext];
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
  }, [docTemplate.compDataById, handleCompEvent]);

  return (
    <div className="mobx-test-page">
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
                const compDataParent = docTemplate.compDataById[parentId];
                const childIdList = Array.isArray(compDataParent?.childIdList) ? compDataParent.childIdList : [];
                return childIdList.map((childId) => renderCompByIdInDoc(childId));
              },
              renderCompById: (compId) => renderCompByIdInDoc(compId),
              getCompDataById: (compId) => docTemplate.compDataById[String(compId || '')] || null,
            }}
          >
            {renderCompByIdInDoc(docTemplate.compIdRoot)}
          </DocCompRenderProvider>
        </DocStoreProvider>
      </div>
    </div>
  );
}

const TestTextBasicYaml = () => <TestItemDoc yamlRaw={TEST_TEXT_BASIC_YAML_RAW} />;
const TestRowYaml = () => <TestItemDoc yamlRaw={TEST_ROW_YAML_RAW} />;
const TestListRowYaml = () => <TestItemDoc yamlRaw={TEST_LIST_ROW_YAML_RAW} />;

export const mobxYamlTestItems = [
  {
    key: 'mobx-text-basic',
    label: 'MobX TextBasic Live',
    description: 'YAML viewer + EventTester + TextBasic.',
    Comp: TestTextBasicYaml,
  },
  {
    key: 'mobx-row-basic',
    label: 'MobX Row Only Segments',
    description: 'YAML viewer + EventTester + Row with TextSeg children only.',
    Comp: TestRowYaml,
  },
  {
    key: 'mobx-list-row-nested',
    label: 'MobX List + Row Nested',
    description: 'YAML viewer + EventTester + nested List and Row.',
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
