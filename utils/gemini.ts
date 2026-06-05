/**
 * Gemini API 連携モジュール
 * Google GenAI SDK を使用して、質問文と選択肢から正解を問い合わせる
 */

import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

/**
 * 1つの質問に対するAPI入力
 */
export interface QuestionInput {
  questionText: string;
  choices: string[];
  type: 'radio' | 'checkbox' | 'unknown';
}

/**
 * APIレスポンスの正解データ
 */
export interface AnswerResult {
  questionIndex: number;
  questionText: string;
  correctChoices: string[];
}

/**
 * 複数の質問を一括でプロンプトに変換する
 */
function buildPrompt(questions: QuestionInput[]): string {
  let prompt = '';

  questions.forEach((q, i) => {
    prompt += `【問題 ${i + 1}】\n`;
    prompt += `質問: ${q.questionText}\n`;
    prompt += `選択肢:\n`;
    q.choices.forEach((c, j) => {
      prompt += `  ${String.fromCharCode(65 + j)}. ${c}\n`;
    });
    if (q.type === 'checkbox') {
      prompt += `（※複数選択可）\n`;
    }
    prompt += '\n';
  });

  return prompt;
}

/**
 * システム指示を構築する
 */
function buildSystemInstruction(): string {
  return `あなたは試験問題の正解を判定するアシスタントです。
以下のルールを厳守してください：

1. 解説や説明は一切不要です。
2. 各問題に対して、正解の選択肢の「テキスト」のみを返してください。
3. 選択肢のテキストは、入力された選択肢と完全に一致する文字列で返してください。記号（A. B.等）は含めないでください。
4. 回答は以下のJSON形式で返してください：
[
  { "questionIndex": 0, "answers": ["正解の選択肢テキスト"] },
  { "questionIndex": 1, "answers": ["正解1", "正解2"] }
]
5. 複数選択問題の場合は、正解と思われる選択肢をすべて配列に含めてください。
6. JSON以外のテキストは一切出力しないでください。`;
}

/**
 * レスポンステキストからJSON配列をパースする
 */
function parseAnswers(responseText: string, questions: QuestionInput[]): AnswerResult[] {
  // Markdownのコードブロックを除去
  let cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as Array<{ questionIndex: number; answers: string[] }>;

    return parsed.map((item) => ({
      questionIndex: item.questionIndex,
      questionText: questions[item.questionIndex]?.questionText || '',
      correctChoices: item.answers,
    }));
  } catch {
    // JSONパース失敗時は、テキストベースでフォールバック解析
    console.warn('JSON解析に失敗、テキストベースでフォールバック解析を試みます:', cleaned);
    return fallbackParse(cleaned, questions);
  }
}

/**
 * テキストベースのフォールバック解析
 */
function fallbackParse(text: string, questions: QuestionInput[]): AnswerResult[] {
  const results: AnswerResult[] = [];

  questions.forEach((q, i) => {
    const matchingChoices = q.choices.filter((choice) => text.includes(choice));
    if (matchingChoices.length > 0) {
      results.push({
        questionIndex: i,
        questionText: q.questionText,
        correctChoices: matchingChoices,
      });
    }
  });

  return results;
}

/**
 * Gemini APIに質問を送信し、正解を取得する（Google GenAI SDK使用）
 * 
 * @param apiKey - Gemini APIキー
 * @param questions - 質問リスト
 * @param model - 使用するモデル名（デフォルト: gemini-3.1-flash-lite）
 * @returns 正解結果の配列
 */
export async function fetchAnswers(
  apiKey: string,
  questions: QuestionInput[],
  model: string = DEFAULT_MODEL
): Promise<AnswerResult[]> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(questions);
  const systemInstruction = buildSystemInstruction();

  try {
    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction,
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('APIからの応答が空です');
    }

    return parseAnswers(responseText, questions);
  } catch (error: any) {
    // SDK のエラーをわかりやすいメッセージに変換
    if (error.message?.includes('API key')) {
      throw new Error('APIキーが無効です。設定画面で正しいキーを入力してください。');
    }
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      throw new Error('APIの利用制限に達しました。しばらく待ってから再試行してください。');
    }
    if (error.message?.includes('model')) {
      throw new Error(`モデル "${model}" が利用できません: ${error.message}`);
    }
    throw new Error(`Gemini API エラー: ${error.message}`);
  }
}
