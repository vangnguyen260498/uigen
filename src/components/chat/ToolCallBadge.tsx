"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

interface ToolCallBadgeProps {
  tool: ToolInvocation;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

function getLabel(tool: ToolInvocation): string {
  const args = tool.args as Record<string, string>;

  if (tool.toolName === "str_replace_editor") {
    const filename = getFileName(args.path ?? "");
    switch (args.command) {
      case "create":
        return `Creating ${filename}`;
      case "str_replace":
      case "insert":
        return `Editing ${filename}`;
      case "view":
        return `Viewing ${filename}`;
      default:
        return `Editing ${filename}`;
    }
  }

  if (tool.toolName === "file_manager") {
    const filename = getFileName(args.path ?? "");
    switch (args.command) {
      case "rename":
        return `Renaming ${filename} → ${getFileName(args.new_path ?? "")}`;
      case "delete":
        return `Deleting ${filename}`;
      default:
        return `Managing ${filename}`;
    }
  }

  return tool.toolName;
}

export function ToolCallBadge({ tool }: ToolCallBadgeProps) {
  const label = getLabel(tool);
  const isDone = tool.state === "result";

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
