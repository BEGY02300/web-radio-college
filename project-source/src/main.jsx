import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { logger } from './lib/logger.js';
import { REPO, SITE } from './lib/config.js';
import './styles/index.css';

logger.info(`🎙️ ${SITE.title} démarre`, {
  version: '2.0.0',
  repo: `${REPO.owner}/${REPO.repo}@${REPO.branch}`,
  rootPath: REPO.rootPath,
  mode: import.meta.env.MODE,
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
