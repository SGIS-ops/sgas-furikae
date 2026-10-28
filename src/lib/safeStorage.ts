// localStorage の安全なラッパー。
// 共有ページ・プライベートブラウズ・サイトデータのブロック時は localStorage へのアクセス自体が例外になるため、
// 失敗しても画面が止まらないよう、読み込みは null・書き込みは何もしない扱いにする。
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 保存できない環境では、そのセッション中だけ動作する
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
};
