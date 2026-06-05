import './style.css';
import { saveApiKey, getApiKey } from '@/utils/storage';

// ─── DOM要素の取得 ───
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnToggleVisibility = document.getElementById('btn-toggle-visibility') as HTMLButtonElement;
const iconEye = document.getElementById('icon-eye') as SVGElement;
const iconEyeOff = document.getElementById('icon-eye-off') as SVGElement;
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

  if (!apiKey) {
    showMessage('error', 'APIキーを入力してください。');
    return;
  }


  try {
    await saveApiKey(apiKey);
    showMessage('success', '✓ APIキーを保存しました。');
  } catch (error: any) {
    showMessage('error', `保存に失敗しました: ${error.message}`);
  }
}

// ─── クリア処理 ───
async function onClear(): Promise<void> {
  apiKeyInput.value = '';
  try {
    await saveApiKey('');
    showMessage('success', 'APIキーをクリアしました。');
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
