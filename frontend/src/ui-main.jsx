import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './ui/styles.css'; // We will create this

const rootElement = document.getElementById('ui-layer');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
