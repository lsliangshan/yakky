import chalk from 'chalk';

export const logger = {
  info: (message: string) => console.log(chalk.blue('ℹ'), chalk.white(message)),
  success: (message: string) => console.log(chalk.green('✔'), chalk.green(message)),
  warn: (message: string) => console.log(chalk.yellow('⚠'), chalk.yellow(message)),
  error: (message: string) => console.log(chalk.red('✖'), chalk.red(message)),
  highlight: (message: string) => console.log(chalk.cyan(message)),
  muted: (message: string) => console.log(chalk.gray(message)),
};
