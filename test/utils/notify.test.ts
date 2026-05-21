import { describe, expect, it } from "vitest";
import {
  createNotificationCommand,
  createTerminalVisibilityCommand,
} from "../../src/utils/notify.js";

function decodePowerShellCommand(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf16le");
}

describe("notification command", () => {
  it("macOS 使用 osascript 并默认使用 Glass 声音", () => {
    const command = createNotificationCommand(
      {
        title: "Yakky",
        content: "命令执行完成",
      },
      "darwin",
    );

    expect(command?.command).toBe("osascript");
    expect(command?.args).toEqual([
      "-e",
      'display notification "命令执行完成" with title "Yakky" sound name "Glass"',
    ]);
  });

  it("macOS 支持自定义声音并转义文本", () => {
    const command = createNotificationCommand(
      {
        title: 'Yakky "Dev"',
        content: "build\\test 完成",
        sound: "Ping",
      },
      "darwin",
    );

    expect(command?.args[1]).toBe(
      'display notification "build\\\\test 完成" with title "Yakky \\"Dev\\"" sound name "Ping"',
    );
  });

  it("Windows 使用 PowerShell 托盘通知", () => {
    const command = createNotificationCommand(
      {
        title: "Yakky",
        content: "命令执行完成",
      },
      "win32",
    );

    expect(command?.command).toBe("powershell.exe");
    expect(command?.args).toContain("-EncodedCommand");

    const encoded = command?.args.at(-1);
    expect(encoded).toBeTruthy();

    const script = decodePowerShellCommand(encoded!);
    expect(script).toContain("$notification.BalloonTipTitle = 'Yakky'");
    expect(script).toContain("$notification.BalloonTipText = '命令执行完成'");
    expect(script).toContain("[System.Media.SystemSounds]::Asterisk.Play()");
  });

  it("Linux 使用 notify-send", () => {
    const command = createNotificationCommand(
      {
        title: "Yakky",
        content: "命令执行完成",
      },
      "linux",
    );

    expect(command).toEqual({
      command: "notify-send",
      args: ["Yakky", "命令执行完成"],
    });
  });

  it("标题或内容为空时不创建命令", () => {
    expect(
      createNotificationCommand({ title: "", content: "命令执行完成" }, "darwin"),
    ).toBeNull();
    expect(
      createNotificationCommand({ title: "Yakky", content: "" }, "darwin"),
    ).toBeNull();
  });
});

describe("terminal visibility command", () => {
  it("macOS 为 Terminal 生成 osascript 可见性检测命令", () => {
    const command = createTerminalVisibilityCommand("darwin", "Apple_Terminal");

    expect(command?.command).toBe("osascript");
    expect(command?.args[0]).toBe("-e");
    expect(command?.args[1]).toContain("exists process processName");
    expect(command?.args[1]).toContain('appVisible("Terminal")');
    expect(command?.args[1]).toContain("frontmost is false");
    expect(command?.args[1]).toContain("AXMinimized");
  });

  it("macOS 为 iTerm 生成 iTerm2/iTerm 检测", () => {
    const command = createTerminalVisibilityCommand("darwin", "iTerm.app");

    expect(command?.args[1]).toContain('appVisible("iTerm2")');
    expect(command?.args[1]).toContain('appVisible("iTerm")');
  });

  it("非 macOS 不创建桌面可见性检测命令", () => {
    expect(createTerminalVisibilityCommand("win32")).toBeNull();
    expect(createTerminalVisibilityCommand("linux")).toBeNull();
  });
});
