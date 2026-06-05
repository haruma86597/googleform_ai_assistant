/**
 * ストレージ管理モジュール
 * Gemini APIキーの保存・取得を管理する
 */

const STORAGE_KEY = 'gemini_api_key';

/**
 * APIキーを chrome.storage.local に保存する
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  await storage.setItem<string>(`local:${STORAGE_KEY}`, apiKey);
}

/**
 * chrome.storage.local からAPIキーを取得する
 */
export async function getApiKey(): Promise<string | null> {
  const key = await storage.getItem<string>(`local:${STORAGE_KEY}`);
  return key ?? null;
}

/**
 * APIキーが設定済みかを確認する
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.trim().length > 0;
}
