import ora from "ora";
import chalk from "chalk";

export function createSpinner(text: string, spinnerStyle: string = "material") {
  const spinner = ora({ text, color: "cyan", spinner: spinnerStyle as any });
  let shown = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    start: () => {
      timer = setTimeout(() => {
        spinner.start();
        shown = true;
      }, 200);
    },
    succeed: (message?: string) => {
      if (timer) clearTimeout(timer);
      if (shown) {
        spinner.succeed(message || spinner.text);
      } else {
        console.log(`${chalk.green("✔")} ${message || text}`);
      }
    },
    fail: (message?: string) => {
      if (timer) clearTimeout(timer);
      if (shown) {
        spinner.fail(message || spinner.text);
      } else {
        console.log(`${chalk.red("✖")} ${message || text}`);
      }
    },
    info: (message: string) => {
      if (timer) clearTimeout(timer);
      if (shown) {
        spinner.info(message);
      } else {
        console.log(`${chalk.cyan("ℹ")} ${message}`);
      }
    },
    update: (text: string) => {
      if (shown) {
        spinner.text = text;
      }
    },
    stop: () => {
      if (timer) clearTimeout(timer);
      if (shown) spinner.stop();
    },
  };
}
