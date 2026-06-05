import './style.css';
import { hasApiKey } from '@/utils/storage';

// ─── DOM要素の取得 ───
const btnHighlight = document.getElementById('btn-highlight') as HTMLButtonElement;
const btnOptions = document.getElementById('btn-options') as HTMLButtonElement;
const statusIcon = document.getElementById('status-icon') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const resultArea = document.getElementById('result-area') as HTMLDivElement;
const resultMessage = document.getElementById('result-message') as HTMLDivElement;

// ─── ステータス更新 ───
type Status = 'idle' | 'loading' | 'success' | 'error';

function setStatus(status: Status, text: string): void {
  // アイコンクラス更新
  statusIcon.className = `status-icon status-${status}`;
  statusText.textContent = text;
}

// ─── 結果表示 ───
function showResult(success: boolean, message: string): void {
  resultArea.classList.remove('hidden', 'success', 'error');
  resultArea.classList.add(success ? 'success' : 'error');
  resultMessage.textContent = message;
}

// ─── ハイライト実行 ───
async function onHighlightClick(): Promise<void> {
  // APIキーチェック
  const apiKeyExists = await hasApiKey();
  if (!apiKeyExists) {
    setStatus('error', 'APIキー未設定');
    showResult(false, 'APIキーが設定されていません。右下の「設定」からAPIキーを入力してください。');
    return;
  }

  // ローディング状態
  btnHighlight.disabled = true;
  btnHighlight.innerHTML = '<div class="spinner"></div><span>処理中...</span>';
  setStatus('loading', 'Gemini APIに問い合わせ中...');
  resultArea.classList.add('hidden');

  try {
    // バックグラウンドにハイライト実行を要求
    const result = await browser.runtime.sendMessage({ action: 'runHighlight' });

    if (result?.success) {
      setStatus('success', 'ハイライト完了');
      showResult(true, result.message);
    } else {
      setStatus('error', 'エラー発生');
      showResult(false, result?.message || '不明なエラーが発生しました。');
    }
  } catch (error: any) {
    setStatus('error', '通信エラー');
    showResult(
      false,
      'コンテンツスクリプトとの通信に失敗しました。Googleフォームのページをリロードしてから再度お試しください。'
    );
  } finally {
    // ボタンを元に戻す
    btnHighlight.disabled = false;
    btnHighlight.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <span>解答をハイライト</span>
    `;
  }
}

// ─── 設定画面を開く ───
function onOptionsClick(): void {
  browser.runtime.openOptionsPage();
}

// ─── 初期化 ───
async function init(): Promise<void> {
  // フォームページかチェック
  try {
    const response = await browser.runtime.sendMessage({ action: 'checkFormPage' });
    if (!response?.isFormPage) {
      setStatus('idle', 'Googleフォームを開いてください');
      btnHighlight.disabled = true;
      btnHighlight.style.opacity = '0.5';
    } else {
      setStatus('idle', '準備完了 — ボタンを押してください');
    }
  } catch {
    setStatus('idle', '準備完了');
  }

  // APIキーチェック
  const apiKeyExists = await hasApiKey();
  if (!apiKeyExists) {
    setStatus('error', 'APIキー未設定');
    showResult(false, '設定画面からGemini APIキーを登録してください。');
  }
}

// ─── イベントリスナー ───
btnHighlight.addEventListener('click', onHighlightClick);
btnOptions.addEventListener('click', onOptionsClick);

// 初期化実行
init();
