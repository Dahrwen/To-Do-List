// Import the core React library
import React from 'react';
// Import ReactDOM client for rendering React components into the HTML DOM
import ReactDOM from 'react-dom/client';
// Import the root App component that houses the entire application
import App from './App.jsx';
// Import the global stylesheet containing all styles, themes, and animations
import './main.css';

// Find the HTML element with id="root" (in index.html) and mount the React application inside it
ReactDOM.createRoot(document.getElementById('root')).render(
  // React.StrictMode helps identify potential problems during development (e.g. deprecated features, side effects)
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
