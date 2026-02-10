import React from 'react';
import HtmlRenderPanel from './htmlRender.jsx';
import './0-cross-el-select.css';

const buildSpanHtml = (text, isEditable, indent = '  ', tagName = 'span') => {
  const attr = isEditable === undefined ? '' : isEditable ? 'contenteditable="true"' : 'contenteditable="false"';
  return text
    .split(' ')
    .map((word) => `${indent}<${tagName} class="test-cross-select-node"${attr ? ` ${attr}` : ''}>${word}</${tagName}>`)
    .join('\n');
};

const buildCaseHtml = (parentEditable, childEditable, text, tagName = 'span') => {
  const parentAttr = parentEditable ? 'contenteditable="true"' : 'contenteditable="false"';
  const spans = buildSpanHtml(text, childEditable, '    ', tagName);
  return [
    `<div class="test-cross-select-parent" ${parentAttr}>`,
    spans,
    `</div>`
  ].join('\n');
};

const CrossElementSelectTest = () => {
  const spanCases = [
    {
      title: 'Case 1: parent contentEditable true, child contentEditable true',
      html: buildCaseHtml(true, true, 'contentEditable=true span elements')
    },
    {
      title: 'Case 2: parent contentEditable true, child contentEditable unset(inherit)',
      html: buildCaseHtml(true, undefined, 'contentEditable unset span elements')
    },
    {
      title: 'Case 3: parent contentEditable true, child contentEditable false',
      html: buildCaseHtml(true, false, 'contentEditable=false span elements')
    },
    {
      title: 'Case 4: parent contentEditable false, child contentEditable true',
      html: buildCaseHtml(false, true, 'contentEditable=true span elements')
    },
    {
      title: 'Case 5: parent contentEditable false, child contentEditable false',
      html: buildCaseHtml(false, false, 'contentEditable=false span elements')
    }
  ];
  const divCases = [
    {
      title: 'Case 6: parent contentEditable true, child contentEditable true',
      html: buildCaseHtml(true, true, 'contentEditable=true div elements', 'div')
    },
    {
      title: 'Case 7: parent contentEditable true, child contentEditable unset(inherit)',
      html: buildCaseHtml(true, undefined, 'contentEditable unset div elements', 'div')
    },
    {
      title: 'Case 8: parent contentEditable true, child contentEditable false',
      html: buildCaseHtml(true, false, 'contentEditable=false div elements', 'div')
    },
    {
      title: 'Case 9: parent contentEditable false, child contentEditable true',
      html: buildCaseHtml(false, true, 'contentEditable=true div elements', 'div')
    },
    {
      title: 'Case 10: parent contentEditable false, child contentEditable false',
      html: buildCaseHtml(false, false, 'contentEditable=false div elements', 'div')
    }
  ];
  const cases = [...spanCases, ...divCases];

  return (
    <div className="test-cross-select" style={{ maxWidth: '1200px' }}>
      <div className="test-cross-select-title">Cross Element Selection</div>
      <div className="test-cross-select-list">
        {cases.map((item) => (
          <HtmlRenderPanel
            key={item.title}
            title={item.title}
            rawHtml={item.html}
            isEditable={false}
          />
        ))}
      </div>
    </div>
  );
};

export default CrossElementSelectTest;
