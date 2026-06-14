/**
 * ストレージ管理モジュール
 * Gemini APIキー、モデル名、思考レベル（Thinking Level）の保存・取得を管理する
 */

const STORAGE_KEY_API_KEY = 'gemini_api_key';
const STORAGE_KEY_DEEPSEEK_API_KEY = 'deepseek_api_key';
const STORAGE_KEY_MODEL = 'gemini_model';
const STORAGE_KEY_THINKING_LEVEL = 'gemini_thinking_level';

export const DEFAULT_MODEL = 'gemini-3.5-flash';
export const DEFAULT_THINKING_LEVEL = 'MEDIUM';

/**
 * APIキーを chrome.storage.local に保存する
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  await storage.setItem<string>(`local:${STORAGE_KEY_API_KEY}`, apiKey);
}

/**
 * chrome.storage.local からAPIキーを取得する
 */
export async function getApiKey(): Promise<string | null> {
  const key = await storage.getItem<string>(`local:${STORAGE_KEY_API_KEY}`);
  return key ?? null;
}

/**
 * DeepSeek APIキーを chrome.storage.local に保存する
 */
export async function saveDeepSeekApiKey(apiKey: string): Promise<void> {
  await storage.setItem<string>(`local:${STORAGE_KEY_DEEPSEEK_API_KEY}`, apiKey);
}

/**
 * chrome.storage.local から DeepSeek APIキーを取得する
 */
export async function getDeepSeekApiKey(): Promise<string | null> {
  const key = await storage.getItem<string>(`local:${STORAGE_KEY_DEEPSEEK_API_KEY}`);
  return key ?? null;
}

/**
 * APIキーが設定済みかを確認する
 */
export async function hasApiKey(): Promise<boolean> {
  const model = await getModel();
  if (model === 'deepseek-v4-flash') {
    const key = await getDeepSeekApiKey();
    return key !== null && key.trim().length > 0;
  }
  const key = await getApiKey();
  return key !== null && key.trim().length > 0;
}


/**
 * モデル名を保存する
 */
export async function saveModel(model: string): Promise<void> {
  await storage.setItem<string>(`local:${STORAGE_KEY_MODEL}`, model);
}

/**
 * 保存されたモデル名を取得する（未設定の場合はデフォルト値を返す）
 */
export async function getModel(): Promise<string> {
  const model = await storage.getItem<string>(`local:${STORAGE_KEY_MODEL}`);
  return model ?? DEFAULT_MODEL;
}

/**
 * 思考レベルを保存する
 */
export async function saveThinkingLevel(level: string): Promise<void> {
  await storage.setItem<string>(`local:${STORAGE_KEY_THINKING_LEVEL}`, level);
}

/**
 * 保存された思考レベルを取得する（未設定の場合はデフォルト値を返す）
 */
export async function getThinkingLevel(): Promise<string> {
  const level = await storage.getItem<string>(`local:${STORAGE_KEY_THINKING_LEVEL}`);
  return level ?? DEFAULT_THINKING_LEVEL;
}
