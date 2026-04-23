import type { Config } from 'drizzle-kit';
import { dataPath } from './src/utils/paths.ts';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dataPath('yakky.db'),
  },
} satisfies Config;