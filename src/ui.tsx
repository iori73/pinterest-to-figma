import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageToPlugin, MessageToUI, BoardImportOptions, DEFAULT_OPTIONS, DEFAULT_LAYOUT } from './types';

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

function App() {
  const [boardUrl, setBoardUrl] = useState('');
  const [options, setOptions] = useState<BoardImportOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState<string>('');
  const [importing, setImporting] = useState(false);

  window.onmessage = (event: MessageEvent) => {
    const message = event.data.pluginMessage as MessageToUI;
    if (!message) return;

    if (message.type === 'fetch-progress') {
      setStatus(`Found ${message.found} pins so far...`);
    } else if (message.type === 'import-progress') {
      setStatus(`Placing ${message.completed} / ${message.total}...`);
    } else if (message.type === 'import-complete') {
      setImporting(false);
      const truncatedNote = message.truncated ? ' (board is large — first pins only)' : '';
      setStatus(`Done: ${message.imported} imported, ${message.failed} failed${truncatedNote}.`);
    } else if (message.type === 'error') {
      setImporting(false);
      setStatus(`Error: ${message.message}`);
    }
  };

  const toggle = (key: SettingKey) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImport = () => {
    if (!boardUrl.trim()) {
      setStatus('Paste a Pinterest board link first.');
      return;
    }
    setImporting(true);
    setStatus('Loading board...');
    const message: MessageToPlugin = {
      type: 'import-board',
      boardUrl: boardUrl.trim(),
      options,
      layout: DEFAULT_LAYOUT,
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
      <div className="section">
        <div className="section-title">Insert Pinterest board link</div>
        <div className="url-row">
          <input
            type="text"
            placeholder="https://pinterest.com/username/board/ (any country domain works)"
            value={boardUrl}
            onChange={(e) => setBoardUrl(e.target.value)}
            disabled={importing}
          />
          <button className="btn btn-primary" disabled={importing} onClick={handleImport}>
            Download
          </button>
        </div>
      </div>

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
