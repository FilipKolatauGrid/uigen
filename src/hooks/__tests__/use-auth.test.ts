import { describe, it, expect, vi, beforeEach } from "vitest";
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAnonWorkData).mockReturnValue(null);
  vi.mocked(getProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockResolvedValue({ id: "new-project" } as any);
});

describe("useAuth", () => {
  describe("signIn", () => {
    it("returns result and navigates to most recent project when no anon work", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getProjects).mockResolvedValue([
        { id: "project-1" },
        { id: "project-2" },
      ] as any);

      const { result } = renderHook(() => useAuth());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.signIn("user@example.com", "pass");
      });

      expect(returnVal).toEqual({ success: true });
      expect(mockPush).toHaveBeenCalledWith("/project-1");
    });

    it("creates new project and navigates when user has no existing projects", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "fresh-project" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/fresh-project");
    });

    it("saves anon work to new project, clears it, and navigates", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "build a card" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "code" } },
      };
      vi.mocked(signInAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getAnonWorkData).mockReturnValue(anonWork as any);
      vi.mocked(createProject).mockResolvedValue({ id: "anon-project" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringContaining("Design from"),
        messages: anonWork.messages,
        data: anonWork.fileSystemData,
      });
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-project");
      expect(getProjects).not.toHaveBeenCalled();
    });

    it("does not navigate or call post-signin logic when signIn fails", async () => {
      vi.mocked(signInAction).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      } as any);

      const { result } = renderHook(() => useAuth());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnVal).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
    });

    it("sets isLoading true during signIn, false after", async () => {
      let resolveSignIn!: (val: any) => void;
      vi.mocked(signInAction).mockReturnValue(
        new Promise((r) => { resolveSignIn = r; }) as any
      );
      vi.mocked(getProjects).mockResolvedValue([{ id: "p1" }] as any);

      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.signIn("user@example.com", "pass");
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: true });
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false when signIn throws", async () => {
      vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp", () => {
    it("returns result and navigates to most recent project on success", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getProjects).mockResolvedValue([{ id: "existing" }] as any);

      const { result } = renderHook(() => useAuth());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.signUp("new@example.com", "pass");
      });

      expect(returnVal).toEqual({ success: true });
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });

    it("creates new project and navigates when no existing projects", async () => {
      vi.mocked(signUpAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "created" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "pass");
      });

      expect(createProject).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/created");
    });

    it("does not navigate when signUp fails", async () => {
      vi.mocked(signUpAction).mockResolvedValue({
        success: false,
        error: "Email already taken",
      } as any);

      const { result } = renderHook(() => useAuth());

      let returnVal: any;
      await act(async () => {
        returnVal = await result.current.signUp("taken@example.com", "pass");
      });

      expect(returnVal).toEqual({ success: false, error: "Email already taken" });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("sets isLoading true during signUp, false after", async () => {
      let resolveSignUp!: (val: any) => void;
      vi.mocked(signUpAction).mockReturnValue(
        new Promise((r) => { resolveSignUp = r; }) as any
      );
      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(createProject).mockResolvedValue({ id: "p" } as any);

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "pass");
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp({ success: true });
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("resets isLoading to false when signUp throws", async () => {
      vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("saves anon work to project on signup, same as signin", async () => {
      const anonWork = {
        messages: [{ role: "user", content: "build a form" }],
        fileSystemData: { "/App.jsx": { type: "file", content: "" } },
      };
      vi.mocked(signUpAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getAnonWorkData).mockReturnValue(anonWork as any);
      vi.mocked(createProject).mockResolvedValue({ id: "signup-anon" } as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "pass");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/signup-anon");
    });
  });

  describe("anon work edge cases", () => {
    it("ignores anon work when messages array is empty", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getAnonWorkData).mockReturnValue({
        messages: [],
        fileSystemData: { "/App.jsx": {} },
      } as any);
      vi.mocked(getProjects).mockResolvedValue([{ id: "existing" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });

    it("ignores anon work when getAnonWorkData returns null", async () => {
      vi.mocked(signInAction).mockResolvedValue({ success: true } as any);
      vi.mocked(getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjects).mockResolvedValue([{ id: "existing" }] as any);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing");
    });
  });

  describe("initial state", () => {
    it("isLoading starts false", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    it("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });
});
