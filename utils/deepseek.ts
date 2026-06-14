/**
 * DeepSeek API 連携モジュール
 * OpenAI SDK を使用して、質問文と選択肢から正解を問い合わせる
 */

import OpenAI from 'openai';
import { type QuestionInput, type AnswerResult } from './gemini';

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
 * システム指示を構築する
 */
function buildSystemInstruction(): string {
  return `あなたは試験問題の正解を判定するアシスタントです。
以下のルールを厳守してください：

1. 各問題に対して、正解の選択肢の「テキスト」のみを選択してください。
2. 選択肢のテキストは、入力された選択肢と完全に一致する文字列で指定してください。記号（A. B.等）は含めないでください。
3. 複数選択問題の場合は、正解と思われる選択肢をすべて配列に含めてください。
4. 出力は必ず以下の形式の有効なJSONオブジェクトにしてください。他の文章や説明は一切含めないでください。

JSONの形式例:
{
  "answers": [
    {
      "questionIndex": 0,
      "answers": ["選択肢Aのテキスト", "選択肢Bのテキスト"]
    },
    {
      "questionIndex": 1,
      "answers": ["選択肢Cのテキスト"]
    }
  ]
}`;
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
 * レスポンステキストからJSON配列をパースする
 */
function parseAnswers(responseText: string, questions: QuestionInput[]): AnswerResult[] {
  // Markdownのコードブロックを除去
  let cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed) ? parsed : (parsed.answers || parsed.results || []);

    return list.map((item: any) => ({
      questionIndex: item.questionIndex,
      questionText: questions[item.questionIndex]?.questionText || '',
      correctChoices: item.answers || item.correctChoices || [],
    }));
  } catch (error) {
    console.warn('DeepSeek JSON解析に失敗、テキストベースでフォールバック解析を試みます:', cleaned, error);
    return fallbackParse(cleaned, questions);
  }
}

/**
 * DeepSeek APIに質問を送信し、正解を取得する（OpenAI SDK使用）
 * 
 * @param apiKey - DeepSeek APIキー
 * @param questions - 質問リスト
 * @param model - 使用するモデル名（デフォルト: deepseek-v4-flash）
 * @param thinkingLevel - 思考レベル (OFF, LOW, MEDIUM, HIGH)
 * @returns 正解結果の配列
 */
export async function fetchDeepSeekAnswers(
  apiKey: string,
  questions: QuestionInput[],
  model: string = 'deepseek-v4-flash',
  thinkingLevel?: string
): Promise<AnswerResult[]> {
  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
    dangerouslyAllowBrowser: true
  });

  const prompt = buildPrompt(questions);
  const systemInstruction = buildSystemInstruction();

  const extraBody: any = {};
  if (thinkingLevel === 'OFF') {
    extraBody.thinking = { type: 'disabled' };
  } else {
    extraBody.thinking = { type: 'enabled' };
  }

  let reasoningEffort: 'high' | 'max' | undefined;
  if (thinkingLevel === 'HIGH') {
    reasoningEffort = 'max';
  } else if (thinkingLevel === 'MEDIUM') {
    reasoningEffort = 'high';
  }

  try {
    console.log(`[DeepSeek API] 送信開始 (モデル: ${model}, 思考レベル: ${thinkingLevel || 'OFF'})`);
    console.log(`[DeepSeek API] プロンプト内容:\n${prompt}`);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      reasoning_effort: reasoningEffort as any,
      extra_body: extraBody
    } as any);

    const responseText = response.choices[0]?.message?.content;
    console.log(`[DeepSeek API] 受信応答:\n${responseText}`);
    if (!responseText) {
      throw new Error('APIからの応答が空です');
    }

    return parseAnswers(responseText, questions);
  } catch (error: any) {
    console.error('[DeepSeek API] エラー詳細:', error);
    const message = error.message || '';
    const status = error.status || error.statusCode;

    if (status === 401 || message.includes('401') || message.includes('API key')) {
      throw new Error('DeepSeek APIキーが無効です。設定画面で正しいキーを入力してください。');
    }
    if (status === 402 || message.includes('402') || message.includes('insufficient_balance')) {
      throw new Error('DeepSeekのアカウント残高が不足しています。DeepSeekポータルでチャージしてください。');
    }
    if (status === 429 || message.includes('429') || message.includes('rate_limit')) {
      throw new Error('DeepSeek APIの利用制限（レートリミット）に達しました。しばらく待ってから再試行してください。');
    }
    if (status === 404 || message.includes('404')) {
      throw new Error(`指定されたモデル "${model}" が見つかりませんでした。`);
    }

    throw new Error(`DeepSeek API エラー: ${message}`);
  }
}
