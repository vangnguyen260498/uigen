import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    test("isLoading starts as false", () => {
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("sets isLoading during execution and resets after", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue(null);

      let resolveAction!: (value: { success: boolean }) => void;
      const deferred = new Promise<{ success: boolean }>((res) => { resolveAction = res; });
      vi.mocked(signInAction).mockReturnValue(deferred as any);

      const { result } = renderHook(() => useAuth());

      // Start sign-in but don't await it yet
      let signInPromise: Promise<any>;
      act(() => { signInPromise = result.current.signIn("user@example.com", "password123"); });

      // isLoading should be true while action is in-flight
      expect(result.current.isLoading).toBe(true);

      // Resolve and confirm isLoading resets
      await act(async () => {
        resolveAction({ success: false });
        await signInPromise!;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signInAction", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;

      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    });

    test("does not redirect on failed sign in", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpass");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading even when action throws", async () => {
      vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("post sign-in: anonymous work exists", () => {
      const anonMessages = [{ role: "user", content: "hello" }];
      const anonFileSystemData = { "/App.jsx": { type: "file", content: "<App />" } };

      beforeEach(() => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue({
          messages: anonMessages,
          fileSystemData: anonFileSystemData,
        });
        vi.mocked(createProject).mockResolvedValue({ id: "proj-anon-123" } as any);
      });

      test("creates a project with anonymous work", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: anonMessages,
            data: anonFileSystemData,
          })
        );
      });

      test("clears anonymous work after creating project", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(clearAnonWork).toHaveBeenCalled();
      });

      test("redirects to new project route", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/proj-anon-123");
      });

      test("does not fetch existing projects when anon work exists", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(getProjects).not.toHaveBeenCalled();
      });
    });

    describe("post sign-in: no anonymous work, existing projects", () => {
      beforeEach(() => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([
          { id: "proj-existing-1" },
          { id: "proj-existing-2" },
        ] as any);
      });

      test("redirects to the most recent project", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/proj-existing-1");
      });

      test("does not create a new project", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(createProject).not.toHaveBeenCalled();
      });
    });

    describe("post sign-in: no anonymous work, no existing projects", () => {
      beforeEach(() => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjects).mockResolvedValue([]);
        vi.mocked(createProject).mockResolvedValue({ id: "proj-new-999" } as any);
      });

      test("creates a new project", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
      });

      test("redirects to the newly created project", async () => {
        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/proj-new-999");
      });
    });

    describe("post sign-in: anonymous work with no messages is ignored", () => {
      test("treats empty messages list as no anon work", async () => {
        vi.mocked(signInAction).mockResolvedValue({ success: true });
        vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
        vi.mocked(getProjects).mockResolvedValue([{ id: "proj-existing-1" }] as any);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password123");
        });

        expect(createProject).not.toHaveBeenCalledWith(
          expect.objectContaining({ messages: [] })
        );
        expect(mockPush).toHaveBeenCalledWith("/proj-existing-1");
      });
    });
  });

  describe("signUp", () => {
    test("sets isLoading during execution and resets after", async () => {
      vi.mocked(getAnonWorkData).mockReturnValue(null);

      let resolveAction!: (value: { success: boolean }) => void;
      const deferred = new Promise<{ success: boolean }>((res) => { resolveAction = res; });
      vi.mocked(signUpAction).mockReturnValue(deferred as any);

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => { signUpPromise = result.current.signUp("new@example.com", "password123"); });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveAction({ success: false });
        await signUpPromise!;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signUpAction", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;

      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    });

    test("does not redirect on failed sign up", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("resets isLoading even when action throws", async () => {
      vi.mocked(signUpAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("runs post-sign-in flow on successful sign up (redirects to existing project)", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([{ id: "proj-existing-1" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/proj-existing-1");
    });

    test("creates project from anon work on successful sign up", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true });
      vi.mocked(getAnonWorkData).mockReturnValue({
        messages: [{ role: "user", content: "make a button" }],
        fileSystemData: { "/App.jsx": { content: "" } },
      });
      vi.mocked(createProject).mockResolvedValue({ id: "proj-anon-456" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalled();
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/proj-anon-456");
    });
  });
});
