import ora from 'ora';

export function createSpinner(text: string) {
  const spinner = ora({ text, color: 'cyan' });

  return {
    start: () => {
      spinner.start();
      return spinner;
    },
    succeed: (message?: string) => {
      spinner.succeed(message || spinner.text);
    },
    fail: (message?: string) => {
      spinner.fail(message || spinner.text);
    },
    info: (message: string) => {
      spinner.info(message);
    },
    update: (text: string) => {
      spinner.text = text;
    },
    stop: () => {
      spinner.stop();
    },
  };
}
