/**
 * コンテンツスクリプト
 * Googleフォームの回答画面（viewformを含むURL）でのみ動作する。
 * バックグラウンドからのメッセージを受信し、スクレイピング→API→ハイライトの処理を行う。
 */

import { scrapeFormQuestions, type FormQuestion } from '@/utils/scraper';
import { fetchAnswers, type AnswerResult, type QuestionInput } from '@/utils/gemini';
import { getApiKey, getModel, getThinkingLevel } from '@/utils/storage';

// ─── ハイライト用CSSクラス名 ───
const HIGHLIGHT_CLASS = 'gform-ai-highlight';
const PROCESSING_CLASS = 'gform-ai-processing';

// ─── ハイライト用スタイルを注入 ───
function injectStyles(): void {
  if (document.getElementById('gform-ai-styles')) return;

  const style = document.createElement('style');
  style.id = 'gform-ai-styles';
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      font-weight: bold !important;
    }

    .${PROCESSING_CLASS} {
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

// ─── 既存のハイライトをクリアする ───
function clearHighlights(): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS);
  });
}

/**
 * テキストを正規化して比較用にする
 */
function normalizeForComparison(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * 正解の選択肢をハイライトする
 */
function highlightAnswers(questions: FormQuestion[], answers: AnswerResult[]): number {
  let selectCount = 0;

  answers.forEach((answer) => {
    const question = questions[answer.questionIndex];
    if (!question) return;

    const container = question.element;

    // 選択肢のDOM要素を取得（role="radio" or role="checkbox"）
    const choiceElements = container.querySelectorAll(
      '[role="radio"], [role="checkbox"]'
    );

    choiceElements.forEach((choiceEl) => {
      // 選択肢のテキストを取得する（優先順: span.aDTYNe → data-value → aria-label）
      let choiceText = '';
      const textSpan = choiceEl.querySelector('span.aDTYNe');
      if (textSpan) {
        choiceText = normalizeForComparison(textSpan.textContent || '');
      } else {
        choiceText = normalizeForComparison(
          choiceEl.getAttribute('data-value') || choiceEl.getAttribute('aria-label') || ''
        );
      }

      if (!choiceText) return;

      // 正解リストと照合（完全一致を優先）
      const isCorrect = answer.correctChoices.some((correctText) => {
        const normalizedCorrect = normalizeForComparison(correctText);
        return choiceText === normalizedCorrect;
      });

      const isChecked = choiceEl.getAttribute('aria-checked') === 'true';

      if (isCorrect) {
        // 正解の選択肢にチェックが入っていなければクリックして選択する
        if (!isChecked) {
          (choiceEl as HTMLElement).click();
        }
        selectCount++;
      } else {
        // 不正解のチェックボックスにチェックが入っていたらクリックして外す
        if (isChecked && choiceEl.getAttribute('role') === 'checkbox') {
          (choiceEl as HTMLElement).click();
        }
      }
    });
  });

  return selectCount;
}

/**
 * メイン処理: スクレイピング→API問い合わせ→ハイライト
 */
async function runHighlightProcess(): Promise<{
  success: boolean;
  message: string;
  questionCount: number;
  highlightCount: number;
}> {
  // 設定の取得
  const apiKey = await getApiKey();
  const model = await getModel();
  const thinkingLevel = await getThinkingLevel();
  if (!apiKey) {
    return {
      success: false,
      message: 'APIキーが設定されていません。オプション画面から設定してください。',
      questionCount: 0,
      highlightCount: 0,
    };
  }

  // スタイル注入
  injectStyles();

  // 既存のハイライトをクリア
  clearHighlights();

  // 質問のスクレイピング
  const questions = scrapeFormQuestions();
  if (questions.length === 0) {
    return {
      success: false,
      message: '質問が見つかりませんでした。Googleフォームの回答画面であることを確認してください。',
      questionCount: 0,
      highlightCount: 0,
    };
  }

  // API入力を構築
  const apiInputs: QuestionInput[] = questions.map((q) => ({
    questionText: q.questionText,
    choices: q.choices,
    type: q.type,
    sectionDescription: q.sectionDescription,
  }));

  try {
    // 処理中表示
    document.body.classList.add(PROCESSING_CLASS);

    // Gemini API呼び出し
    const answers = await fetchAnswers(apiKey, apiInputs, model, thinkingLevel);

    // ハイライト適用
    const highlightCount = highlightAnswers(questions, answers);

    return {
      success: true,
      message: `${questions.length}問中、${highlightCount}個の選択肢をハイライトしました。`,
      questionCount: questions.length,
      highlightCount,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `エラーが発生しました: ${error.message}`,
      questionCount: questions.length,
      highlightCount: 0,
    };
  } finally {
    document.body.classList.remove(PROCESSING_CLASS);
  }
}

// ─── Content Script 定義 ───
export default defineContentScript({
  matches: ['*://docs.google.com/forms/*'],
  main() {
    console.log('[GoogleForm AI Assistant] コンテンツスクリプトが読み込まれました');

    // バックグラウンドからのメッセージを受信
    browser.runtime.onMessage.addListener(
      (message: any, _sender: any, sendResponse: (response: any) => void) => {
        if (message.action === 'highlight') {
          runHighlightProcess().then((result) => {
            sendResponse(result);
          });
          return true; // 非同期レスポンスを有効にする
        }

        if (message.action === 'checkStatus') {
          const isFormPage = window.location.href.includes('viewform');
          sendResponse({ isFormPage });
          return true;
        }
      }
    );

    // Ctrl + G ショートカットキーの監視
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const isCtrlG = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g';
      if (!isCtrlG) return;

      // 入力中の場合は実行しない
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        const isEditable = activeEl.getAttribute('contenteditable') === 'true';
        if (tagName === 'input' || tagName === 'textarea' || isEditable) {
          return;
        }
      }

      e.preventDefault();
      console.log('[GoogleForm AI Assistant] Ctrl+G ショートカットキーが検出されました');
      runHighlightProcess();
    });
  },
});
