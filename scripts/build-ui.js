const fs = require('fs');
const path = require('path');

// Read the bundled JS
const jsContent = fs.readFileSync(path.join(__dirname, '../dist/ui.js'), 'utf8');

// Create HTML with inlined JS
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      color: #333;
      background: #fff;
    }

    .container {
      padding: 12px;
    }

    .header {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .section {
      margin-bottom: 16px;
    }

    .section-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }

    .section-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .section-title-row .section-title {
      margin-bottom: 0;
    }

    .free-badge {
      background: #e6f9ee;
      color: #12875e;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 2px 6px;
      border-radius: 10px;
    }

    .url-row {
      display: flex;
      gap: 8px;
    }

    input[type="text"] {
      flex: 1;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 11px;
      font-family: inherit;
    }

    input[type="text"]:focus {
      outline: none;
      border-color: #18A0FB;
    }

    input[type="text"]:disabled {
      background: #f5f5f5;
      color: #999;
    }

    .setting-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
    }

    .setting-row:last-child {
      border-bottom: none;
    }

    .setting-row input[type="checkbox"] {
      margin-top: 2px;
    }

    .setting-label {
      display: block;
      font-weight: 600;
      color: #333;
    }

    .setting-description {
      display: block;
      color: #888;
      font-size: 10px;
      margin-top: 2px;
    }

    .footer-note {
      text-align: center;
      color: #999;
      font-size: 10px;
      margin-top: 16px;
    }

    .btn {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .btn-primary {
      background: #18A0FB;
      color: white;
    }

    .btn-primary:hover {
      background: #0d8de8;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f0f0f0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #e0e0e0;
    }

    .status-bar {
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 10px;
      color: #666;
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${jsContent}</script>
</body>
</html>`;

// Write the final HTML
fs.writeFileSync(path.join(__dirname, '../dist/ui.html'), html);
console.log('UI built successfully!');
