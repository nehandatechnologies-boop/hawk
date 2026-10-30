import { supabase } from "@/integrations/supabase/client";
import type { Descriptor } from "@/lib/face/api";

export interface FaceEnrollment {
  id: string;
  personnel_id: string;
  personnel_name: string;
  descriptor: Descriptor;
  thumbnail: string | null;
  enrolled_by: string | null;
  created_at: string;
  updated_at: string;
}

export const faceEnrollmentService = {
  async list(): Promise<FaceEnrollment[]> {
    const { data, error } = await supabase
      .from("face_enrollments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as FaceEnrollment[];
  },

  async upsert(input: {
    personnelId: string;
    personnelName: string;
    descriptor: Descriptor;
    thumbnail?: string;
  }): Promise<FaceEnrollment> {
    const { data: userRes } = await supabase.auth.getUser();
    const row = {
      personnel_id: input.personnelId,
      personnel_name: input.personnelName,
      descriptor: input.descriptor as unknown as never,
      thumbnail: input.thumbnail ?? null,
      enrolled_by: userRes.user?.id ?? null,
    };
    const { data, error } = await supabase
      .from("face_enrollments")
      .upsert(row, { onConflict: "personnel_id" })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as FaceEnrollment;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("face_enrollments").delete().eq("id", id);
    if (error) throw error;
  },
};
