/**
 * バックグラウンドスクリプト
 * ポップアップからのメッセージをコンテンツスクリプトに中継する
 */

export default defineBackground(() => {
  console.log('[GoogleForm AI Assistant] バックグラウンドスクリプトが起動しました');

  // 拡張機能アイコンクリック時の動作（ポップアップが開く）
  // ポップアップが設定されている場合、アイコンクリックでポップアップが表示される

  // メッセージリレー: ポップアップ → コンテンツスクリプト
  browser.runtime.onMessage.addListener(
    async (message: any, _sender: any, sendResponse: (response: any) => void) => {
      if (message.action === 'runHighlight') {
        try {
          // アクティブなタブを取得
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

          if (!tab?.id) {
            sendResponse({ success: false, message: 'アクティブなタブが見つかりません。' });
            return true;
          }

          // Googleフォームページかチェック
          if (!tab.url?.includes('docs.google.com/forms/')) {
            sendResponse({
              success: false,
              message: 'Googleフォームの回答画面を開いてください。',
            });
            return true;
          }

          // コンテンツスクリプトにハイライト指示を送信
          const result = await browser.tabs.sendMessage(tab.id, { action: 'highlight' });
          sendResponse(result);
        } catch (error: any) {
          sendResponse({
            success: false,
            message: `通信エラー: ${error.message}`,
          });
        }
        return true;
      }

      if (message.action === 'checkFormPage') {
        try {
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id || !tab.url?.includes('docs.google.com/forms/')) {
            sendResponse({ isFormPage: false });
            return true;
          }
          sendResponse({ isFormPage: true });
        } catch {
          sendResponse({ isFormPage: false });
        }
        return true;
      }
    }
  );
});
