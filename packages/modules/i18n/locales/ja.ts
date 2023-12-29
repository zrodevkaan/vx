import { ALL_KNOWN_MESSAGES } from "./en-us";
import { FormattedMessage } from "./formattedMessage";

// This is how a i18n object will look
// Uses partial because en-us will store a default to all messages
const messages: Partial<ALL_KNOWN_MESSAGES> = {
  THEMES: "テーマ",
  PLUGINS: "プラグイン",
  EXTENSIONS: "拡張 機能",
  DESKTOP: "デスクトップ",
  NO_ADDONS_FOUND: new FormattedMessage("{type}が見つかりません", "ja", false),
  WELCOME: "VXへようこそ",
  NO_RESULTS_FOUND: "結果が見つかりませんでした"
};

export default messages;