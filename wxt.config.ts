import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
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
