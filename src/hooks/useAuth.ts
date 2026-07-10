import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { qk } from "@/lib/queryKeys";
import {
  getCurrentUser,
  signInWithPassword,
  signUpWithPassword,
  signOutGlobal,
  updateUserEmail,
  updateUserPassword,
} from "@/services/authService";

export function useAuthUser() {
  return useQuery({
    queryKey: qk.auth.user,
    queryFn: () => getCurrentUser(),
  });
}

export function useSessionUser() {
  return useQuery({
    queryKey: qk.auth.session,
    queryFn: () => getCurrentUser(),
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      signInWithPassword(payload.email, payload.password),
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: (payload: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string; data?: Record<string, unknown> };
    }) => signUpWithPassword(payload.email, payload.password, payload.options),
  });
}

export function useUpdateEmail() {
  return useMutation({ mutationFn: (email: string) => updateUserEmail(email) });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (password: string) => updateUserPassword(password),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await signOutGlobal();
    navigate({ to: "/auth", replace: true });
  };
}