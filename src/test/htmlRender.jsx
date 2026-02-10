import React, { useMemo, useState } from 'react';
import { PanelDual } from '@wwf971/react-comp-misc';
import './htmlRender.css';

const validateHtml = (rawHtml) => {
  const parser = new DOMParser();
  const wrapped = `<root>${rawHtml}</root>`;
  const doc = parser.parseFromString(wrapped, 'text/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    return errorNode.textContent || 'Invalid HTML';
  }
  return '';
};

const HtmlRenderPanel = ({
  title,
  rawHtml,
  isEditable = false,
  leftLabel = 'HTML Raw Text',
  rightLabel = 'Rendered'
}) => {
  const [text, setText] = useState(rawHtml || '');
  const errorMessage = useMemo(() => validateHtml(text), [text]);

  return (
    <div className="html-render-panel">
      {title ? <div className="html-render-title">{title}</div> : null}
      <div className="html-render-body">
        <PanelDual orientation="vertical" initialRatio={0.5} fixedDivider={true}>
          <div className="html-render-left">
            <div className="html-render-label">{leftLabel}</div>
            <textarea
              className="html-render-textarea"
              value={text}
              readOnly={!isEditable}
              onChange={isEditable ? (event) => setText(event.target.value) : undefined}
            />
          </div>
          <div className="html-render-right">
            <div className="html-render-label">{rightLabel}</div>
            {errorMessage ? (
              <div className="html-render-error">{errorMessage}</div>
            ) : (
              <div
                className="html-render-output"
                dangerouslySetInnerHTML={{ __html: text }}
              />
            )}
          </div>
        </PanelDual>
      </div>
    </div>
  );
};

export default HtmlRenderPanel;
