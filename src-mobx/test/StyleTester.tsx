import React from 'react';
import { makeAutoObservable } from 'mobx';
import { observer } from 'mobx-react-lite';
import {
  BgColorIcon,
  BoldIcon,
  ColorPicker,
  colorPickerModeOptions,
  createColorPickerStore,
  DeletelineIcon,
  ItalicIcon,
  TextColorIcon,
  UnderlineIcon,
} from '@wwf971/react-comp-misc';
import { useDocStoreContext } from '../DocStoreContext';
import type { SelectionState } from '../docStoreTypes';
import { useDocUnfocusBoundary } from '../util/useDocUnfocusBoundary';
import { useDocCompRenderContext } from './DocCompRenderContext';
import './testMobx.css';

// The color picker ships loose prop typings; render it untyped.
const ColorPickerComp: any = ColorPicker;

type StyleTesterProps = {
  data?: {
    compId?: string;
  };
  config?: Record<string, any>;
};

const fontFamilyOptionList = [
  { label: 'Default', value: '' },
  { label: 'Sans-serif', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
];

const fontSizeOptionList = [
  { label: 'Default', value: 0 },
  { label: '12', value: 12 },
  { label: '14', value: 14 },
  { label: '18', value: 18 },
  { label: '24', value: 24 },
];

const styleToggleList = [
  { fieldName: 'isBold', label: 'Bold', Icon: BoldIcon },
  { fieldName: 'isItalic', label: 'Italic', Icon: ItalicIcon },
  { fieldName: 'isUnderline', label: 'Underline', Icon: UnderlineIcon },
  { fieldName: 'isDeleteline', label: 'Deleteline', Icon: DeletelineIcon },
];

// UI state of the style tester. The color picker works on a selection
// snapshot, because picker interactions (sliders, sv box) collapse the live
// DOM selection.
class StyleTesterUiState {
  pickerTarget = ''; // '' | 'colorText' | 'colorBackground'

  pickerStore: any = null;

  selectionSnapshot: SelectionState | null = null;

  dropdownOpen = ''; // '' | 'fontFamily' | 'fontSize'

  messageLast = '';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  openPicker(target: string, colorInitialValue: string, selectionSnapshot: SelectionState | null) {
    this.pickerTarget = target;
    this.pickerStore = createColorPickerStore({ colorInitialValue });
    this.selectionSnapshot = selectionSnapshot;
    this.dropdownOpen = '';
  }

  closePicker() {
    this.pickerTarget = '';
    this.pickerStore = null;
    this.selectionSnapshot = null;
  }

  toggleDropdown(dropdownName: string) {
    this.dropdownOpen = this.dropdownOpen === dropdownName ? '' : dropdownName;
  }

  closeDropdown() {
    this.dropdownOpen = '';
  }

  setMessage(message: string) {
    this.messageLast = message;
  }
}

const StyleTester = observer(({ data = {} }: StyleTesterProps) => {
  const contextDocStore = useDocStoreContext();
  const { renderCompListByParentId } = useDocCompRenderContext();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const docAreaRef = React.useRef<HTMLDivElement | null>(null);
  const uiStateRef = React.useRef<StyleTesterUiState | null>(null);
  if (!uiStateRef.current) {
    uiStateRef.current = new StyleTesterUiState();
  }
  const uiState = uiStateRef.current;
  const compId = String(data.compId || '');
  const store = contextDocStore?.store;
  const docId = String(contextDocStore?.docId || '');

  React.useLayoutEffect(() => {
    if (!store || !docId || !compId) return undefined;
    const rootEl = rootRef.current;
    if (!rootEl) return undefined;
    store.registerCompElement(docId, compId, rootEl);
    return () => {
      store.unregisterCompElement(docId, compId, rootEl);
    };
  }, [store, docId, compId]);

  useDocUnfocusBoundary({
    store,
    docId,
    focusAreaRef: docAreaRef,
    triggerAreaRef: rootRef,
    compIdFocusOnBoundary: compId,
    reason: 'styleTesterDocUnfocus',
  });

  const styleSummary = store && docId ? store.getStyleOfSelection(docId) : null;
  const styleCommon: Record<string, any> = styleSummary?.data?.styleCommon || {};
  const countSegCovered = Number(styleSummary?.data?.countSegCovered || 0);
  const isSelectionStyleable = countSegCovered > 0;

  const applyStylePatch = React.useCallback((
    stylePatch: Record<string, any>,
    selectionOverride: SelectionState | null = null,
  ) => {
    if (!store || !docId) return;
    const result = store.setStyleOnSelection(docId, stylePatch, selectionOverride);
    uiState.setMessage(`[${result.code}] ${result.message}`);
  }, [store, docId, uiState]);

  const cloneSelectionState = React.useCallback((): SelectionState | null => {
    if (!store || !docId) return null;
    const selectionState = store.getInteractionState(docId).selectionState;
    if (
      selectionState.isSelectionActive !== true
      || !selectionState.pointAnchor
      || !selectionState.pointFocus
    ) {
      return null;
    }
    return {
      isSelectionActive: true,
      mode: 'range',
      pointAnchor: { ...selectionState.pointAnchor },
      pointFocus: { ...selectionState.pointFocus },
    };
  }, [store, docId]);

  // Toolbar buttons prevent default on mousedown, so clicking them keeps the
  // DOM text selection (and with it the tracked selection state) alive.
  const preventSelectionLoss = React.useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  // Selection-translate extensions (Google Translate) place their inline icon
  // at the pointer position of a mouseup that happens while text is selected.
  // A toolbar click is a UI action on the selection, not a selection gesture,
  // so its mouseup must not bubble to the document where such extensions
  // listen — otherwise the icon lands on top of the clicked button.
  const stopMouseUpBubble = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const fontFamilyCurrent = String(styleCommon.fontFamily || '');
  const fontFamilyOptionCurrent = fontFamilyOptionList.find((option) => option.value === fontFamilyCurrent);
  const fontFamilyLabel = fontFamilyOptionCurrent
    ? fontFamilyOptionCurrent.label
    : (fontFamilyCurrent ? 'Custom' : 'Default');
  const fontSizeCurrent = Number(styleCommon.fontSize || 0);
  const fontSizeLabel = fontSizeCurrent > 0 ? String(fontSizeCurrent) : 'Default';

  return (
    <div
      ref={rootRef}
      className="style-tester-root"
      data-mobx-comp-id={compId}
      data-mobx-comp-name="StyleTester"
    >
      <div className="style-tester-title-row">
        <div className="style-tester-title">Style Tester</div>
        <div className="style-tester-note">
          {isSelectionStyleable
            ? `selection covers ${countSegCovered} styleable seg(s)`
            : 'select text below to enable the toolbar'}
        </div>
      </div>

      {/* The toolbar acts on the current doc selection; data-mobx-doc-control
          keeps the doc unfocus boundary from clearing the selection when a
          toolbar control is pressed. The container-level mousedown
          preventDefault keeps the DOM selection alive even when the press
          lands on a disabled button (which fires no mouse events itself) or
          between the buttons. */}
      <div
        className="style-toolbar"
        data-mobx-doc-control="true"
        onMouseDown={preventSelectionLoss}
        onMouseUp={stopMouseUpBubble}
      >
        {styleToggleList.map(({ fieldName, label, Icon }) => (
          <button
            key={fieldName}
            type="button"
            className={`style-btn ${styleCommon[fieldName] === true ? 'is-active' : ''}`}
            disabled={!isSelectionStyleable}
            title={label}
            aria-label={label}
            onMouseDown={preventSelectionLoss}
            onClick={() => applyStylePatch({ [fieldName]: !(styleCommon[fieldName] === true) })}
          >
            <Icon size={14} />
          </button>
        ))}

        <button
          type="button"
          className="style-btn"
          disabled={!isSelectionStyleable}
          title="Text color"
          aria-label="Text color"
          onMouseDown={preventSelectionLoss}
          onClick={() => uiState.openPicker(
            'colorText',
            String(styleCommon.colorText || '#000000FF'),
            cloneSelectionState(),
          )}
        >
          <TextColorIcon size={14} colorBar={String(styleCommon.colorText || '#00000033')} />
        </button>
        <button
          type="button"
          className="style-btn"
          disabled={!isSelectionStyleable}
          title="Background color"
          aria-label="Background color"
          onMouseDown={preventSelectionLoss}
          onClick={() => uiState.openPicker(
            'colorBackground',
            String(styleCommon.colorBackground || '#FFFF00FF'),
            cloneSelectionState(),
          )}
        >
          <BgColorIcon size={14} colorBar={String(styleCommon.colorBackground || '#00000033')} />
        </button>

        <div className="style-dropdown-wrap">
          <button
            type="button"
            className="style-btn style-btn-text"
            disabled={!isSelectionStyleable}
            onMouseDown={preventSelectionLoss}
            onClick={() => uiState.toggleDropdown('fontFamily')}
          >
            Font: {fontFamilyLabel}
          </button>
          {uiState.dropdownOpen === 'fontFamily' ? (
            <div className="style-dropdown-list">
              {fontFamilyOptionList.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`style-dropdown-option ${option.value === fontFamilyCurrent ? 'is-active' : ''}`}
                  onMouseDown={preventSelectionLoss}
                  onClick={() => {
                    applyStylePatch({ fontFamily: option.value || null });
                    uiState.closeDropdown();
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="style-dropdown-wrap">
          <button
            type="button"
            className="style-btn style-btn-text"
            disabled={!isSelectionStyleable}
            onMouseDown={preventSelectionLoss}
            onClick={() => uiState.toggleDropdown('fontSize')}
          >
            Size: {fontSizeLabel}
          </button>
          {uiState.dropdownOpen === 'fontSize' ? (
            <div className="style-dropdown-list">
              {fontSizeOptionList.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`style-dropdown-option ${option.value === fontSizeCurrent ? 'is-active' : ''}`}
                  onMouseDown={preventSelectionLoss}
                  onClick={() => {
                    applyStylePatch({ fontSize: option.value || null });
                    uiState.closeDropdown();
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div ref={docAreaRef} className="style-tester-doc-area">
        {compId ? renderCompListByParentId(compId) : null}
      </div>

      <div className="style-tester-message">{uiState.messageLast}</div>

      {uiState.dropdownOpen ? (
        <div
          className="style-dropdown-backdrop"
          data-mobx-doc-control="true"
          onMouseUp={stopMouseUpBubble}
          onMouseDown={(event) => {
            event.preventDefault();
            uiState.closeDropdown();
          }}
        />
      ) : null}

      {uiState.pickerTarget && uiState.pickerStore ? (
        <div
          className="style-picker-backdrop"
          data-mobx-doc-control="true"
          role="presentation"
          onMouseUp={stopMouseUpBubble}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              uiState.closePicker();
            }
          }}
        >
          <div className="style-picker-popup" role="dialog" aria-modal="true" aria-label="Style color picker">
            <ColorPickerComp
              data={{
                modeOptions: colorPickerModeOptions,
                swatchGrid: uiState.pickerStore.swatchGrid,
              }}
              config={{
                modeCurrent: uiState.pickerStore.modeCurrent,
                hue: uiState.pickerStore.hue,
                saturation: uiState.pickerStore.saturation,
                value: uiState.pickerStore.value,
                alpha: uiState.pickerStore.alpha,
                colorCurrentValue: uiState.pickerStore.colorCurrentValue,
                colorCurrentCss: uiState.pickerStore.colorCurrentCss,
                hueColorHex: uiState.pickerStore.hueColorHex,
                isSwatchGapShown: uiState.pickerStore.isSwatchGapShown,
                swatchCellShape: uiState.pickerStore.swatchCellShape,
              }}
              onEvent={uiState.pickerStore.handleEvent}
            />
            <div className="style-picker-actions">
              <button
                type="button"
                className="style-btn style-btn-text"
                onClick={() => {
                  applyStylePatch({ [uiState.pickerTarget]: null }, uiState.selectionSnapshot);
                  uiState.closePicker();
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="style-btn style-btn-text"
                onClick={() => uiState.closePicker()}
              >
                Cancel
              </button>
              <button
                type="button"
                className="style-btn style-btn-text is-primary"
                onClick={() => {
                  applyStylePatch(
                    { [uiState.pickerTarget]: uiState.pickerStore.colorCurrentValue },
                    uiState.selectionSnapshot,
                  );
                  uiState.closePicker();
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default StyleTester;
