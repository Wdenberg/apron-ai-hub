import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAdminTeam, inviteAdmin } from "@/services/admin/adminTeamService";

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