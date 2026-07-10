import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { qk, invalidate } from "@/lib/queryKeys";
import { listAdminTeam, inviteAdmin } from "@/services/admin/adminTeamService";
import { adminCreateAdmin } from "@/lib/admin-team.functions";

export function useAdminTeam() {
  return useQuery({ queryKey: qk.admin.team, queryFn: listAdminTeam });
}

export function useInviteAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inviteAdmin,
    onSuccess: () => invalidate.adminTeam(qc),
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
    onSuccess: () => invalidate.adminTeam(qc),
  });
}