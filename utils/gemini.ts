/**
 * Gemini API 連携モジュール
 * Google GenAI SDK を使用して、質問文と選択肢から正解を問い合わせる
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const DEFAULT_MODEL = 'gemini-3.5-flash';

/**
 * 1つの質問に対するAPI入力
 */
export interface QuestionInput {
  questionText: string;
  choices: string[];
  type: 'radio' | 'checkbox' | 'unknown';
  sectionDescription?: string | null;
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
    if (q.sectionDescription) {
      prompt += `説明: ${q.sectionDescription}\n`;
    }
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
 * APIレスポンス用のJSONスキーマ定義（構造化出力用）
 */
const ANSWER_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  description: '各問題に対する正解の選択肢リスト',
  items: {
    type: 'OBJECT',
    properties: {
      questionIndex: {
        type: 'INTEGER',
        description: '質問のインデックス（0始まり）'
      },
      answers: {
        type: 'ARRAY',
        items: {
          type: 'STRING'
        },
        description: '正解の選択肢テキストの配列。複数選択問題の場合は複数、単一選択の場合は1つ含める。'
      }
    },
    required: ['questionIndex', 'answers']
  }
};

/**
 * システム指示を構築する
 */
function buildSystemInstruction(): string {
  return `あなたは試験問題の正解を判定するアシスタントです。
以下のルールを厳守してください：

1. 各問題に対して、正解の選択肢の「テキスト」のみを選択してください。
2. 選択肢のテキストは、入力された選択肢と完全に一致する文字列で指定してください。記号（A. B.等）は含めないでください。
3. 複数選択問題の場合は、正解と思われる選択肢をすべて配列に含めてください。`;
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
  model: string = DEFAULT_MODEL,
  thinkingLevel?: string
): Promise<AnswerResult[]> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(questions);
  const systemInstruction = buildSystemInstruction();

  const config: any = {
    systemInstruction,
    temperature: 0.1,
    topP: 0.8,
    maxOutputTokens: 20480,
    responseMimeType: 'application/json',
    responseJsonSchema: ANSWER_RESPONSE_SCHEMA,
  };

  if (thinkingLevel && thinkingLevel !== 'OFF') {
    config.thinkingConfig = {
      thinkingLevel: thinkingLevel as ThinkingLevel,
    };
  }

  try {
    console.log(`[Gemini API] 送信開始 (モデル: ${model}, 思考レベル: ${thinkingLevel || 'OFF'})`);
    console.log(`[Gemini API] プロンプト内容:\n${prompt}`);

    const response = await ai.models.generateContent({
      model,
      config,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    });

    const responseText = response.text;
    console.log(`[Gemini API] 受信応答:\n${responseText}`);
    if (!responseText) {
      throw new Error('APIからの応答が空です');
    }

    return parseAnswers(responseText, questions);
  } catch (error: any) {
    // エラーからステータスコードやステータス文字列を抽出
    const statusCode = error.status || error.statusCode || error.code;
    const statusText = error.statusText || '';
    const message = error.message || '';

    // トラブルシューティングガイドのエラーコードに基づくハンドリング
    // 400 INVALID_ARGUMENT または FAILED_PRECONDITION
    if (statusCode === 400 || message.includes('400') || statusText.includes('INVALID_ARGUMENT') || message.includes('INVALID_ARGUMENT') || statusText.includes('FAILED_PRECONDITION') || message.includes('FAILED_PRECONDITION')) {
      if (message.includes('API key') || message.includes('ApiKey') || message.includes('API_KEY')) {
        throw new Error('APIキーが無効です。設定画面で正しいキーを入力してください。');
      }
      if (message.includes('billing') || message.includes('free tier') || message.includes('FAILED_PRECONDITION') || statusText.includes('FAILED_PRECONDITION')) {
        throw new Error('Gemini API の無料枠がお住まいの国で利用できないか、Google AI Studio で課金設定がされていません。Google AI Studio で課金プランを設定してください。');
      }
      throw new Error('APIリクエストのパラメータ（温度やトークン数等）またはプロンプトの設定が無効です。設定を確認してください。');
    }

    // 403 PERMISSION_DENIED
    if (statusCode === 403 || message.includes('403') || statusText.includes('PERMISSION_DENIED') || message.includes('PERMISSION_DENIED')) {
      throw new Error('APIキーが無効であるか、必要な権限がありません。設定画面で正しいAPIキーを入力してください。');
    }

    // 404 NOT_FOUND
    if (statusCode === 404 || message.includes('404') || statusText.includes('NOT_FOUND') || message.includes('NOT_FOUND')) {
      throw new Error(`指定されたモデル "${model}" またはリソースが見つかりませんでした。モデル名が正しいか確認してください。`);
    }

    // 429 RESOURCE_EXHAUSTED
    if (statusCode === 429 || message.includes('429') || statusText.includes('RESOURCE_EXHAUSTED') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
      throw new Error('APIの利用制限（レートリミット）に達しました。しばらく待ってから再試行するか、有料プランへの移行をご検討ください。');
    }

    // 499 CANCELLED
    if (statusCode === 499 || message.includes('499') || statusText.includes('CANCELLED') || message.includes('CANCELLED')) {
      throw new Error('リクエストがキャンセルされました。クライアント側やネットワークのタイムアウトによるものか確認してください。');
    }

    // 500 INTERNAL
    if (statusCode === 500 || message.includes('500') || statusText.includes('INTERNAL') || message.includes('INTERNAL')) {
      throw new Error('Google側で予期しない内部エラーが発生しました。入力コンテキスト（質問数）を減らすか、別のモデルに変更してお試しください。');
    }

    // 503 UNAVAILABLE
    if (statusCode === 503 || message.includes('503') || statusText.includes('UNAVAILABLE') || message.includes('UNAVAILABLE')) {
      throw new Error('Gemini API サービスが一時的に過負荷、またはダウンしています。別のモデルに変更するか、しばらく時間をおいてから再試行してください。');
    }

    // 504 DEADLINE_EXCEEDED
    if (statusCode === 504 || message.includes('504') || statusText.includes('DEADLINE_EXCEEDED') || message.includes('DEADLINE_EXCEEDED')) {
      throw new Error('処理が時間内に完了しませんでした（タイムアウト）。プロンプト（質問数）を減らすか、しばらく待ってからお試しください。');
    }

    // 一般的なフォールバック判定
    if (message.includes('API key') || message.includes('ApiKey')) {
      throw new Error('APIキーが無効です。設定画面で正しいキーを入力してください。');
    }
    if (message.includes('quota') || message.includes('limit')) {
      throw new Error('APIの利用制限に達しました。しばらく待ってから再試行してください。');
    }
    if (message.includes('model')) {
      throw new Error(`モデル "${model}" が利用できません: ${message}`);
    }

    throw new Error(`Gemini API エラー: ${message}`);
  }
}
