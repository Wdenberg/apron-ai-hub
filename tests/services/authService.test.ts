import { describe, it, expect, beforeEach } from "vitest";
import { supabaseMock } from "../setup";
import {
  getCurrentUser,
  signInWithPassword,
  signOutGlobal,
  updateUserPassword,
} from "@/services/authService";

describe("authService", () => {
  beforeEach(() => supabaseMock.reset());

  it("getCurrentUser returns user", async () => {
    supabaseMock.setData({ id: "u1", email: "a@b.c" });
    const u = await getCurrentUser();
    expect(u).toEqual({ id: "u1", email: "a@b.c" });
  });

  it("signInWithPassword throws on error", async () => {
    supabaseMock.setError({ message: "bad" });
    await expect(signInWithPassword("a", "b")).rejects.toBeTruthy();
  });

  it("signOutGlobal calls scope=global", async () => {
    await signOutGlobal();
    expect(supabaseMock.supabase.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("updateUserPassword throws on error", async () => {
    supabaseMock.setError({ message: "bad" });
    await expect(updateUserPassword("newpass")).rejects.toBeTruthy();
  });
});