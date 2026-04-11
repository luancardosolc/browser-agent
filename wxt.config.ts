import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  extensionApi: 'chrome',
  srcDir: 'src',
  vite: () => ({ plugins: [react()] }),
  manifest: {
    name: 'Browser Agent',
    description: 'Generic browser automation runtime — configurable backend, plugin system, form intelligence.',
    version: '0.1.0',
    permissions: [
      'activeTab',
      'storage',
      'scripting',
      'tabs',
      'notifications',
      'contextMenus',
    ],
    host_permissions: [
      'http://localhost/*',
      'https://*/*',
    ],
  },
});
