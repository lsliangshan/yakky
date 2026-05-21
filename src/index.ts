export { hello } from './commands/hello.js';
export { init } from './commands/init.js';
export { logger } from './utils/logger.js';
export {
  createNotificationCommand,
  createTerminalVisibilityCommand,
  isCommandWindowVisible,
  notifyUser,
  notifyUserWhenCommandWindowHidden,
} from './utils/notify.js';
export type { NotifyOptions } from './utils/notify.js';
export { createSpinner } from './utils/spinner.js';
export { getRandomSentence } from './utils/random.js';
export { dataPaths, dataPath, configPath, cachePath } from './utils/paths.js';
export {
  decryptShortcutCommandConfig,
  encryptShortcutCommandConfig,
  shortcutCommandEncryptKey,
} from './commands/share-command/index.js';
export type { ShortcutCommandShareConfig } from './commands/share-command/types.js';
export type { HelloOptions, InitAnswers } from './types/index.js';
