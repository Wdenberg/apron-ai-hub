import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk, invalidate } from "@/lib/queryKeys";
import {
  getProfile,
  getProfileBasic,
  updateProfile,
  uploadAvatar,
  isPhoneTakenByOther,
} from "@/services/profileService";

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.profile.mine(userId),
    enabled: !!userId,
    queryFn: () => getProfile(userId!),
  });
}

export function useProfileBasic(userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.profile.basic(userId),
    enabled: !!userId,
    queryFn: () => getProfileBasic(userId!),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      userId: string;
      patch: Parameters<typeof updateProfile>[1];
    }) => updateProfile(payload.userId, payload.patch),
    onSuccess: () => invalidate.profile(qc),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { userId: string; file: File }) =>
      uploadAvatar(payload.userId, payload.file),
    onSuccess: () => invalidate.profile(qc),
  });
}

export { isPhoneTakenByOther };

export function useSaveMyPhone(userId: string | undefined) {
  return useMutation({
    mutationFn: async (whatsapp: string) => {
      if (!userId) throw new Error("Não autenticado");
      const taken = await isPhoneTakenByOther(whatsapp, userId);
      if (taken) throw new Error("Telefone já cadastrado em outra conta.");
      await updateProfile(userId, { whatsapp });
    },
  });
}