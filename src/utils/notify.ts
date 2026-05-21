import { spawn } from "node:child_process";

export type NotifyOptions = {
  title: string;
  content: string;
  sound?: string;
};

type NotificationCommand = {
  command: string;
  args: string[];
};

type TerminalVisibilityCommand = NotificationCommand;

function toAppleScriptString(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ")}"`;
}

function toPowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''").replace(/\r?\n/g, " ")}'`;
}

function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function getMacTerminalProcessNames(
  termProgram = process.env.TERM_PROGRAM
): string[] {
  if (termProgram === "Apple_Terminal") return ["Terminal"];
  if (termProgram === "iTerm.app") return ["iTerm2", "iTerm"];
  if (termProgram === "vscode") return ["Code", "Visual Studio Code", "Cursor"];
  if (termProgram === "WezTerm") return ["WezTerm"];
  if (termProgram === "alacritty") return ["Alacritty"];

  return [
    "Terminal",
    "iTerm2",
    "iTerm",
    "Code",
    "Visual Studio Code",
    "Cursor",
    "WezTerm",
    "Alacritty",
  ];
}

function createMacTerminalVisibilityScript(processNames: string[]): string {
  const checks = processNames
    .map(
      (processName) =>
        `if appVisible(${toAppleScriptString(processName)}) then return true`
    )
    .join("\n");

  return `
on appVisible(processName)
  tell application "System Events"
    if not (exists process processName) then return false
    tell process processName
      if visible is false then return false
      if frontmost is false then return false
      if (count of windows) is 0 then return false
      try
        if (value of attribute "AXMinimized" of front window) is true then return false
      end try
      return true
    end tell
  end tell
end appVisible
${checks}
return false
`.trim();
}

export function createTerminalVisibilityCommand(
  platform: NodeJS.Platform = process.platform,
  termProgram = process.env.TERM_PROGRAM
): TerminalVisibilityCommand | null {
  if (platform !== "darwin") {
    return null;
  }

  return {
    command: "osascript",
    args: [
      "-e",
      createMacTerminalVisibilityScript(
        getMacTerminalProcessNames(termProgram)
      ),
    ],
  };
}

export function createNotificationCommand(
  options: NotifyOptions,
  platform: NodeJS.Platform = process.platform
): NotificationCommand | null {
  const title = options.title.trim();
  const content = options.content.trim();
  const sound = options.sound?.trim() || "Glass";

  if (!title || !content) return null;

  if (platform === "darwin") {
    const script = [
      "display notification",
      toAppleScriptString(content),
      "with title",
      toAppleScriptString(title),
      "sound name",
      toAppleScriptString(sound),
    ].join(" ");

    return {
      command: "osascript",
      args: ["-e", script],
    };
  }

  if (platform === "win32") {
    const soundScript = sound
      ? "[System.Media.SystemSounds]::Asterisk.Play()"
      : "";
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notification = New-Object System.Windows.Forms.NotifyIcon
$notification.Icon = [System.Drawing.SystemIcons]::Information
$notification.BalloonTipTitle = ${toPowerShellString(title)}
$notification.BalloonTipText = ${toPowerShellString(content)}
$notification.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notification.Visible = $true
${soundScript}
$notification.ShowBalloonTip(5000)
Start-Sleep -Seconds 6
$notification.Dispose()
`.trim();

    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-EncodedCommand",
        encodePowerShellCommand(script),
      ],
    };
  }

  if (platform === "linux") {
    return {
      command: "notify-send",
      args: [title, content],
    };
  }

  return null;
}

function runNotificationCommand(
  command: NotificationCommand
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command.command, command.args, {
      stdio: "ignore",
      shell: false,
    });

    child.once("error", () => {
      resolve(false);
    });

    child.once("close", (code) => {
      resolve(code === 0);
    });
  });
}

export async function notifyUser(options: NotifyOptions): Promise<boolean> {
  const command = createNotificationCommand(options);
  if (!command) return false;

  return runNotificationCommand(command);
}

function runVisibilityCommand(
  command: TerminalVisibilityCommand
): Promise<boolean | null> {
  return new Promise((resolve) => {
    const child = spawn(command.command, command.args, {
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
    });
    const chunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    child.once("error", () => {
      resolve(null);
    });

    child.once("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      const output = Buffer.concat(chunks).toString("utf-8").trim();
      if (output === "true") {
        resolve(true);
        return;
      }
      if (output === "false") {
        resolve(false);
        return;
      }
      resolve(null);
    });
  });
}

export async function isCommandWindowVisible(): Promise<boolean | null> {
  if (!process.stdout.isTTY) return false;

  const command = createTerminalVisibilityCommand();
  if (!command) return true;

  return runVisibilityCommand(command);
}

export async function notifyUserWhenCommandWindowHidden(
  options: NotifyOptions
): Promise<boolean> {
  try {
    // const visible = await isCommandWindowVisible();
    // if (visible !== false) return false;

    return notifyUser(options);
  } catch {
    return false;
  }
}
