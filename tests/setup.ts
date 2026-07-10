import { vi } from "vitest";
import { createSupabaseMock } from "./helpers/supabaseMock";

export const supabaseMock = createSupabaseMock();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock.supabase,
}));