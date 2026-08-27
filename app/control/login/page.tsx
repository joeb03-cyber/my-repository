import { redirect } from "next/navigation";
import { getControlAdmin } from "@/lib/brain/control-auth.server";
import ControlLogin from "@/components/control/control-login";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getControlAdmin()) redirect("/control");
  const url = process.env.BRAIN_SUPABASE_URL;
  const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Control Center environment is incomplete.");
  return <ControlLogin supabaseUrl={url} anonKey={anonKey} />;
}
