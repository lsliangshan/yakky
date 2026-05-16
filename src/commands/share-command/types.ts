export interface ShareCommandArgs {}

export interface ShortcutCommandShareConfig {
  name: string;
  description: string | null;
  workspace_path: string | null;
  script: string;
}
