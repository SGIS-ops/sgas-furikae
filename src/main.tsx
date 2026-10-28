import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './lib/i18n';
import { loadConfig } from './lib/api';
import './index.css';

// config.json の apiUrl を読んでから描画する（空ならデモ版、あればサーバー版）
loadConfig().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
});
