import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Job Tracker — Browser Automation Agent',
    description: 'Browser automation runtime for job application workflows',
    version: '0.1.0',
    permissions: [
      'activeTab',
      'storage',
      'scripting',
      'tabs',
      'notifications',
    ],
    host_permissions: [
      'http://localhost:3001/*',
      'https://www.linkedin.com/*',
      'https://*/*',
    ],
  },
});
