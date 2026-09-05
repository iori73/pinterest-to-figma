import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MessageToPlugin,
  MessageToUI,
  BoardImportOptions,
  DEFAULT_OPTIONS,
  DEFAULT_LAYOUT,
  DEFAULT_SELECTION,
  ImportSelection,
  BoardMeta,
  MAX_PINS,
} from './types';

type SettingKey = keyof BoardImportOptions;

const SETTINGS: Array<{ key: SettingKey; label: string; description: string }> = [
  {
    key: 'preserveSections',
    label: 'Preserve section structure',
    description: "Group pins into separate frames matching the board's sections",
  },
  {
    key: 'addDominantColor',
    label: 'Add color distribution',
    description: "Add a bar under each image showing its top colors' real share of the picture",
  },
  {
    key: 'importFullSize',
    label: 'Import full-size images',
    description: 'Use the original resolution instead of the default preview size',
  },
  {
    key: 'importCarousel',
    label: 'Carousel images',
    description: 'Import every image in a multi-image pin, not just the first',
  },
  {
    key: 'addSourceLink',
    label: 'Add source link',
    description: 'Attach a clickable hyperlink back to each pin',
  },
];

const COUNT_PRESETS = [20, 50, 100];

function App() {
  const [boardUrl, setBoardUrl] = useState('');
  const [options, setOptions] = useState<BoardImportOptions>(DEFAULT_OPTIONS);
  const [selection, setSelection] = useState<ImportSelection>(DEFAULT_SELECTION);
  const [customActive, setCustomActive] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [boardMeta, setBoardMeta] = useState<BoardMeta | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [importing, setImporting] = useState(false);

  window.onmessage = (event: MessageEvent) => {
    const message = event.data.pluginMessage as MessageToUI;
    if (!message) return;

    if (message.type === 'board-loaded') {
      setLoadingBoard(false);
      setBoardMeta(message.meta);
      setSelection(DEFAULT_SELECTION);
      setCustomActive(false);
      setCustomValue('');
      setStatus('');
    } else if (message.type === 'fetch-progress') {
      setStatus(`Found ${message.found} pins so far...`);
    } else if (message.type === 'import-progress') {
      setStatus(`Placing ${message.completed} / ${message.total}...`);
    } else if (message.type === 'import-complete') {
      setImporting(false);
      const truncatedNote = message.truncated ? ' (board is large — first pins only)' : '';
      setStatus(`Done: ${message.imported} imported, ${message.failed} failed${truncatedNote}.`);
    } else if (message.type === 'error') {
      setLoadingBoard(false);
      setImporting(false);
      setStatus(`Error: ${message.message}`);
    }
  };

  const toggle = (key: SettingKey) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLoadBoard = () => {
    if (!boardUrl.trim()) {
      setStatus('Paste a Pinterest board link first.');
      return;
    }
    setLoadingBoard(true);
    setStatus('Loading board...');
    const message: MessageToPlugin = { type: 'load-board', boardUrl: boardUrl.trim() };
    parent.postMessage({ pluginMessage: message }, '*');
  };

  const handleChangeBoard = () => {
    setBoardMeta(null);
    setStatus('');
  };

  const applyPreset = (n: number | null) => {
    setCustomActive(false);
    setSelection((s) => ({ ...s, count: n }));
  };

  const activateCustom = () => {
    setCustomActive(true);
    const n = parseInt(customValue, 10);
    if (!isNaN(n) && n > 0) {
      setSelection((s) => ({ ...s, count: Math.min(n, MAX_PINS) }));
    }
  };

  const handleCustomChange = (value: string) => {
    setCustomValue(value);
    const n = parseInt(value, 10);
    if (!isNaN(n) && n > 0) {
      setSelection((s) => ({ ...s, count: Math.min(n, MAX_PINS) }));
    }
  };

  const customIsInvalid = customActive && (() => {
    const n = parseInt(customValue, 10);
    return !customValue || isNaN(n) || n <= 0;
  })();

  const handleImport = () => {
    setImporting(true);
    setStatus('Starting import...');
    const message: MessageToPlugin = {
      type: 'import-board',
      boardUrl: boardUrl.trim(),
      options,
      layout: DEFAULT_LAYOUT,
      selection,
    };
    parent.postMessage({ pluginMessage: message }, '*');
  };

  const handleCancel = () => {
    const message: MessageToPlugin = { type: 'cancel-import' };
    parent.postMessage({ pluginMessage: message }, '*');
    setImporting(false);
    setStatus('Cancelled.');
  };

  return (
    <div className="container">
      {!boardMeta ? (
        <div className="section">
          <div className="section-title">Insert Pinterest board link</div>
          <div className="url-row">
            <input
              type="text"
              placeholder="https://pinterest.com/username/board/ (any country domain works)"
              value={boardUrl}
              onChange={(e) => setBoardUrl(e.target.value)}
              disabled={loadingBoard}
            />
            <button className="btn btn-primary" disabled={loadingBoard} onClick={handleLoadBoard}>
              Load board
            </button>
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="board-info">
            <div>
              <div className="board-name">{boardMeta.boardName}</div>
              <div className="board-pin-count">~{boardMeta.pinCount} pins</div>
            </div>
            <button className="btn-link" disabled={importing} onClick={handleChangeBoard}>
              Change board
            </button>
          </div>

          <div className="field-label">How many to import</div>
          <div className="chip-row">
            {COUNT_PRESETS.map((n) => (
              <button
                key={n}
                className={`chip ${!customActive && selection.count === n ? 'chip-active' : ''}`}
                disabled={importing}
                onClick={() => applyPreset(n)}
              >
                {n}
              </button>
            ))}
            <button
              className={`chip ${!customActive && selection.count === null ? 'chip-active' : ''}`}
              disabled={importing}
              onClick={() => applyPreset(null)}
            >
              All (~{boardMeta.pinCount})
            </button>
            <button
              className={`chip ${customActive ? 'chip-active' : ''}`}
              disabled={importing}
              onClick={activateCustom}
            >
              Custom
            </button>
          </div>

          {customActive && (
            <div className="custom-count-row">
              <input
                type="number"
                min={1}
                max={MAX_PINS}
                placeholder={`1–${MAX_PINS}`}
                value={customValue}
                disabled={importing}
                onChange={(e) => handleCustomChange(e.target.value)}
              />
              {customIsInvalid && <span className="custom-count-hint">Enter a number between 1 and {MAX_PINS}</span>}
            </div>
          )}

          {selection.count !== null && (
            <>
              <div className="field-label">Which ones</div>
              <div className="chip-row">
                <button
                  className={`chip ${selection.direction === 'newest' ? 'chip-active' : ''}`}
                  disabled={importing}
                  onClick={() => setSelection((s) => ({ ...s, direction: 'newest' }))}
                >
                  Newest
                </button>
                <button
                  className={`chip ${selection.direction === 'oldest' ? 'chip-active' : ''}`}
                  disabled={importing}
                  onClick={() => setSelection((s) => ({ ...s, direction: 'oldest' }))}
                >
                  Oldest
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="section">
        <div className="section-title-row">
          <span className="section-title">Settings</span>
          <span className="free-badge">FREE</span>
        </div>
        {SETTINGS.map((setting) => (
          <label className="setting-row" key={setting.key}>
            <input
              type="checkbox"
              checked={options[setting.key]}
              disabled={importing}
              onChange={() => toggle(setting.key)}
            />
            <span>
              <span className="setting-label">{setting.label}</span>
              <span className="setting-description">{setting.description}</span>
            </span>
          </label>
        ))}
      </div>

      {boardMeta && !importing && (
        <button className="btn btn-primary btn-full" disabled={customIsInvalid} onClick={handleImport}>
          Import
        </button>
      )}

      {importing && (
        <button className="btn btn-secondary btn-cancel" onClick={handleCancel}>
          Cancel
        </button>
      )}

      {status && <div className="status-bar">{status}</div>}

      <div className="footer-note">No credits, no limits — this build is 100% free.</div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
