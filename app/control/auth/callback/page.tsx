import AuthCallback from "@/components/control/auth-callback";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const url = process.env.BRAIN_SUPABASE_URL;
  const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Control Center environment is incomplete.");
  return <AuthCallback supabaseUrl={url} anonKey={anonKey}/>;
}
