import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminTeam, inviteAdmin } from "@/services/admin/adminTeamService";
import { adminCreateAdmin } from "@/lib/admin-team.functions";

export function useAdminTeam() {
  return useQuery({ queryKey: ["admin", "team"], queryFn: listAdminTeam });
}

export function useInviteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inviteAdmin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
  });
}

export type CreateAdminInput = {
  email: string;
  password: string;
  full_name?: string;
};

export function useCreateAdmin() {
  const qc = useQueryClient();
  const createFn = useServerFn(adminCreateAdmin);
  return useMutation({
    mutationFn: (data: CreateAdminInput) => createFn({ data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
  });
}