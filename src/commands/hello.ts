import type { HelloOptions } from '../types/index.js';
import { logger } from '../utils/logger.js';

export function hello(name: string = 'world', options: HelloOptions = {}) {
  const greeting = options.greeting || 'Hello';
  const message = `${greeting}, ${name}!`;
  logger.success(message);
  return message;
}
