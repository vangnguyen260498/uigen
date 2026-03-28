import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

function makeInvocation(
  toolName: string,
  args: Record<string, string>,
  state: "call" | "result" = "result"
): ToolInvocation {
  return {
    toolCallId: "test-id",
    toolName,
    args,
    state,
    ...(state === "result" ? { result: "ok" } : {}),
  } as ToolInvocation;
}

// str_replace_editor — create
test("shows 'Creating' for str_replace_editor create command", () => {
  render(
    <ToolCallBadge
      tool={makeInvocation("str_replace_editor", {
        command: "create",
        path: "/src/components/Button.tsx",
      })}
    />
  );
  expect(screen.getByText("Creating Button.tsx")).toBeDefined();
});

// str_replace_editor — str_replace
test("shows 'Editing' for str_replace_editor str_replace command", () => {
  render(
    <ToolCallBadge
      tool={makeInvocation("str_replace_editor", {
        command: "str_replace",
        path: "/src/App.jsx",
      })}
    />
  );
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

// str_replace_editor — insert
test("shows 'Editing' for str_replace_editor insert command", () => {
  render(
    <ToolCallBadge
      tool={makeInvocation("str_replace_editor", {
        command: "insert",
        path: "/src/App.jsx",
      })}
    />
  );
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

// str_replace_editor — view
test("shows 'Viewing' for str_replace_editor view command", () => {
  render(
    <ToolCallBadge
      tool={makeInvocation("str_replace_editor", {
        command: "view",
        path: "/src/utils/helpers.ts",
      })}
    />
  );
  expect(screen.getByText("Viewing helpers.ts")).toBeDefined();
});

// file_manager — rename
test("shows 'Renaming' for file_manager rename command", () => {
  render(
    <ToolCallBadge
      tool={makeInvocation("file_manager", {
        command: "rename",
        path: "/src/OldName.tsx",
        new_path: "/src/NewName.tsx",
      })}
    />
  );
  expect(screen.getByText("Renaming OldName.tsx → NewName.tsx")).toBeDefined();
});

// file_manager — delete
test("shows 'Deleting' for file_manager delete command", () => {
  render(
    <ToolCallBadge
      tool={makeInvocation("file_manager", {
        command: "delete",
        path: "/src/components/Unused.tsx",
      })}
    />
  );
  expect(screen.getByText("Deleting Unused.tsx")).toBeDefined();
});

// loading state (in-progress)
test("shows spinner when tool call is in progress", () => {
  const { container } = render(
    <ToolCallBadge
      tool={makeInvocation(
        "str_replace_editor",
        { command: "create", path: "/src/App.jsx" },
        "call"
      )}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
});

// done state
test("shows green dot when tool call is complete", () => {
  const { container } = render(
    <ToolCallBadge
      tool={makeInvocation(
        "str_replace_editor",
        { command: "create", path: "/src/App.jsx" },
        "result"
      )}
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

// uses only the filename, not the full path
test("displays only the filename, not the full path", () => {
  render(
    <ToolCallBadge
      tool={makeInvocation("str_replace_editor", {
        command: "create",
        path: "/deeply/nested/path/Component.tsx",
      })}
    />
  );
  expect(screen.getByText("Creating Component.tsx")).toBeDefined();
  expect(screen.queryByText(/deeply\/nested/)).toBeNull();
});
