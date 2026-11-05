/**
 * ============================================================================
 * FILE: src/main.jsx
 * ============================================================================
 * PURPOSE:
 *   Application bootstrap and DOM entry point. Connects the React component
 *   tree to the physical HTML document (`index.html`).
 *
 * CORE RESPONSIBILITIES:
 *   1. Imports the root `<App />` controller component and global CSS stylesheet.
 *   2. Locates `<div id="root"></div>` in `index.html`.
 *   3. Creates a React 18 concurrent root and mounts `<App />` inside
 *      `<React.StrictMode>` for development-time safety checks.
 *
 * IMPORTS FROM:
 *   - 'react': Core React library
 *   - 'react-dom/client': React 18 DOM rendering API (`createRoot`)
 *   - './App.jsx': Top-level application state & view controller
 *   - './main.css': Global stylesheet for layout, cards, calendars, and modals
 *
 * EXPORTS TO:
 *   - Loaded directly by `<script type="module" src="/src/main.jsx"></script>` in `index.html`
 * ============================================================================
 */

// Import the core React library
import React from 'react';

// Import ReactDOM client for rendering React components into the browser DOM
import ReactDOM from 'react-dom/client';

// Import the root App component that houses the entire application state and views
import App from './App.jsx';

// Import the global stylesheet containing all styles, themes, and animations
import './main.css';

// Locate the HTML element with id="root" (in index.html) and mount the React application inside it
ReactDOM.createRoot(document.getElementById('root')).render(
  // React.StrictMode runs extra development-only checks for impure renders and unmounted side effects
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
