import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum([
  "Administrator",
  "Supervisor",
  "Security Officer",
  "Operator",
  "Auditor",
  "Viewer",
]);

const CreateInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  department: z.string().optional(),
  role: RoleEnum,
  operatorId: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Z0-9-]+$/, "Operator ID must be uppercase letters, digits, and hyphens"),
});

/**
 * Admin-only: provision a new operator account.
 * Creates the auth user with the service role, sets profile (operator_id,
 * status, issued_by), and assigns the requested role.
 */
export const createOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    // Authorize: only Administrators may enroll operators / admins
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "Administrator",
    });
    if (!isAdmin) throw new Error("Forbidden: Administrators only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure operator_id is unique up-front for a clean error message
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("operator_id", data.operatorId)
      .maybeSingle();
    if (existing) throw new Error(`Operator ID ${data.operatorId} is already in use`);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Failed to create user");
    }
    const newUserId = created.user.id;

    // The handle_new_user trigger created a profile + Viewer role.
    // Patch profile with operator-issued fields:
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        operator_id: data.operatorId,
        department: data.department ?? null,
        full_name: data.fullName,
        status: "Active",
        issued_by: context.userId,
        issued_at: new Date().toISOString(),
      })
      .eq("id", newUserId);
    if (profErr) throw new Error(profErr.message);

    // Replace default Viewer role with the requested one (idempotent)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { ok: true, userId: newUserId, operatorId: data.operatorId };
  });

const UpdateInput = z.object({
  userId: z.string().uuid(),
  status: z.enum(["Active", "Suspended"]).optional(),
  role: RoleEnum.optional(),
});

export const updateOperator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "Administrator",
    });
    if (!isAdmin) throw new Error("Forbidden: Administrators only");
    if (data.userId === context.userId) {
      throw new Error("You cannot modify your own account here");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.status) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ status: data.status })
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
