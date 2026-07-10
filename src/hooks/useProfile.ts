import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProfile,
  getProfileBasic,
  updateProfile,
  uploadAvatar,
  isPhoneTakenByOther,
} from "@/services/profileService";

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: () => getProfile(userId!),
  });
}

export function useProfileBasic(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { userId: string; file: File }) =>
      uploadAvatar(payload.userId, payload.file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}

export { isPhoneTakenByOther };