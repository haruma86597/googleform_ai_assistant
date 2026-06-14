import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'GoogleForm AI Assistant',
    description: 'Googleフォームの回答をGemini AIで解析し、正解の選択肢をハイライト表示するChrome拡張機能',
    version: '1.0.2',
    permissions: [
      'activeTab',
      'storage',
    ],
    host_permissions: [
      'https://docs.google.com/forms/*',
      'https://generativelanguage.googleapis.com/*',
    ],
  },
});
