/**
 * Google フォーム スクレイピングモジュール
 * 
 * GoogleフォームのHTML構造から質問文と選択肢を抽出する。
 * Google FormsのDOM構造が変わった場合は、このモジュールのセレクタのみ修正すればよい。
 * 
 * 実際のDOM構造（2026年時点）:
 *   div[role="list"]
 *     ├ div.Qr7Oae.pQK2A[role="listitem"]   ← セクション説明（大問の説明）
 *     │   └ div.KkG9vf[role="heading"]
 *     │       └ div.M7eMe                    ← セクションテキスト
 *     └ div.Qr7Oae[role="listitem"]          ← 質問ブロック（pQK2Aなし）
 *         ├ div[role="heading"] span.M7eMe   ← 質問文テキスト
 *         ├ div[role="radiogroup"]            ← ラジオグループ
 *         │   └ div[role="radio"][data-value] ← 各選択肢
 *         │       └ span.aDTYNe              ← 選択肢テキスト
 *         └ div[role="group"]                 ← チェックボックスグループ
 *             └ div[role="checkbox"][data-value]
 *                 └ span.aDTYNe              ← 選択肢テキスト
 */

// ─── セレクタ定義（保守性のため一箇所に集約）───
const SELECTORS = {
  /** 各質問ブロックのコンテナ（role="list"直下のlistitem） */
  questionContainer: '[role="listitem"]',
  /** セクション説明を持つlistitem（pQK2Aクラス付き） */
  sectionContainer: '[role="listitem"].pQK2A',
  /** セクション説明のheading */
  sectionHeading: '[role="heading"]',
  /** セクションテキストを持つ要素 */
  sectionTextElement: '.M7eMe',
  /** 質問文のheading要素 */
  questionHeading: '[role="heading"]',
  /** 質問文テキストを持つspan */
  questionTextSpan: 'span.M7eMe',
  /** ラジオボタン選択肢 */
  radioChoice: '[role="radio"]',
  /** チェックボックス選択肢 */
  checkboxChoice: '[role="checkbox"]',
  /** 選択肢のテキストを持つspan（aDTYNeクラス） */
  choiceTextSpan: 'span.aDTYNe',
  /** ラジオグループ */
  radioGroup: '[role="radiogroup"]',
  /** チェックボックスグループ */
  checkboxGroup: '[role="group"]',
} as const;

/**
 * 1つの質問を表すデータ構造
 */
export interface FormQuestion {
  /** 質問のインデックス（0始まり） */
  index: number;
  /** 質問文テキスト */
  questionText: string;
  /** 選択肢のテキストリスト */
  choices: string[];
  /** 質問タイプ */
  type: 'radio' | 'checkbox' | 'unknown';
  /** この質問が属するDOM要素 */
  element: Element;
  /** セクション説明（大問の説明文）。存在しない場合はnull */
  sectionDescription: string | null;
}

/**
 * テキストの正規化（前後空白除去、連続空白の統合）
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 質問コンテナ内から選択肢要素（role="radio" or role="checkbox"）を取得し、
 * data-value 属性または内部の span.aDTYNe テキストからテキストを抽出する
 */
function extractChoices(container: Element): string[] {
  const choices: string[] = [];

  // ラジオ・チェックボックスの選択肢要素を取得
  const choiceElements = container.querySelectorAll(
    `${SELECTORS.radioChoice}, ${SELECTORS.checkboxChoice}`
  );

  choiceElements.forEach((el) => {
    // 1. span.aDTYNe からテキストを取得（最も確実）
    const textSpan = el.querySelector(SELECTORS.choiceTextSpan);
    if (textSpan) {
      const text = normalizeText(textSpan.textContent || '');
      if (text.length > 0 && !choices.includes(text)) {
        choices.push(text);
        return;
      }
    }

    // 2. data-value 属性からテキストを取得（フォールバック）
    const dataValue = el.getAttribute('data-value');
    if (dataValue && dataValue.trim().length > 0) {
      const text = normalizeText(dataValue);
      if (!choices.includes(text)) {
        choices.push(text);
        return;
      }
    }

    // 3. aria-label からテキストを取得（最終フォールバック）
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim().length > 0) {
      const text = normalizeText(ariaLabel);
      if (!choices.includes(text)) {
        choices.push(text);
      }
    }
  });

  return choices;
}

/**
 * 質問のタイプを判定する
 */
function detectQuestionType(container: Element): 'radio' | 'checkbox' | 'unknown' {
  if (container.querySelector(SELECTORS.radioGroup) || container.querySelector(SELECTORS.radioChoice)) {
    return 'radio';
  }
  if (container.querySelector(SELECTORS.checkboxGroup) || container.querySelector(SELECTORS.checkboxChoice)) {
    return 'checkbox';
  }
  return 'unknown';
}

/**
 * 質問文テキストを抽出する
 */
function extractQuestionText(container: Element): string {
  // 1. heading要素内の span.M7eMe を探す（最も正確）
  const heading = container.querySelector(SELECTORS.questionHeading);
  if (heading) {
    const textSpan = heading.querySelector(SELECTORS.questionTextSpan);
    if (textSpan) {
      return normalizeText(textSpan.textContent || '');
    }
    // span.M7eMe がなければheading自体のテキスト（ただし必須マーク「*」を除外）
    let text = heading.textContent || '';
    // 末尾の「 *」を除去（必須マーク）
    text = text.replace(/\s*\*\s*$/, '');
    return normalizeText(text);
  }
  return '';
}

/**
 * コンテナがセクション説明（大問の説明）かどうかを判定する
 * セクション説明は pQK2A クラスを持ち、選択肢を含まない listitem
 */
function isSectionDescription(container: Element): boolean {
  // pQK2A クラスを持つか
  if (container.classList.contains('pQK2A')) {
    return true;
  }
  return false;
}

/**
 * セクション説明のテキストを抽出する
 */
function extractSectionText(container: Element): string {
  // M7eMe クラスを持つ要素からテキストを取得
  const textEl = container.querySelector(SELECTORS.sectionTextElement);
  if (textEl) {
    return normalizeText(textEl.textContent || '');
  }
  // フォールバック: heading要素のテキスト
  const heading = container.querySelector(SELECTORS.sectionHeading);
  if (heading) {
    return normalizeText(heading.textContent || '');
  }
  return '';
}

/**
 * 現在のページからすべての質問と選択肢を抽出する
 * セクション説明がある場合は、後続の質問にセクション説明を紐付ける
 */
export function scrapeFormQuestions(): FormQuestion[] {
  const containers = document.querySelectorAll(SELECTORS.questionContainer);
  const questions: FormQuestion[] = [];
  let currentSectionDescription: string | null = null;

  containers.forEach((container) => {
    // セクション説明かどうかをチェック
    if (isSectionDescription(container)) {
      const sectionText = extractSectionText(container);
      if (sectionText.length > 0) {
        currentSectionDescription = sectionText;
      }
      return; // セクション説明自体は質問リストには追加しない
    }

    // 質問文を取得
    const questionText = extractQuestionText(container);

    // 選択肢を取得
    const choices = extractChoices(container);

    // 選択肢がある質問のみを対象（テキスト入力のみの質問や「答えを選択してください」は除外）
    if (questionText.length > 0 && choices.length > 0) {
      questions.push({
        index: questions.length,
        questionText,
        choices,
        type: detectQuestionType(container),
        element: container,
        sectionDescription: currentSectionDescription,
      });
    }
  });

  return questions;
}

/**
 * セレクタ定義をエクスポート（テストやデバッグ用）
 */
export { SELECTORS };
