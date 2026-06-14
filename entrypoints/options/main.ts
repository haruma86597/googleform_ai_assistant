import './style.css';
import {
  saveApiKey,
  getApiKey,
  saveModel,
  getModel,
  saveThinkingLevel,
  getThinkingLevel,
  DEFAULT_MODEL,
  DEFAULT_THINKING_LEVEL
} from '@/utils/storage';

// ─── DOM要素の取得 ───
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const thinkingLevelSelect = document.getElementById('thinking-level-select') as HTMLSelectElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnToggleVisibility = document.getElementById('btn-toggle-visibility') as HTMLButtonElement;
const iconEye = document.getElementById('icon-eye') as HTMLElement;
const iconEyeOff = document.getElementById('icon-eye-off') as HTMLElement;
const saveMessage = document.getElementById('save-message') as HTMLDivElement;

// ─── メッセージ表示 ───
function showMessage(type: 'success' | 'error', text: string): void {
  saveMessage.className = `save-message ${type}`;
  saveMessage.textContent = text;
  saveMessage.classList.remove('hidden');

  // 3秒後に自動非表示
  setTimeout(() => {
    saveMessage.classList.add('hidden');
  }, 3000);
}

// ─── パスワード表示切替 ───
let isPasswordVisible = false;

function toggleVisibility(): void {
  isPasswordVisible = !isPasswordVisible;
  apiKeyInput.type = isPasswordVisible ? 'text' : 'password';
  iconEye.classList.toggle('hidden', isPasswordVisible);
  iconEyeOff.classList.toggle('hidden', !isPasswordVisible);
}

// ─── 保存処理 ───
async function onSave(): Promise<void> {
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const thinkingLevel = thinkingLevelSelect.value;

  if (!apiKey) {
    showMessage('error', 'APIキーを入力してください。');
    return;
  }

  if (!apiKey.startsWith('AIzaSy')) {
    showMessage('error', 'APIキーの形式が正しくありません。「AIzaSy」から始まるキーを入力してください。');
    return;
  }

  try {
    await saveApiKey(apiKey);
    await saveModel(model);
    await saveThinkingLevel(thinkingLevel);
    showMessage('success', '✓ 設定を保存しました。');
  } catch (error: any) {
    showMessage('error', `保存に失敗しました: ${error.message}`);
  }
}

// ─── クリア処理 ───
async function onClear(): Promise<void> {
  apiKeyInput.value = '';
  modelSelect.value = DEFAULT_MODEL;
  thinkingLevelSelect.value = DEFAULT_THINKING_LEVEL;
  try {
    await saveApiKey('');
    await saveModel(DEFAULT_MODEL);
    await saveThinkingLevel(DEFAULT_THINKING_LEVEL);
    showMessage('success', '設定を初期化しました。');
  } catch (error: any) {
    showMessage('error', `クリアに失敗しました: ${error.message}`);
  }
}

// ─── 初期化：保存済みのキーがあれば表示 ───
async function init(): Promise<void> {
  const savedKey = await getApiKey();
  if (savedKey && savedKey.trim().length > 0) {
    apiKeyInput.value = savedKey;
  }

  const savedModel = await getModel();
  modelSelect.value = savedModel;

  const savedThinkingLevel = await getThinkingLevel();
  thinkingLevelSelect.value = savedThinkingLevel;

  // FAQ アコーディオン制御の初期化
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const trigger = item.querySelector('.faq-trigger');
    trigger?.addEventListener('click', () => {
      // 他のすべてのFAQアイテムを閉じる（アコーディオン動作）
      faqItems.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });
      // 対象アイテムの開閉を切り替える
      item.classList.toggle('active');
    });
  });
}

// ─── イベントリスナー ───
btnSave.addEventListener('click', onSave);
btnClear.addEventListener('click', onClear);
btnToggleVisibility.addEventListener('click', toggleVisibility);

// Enter キーで保存
apiKeyInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    onSave();
  }
});

// 初期化実行
init();
