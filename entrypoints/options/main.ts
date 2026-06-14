import './style.css';
import {
  saveApiKey,
  getApiKey,
  saveDeepSeekApiKey,
  getDeepSeekApiKey,
  saveModel,
  getModel,
  saveThinkingLevel,
  getThinkingLevel,
  DEFAULT_MODEL,
  DEFAULT_THINKING_LEVEL
} from '@/utils/storage';

// ─── DOM要素の取得 ───
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const deepseekKeyInput = document.getElementById('deepseek-api-key-input') as HTMLInputElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const thinkingLevelSelect = document.getElementById('thinking-level-select') as HTMLSelectElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnToggleVisibility = document.getElementById('btn-toggle-visibility') as HTMLButtonElement;
const btnToggleDeepseekVisibility = document.getElementById('btn-toggle-deepseek-visibility') as HTMLButtonElement;
const iconEye = document.getElementById('icon-eye') as HTMLElement;
const iconEyeOff = document.getElementById('icon-eye-off') as HTMLElement;
const iconDeepseekEye = document.getElementById('icon-deepseek-eye') as HTMLElement;
const iconDeepseekEyeOff = document.getElementById('icon-deepseek-eye-off') as HTMLElement;
const geminiKeyGroup = document.getElementById('gemini-key-group') as HTMLDivElement;
const deepseekKeyGroup = document.getElementById('deepseek-key-group') as HTMLDivElement;
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
let isDeepseekPasswordVisible = false;

function toggleVisibility(): void {
  isPasswordVisible = !isPasswordVisible;
  apiKeyInput.type = isPasswordVisible ? 'text' : 'password';
  iconEye.classList.toggle('hidden', isPasswordVisible);
  iconEyeOff.classList.toggle('hidden', !isPasswordVisible);
}

function toggleDeepseekVisibility(): void {
  isDeepseekPasswordVisible = !isDeepseekPasswordVisible;
  deepseekKeyInput.type = isDeepseekPasswordVisible ? 'text' : 'password';
  iconDeepseekEye.classList.toggle('hidden', isDeepseekPasswordVisible);
  iconDeepseekEyeOff.classList.toggle('hidden', !isDeepseekPasswordVisible);
}

// ─── APIキー入力フィールドの表示切替 ───
function updateApiKeyVisibility(): void {
  const model = modelSelect.value;
  const isDeepseek = model === 'deepseek-v4-flash';
  geminiKeyGroup.classList.toggle('hidden', isDeepseek);
  deepseekKeyGroup.classList.toggle('hidden', !isDeepseek);
}

// ─── 保存処理 ───
async function onSave(): Promise<void> {
  const apiKey = apiKeyInput.value.trim();
  const deepseekKey = deepseekKeyInput.value.trim();
  const model = modelSelect.value;
  const thinkingLevel = thinkingLevelSelect.value;

  if (model === 'deepseek-v4-flash') {
    if (!deepseekKey) {
      showMessage('error', 'DeepSeek APIキーを入力してください。');
      return;
    }
  } else {
    if (!apiKey) {
      showMessage('error', 'Gemini APIキーを入力してください。');
      return;
    }
  }

  try {
    await saveApiKey(apiKey);
    await saveDeepSeekApiKey(deepseekKey);
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
  deepseekKeyInput.value = '';
  modelSelect.value = DEFAULT_MODEL;
  thinkingLevelSelect.value = DEFAULT_THINKING_LEVEL;
  try {
    await saveApiKey('');
    await saveDeepSeekApiKey('');
    await saveModel(DEFAULT_MODEL);
    await saveThinkingLevel(DEFAULT_THINKING_LEVEL);
    updateApiKeyVisibility();
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

  const savedDeepseekKey = await getDeepSeekApiKey();
  if (savedDeepseekKey && savedDeepseekKey.trim().length > 0) {
    deepseekKeyInput.value = savedDeepseekKey;
  }

  const savedModel = await getModel();
  modelSelect.value = savedModel;

  const savedThinkingLevel = await getThinkingLevel();
  thinkingLevelSelect.value = savedThinkingLevel;

  // 初期表示時のAPIキー入力欄の制御
  updateApiKeyVisibility();

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
btnToggleDeepseekVisibility.addEventListener('click', toggleDeepseekVisibility);
modelSelect.addEventListener('change', updateApiKeyVisibility);

// Enter キーで保存
apiKeyInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    onSave();
  }
});

deepseekKeyInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    onSave();
  }
});

// 初期化実行
init();
