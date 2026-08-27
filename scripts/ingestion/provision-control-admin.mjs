import { createClient } from "@supabase/supabase-js";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing provisioning outside staging.");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.CONTROL_ADMIN_EMAIL?.trim().toLowerCase();
if (!url || !key || !email) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and CONTROL_ADMIN_EMAIL are required.");
const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== process.env.BRAIN_IMPORT_PROJECT_REF || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Staging guard failed.");

const client = createClient(url, key, { auth: { persistSession: false } });
let page = 1;
let user = null;
while (!user) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email) || null;
  if (user || data.users.length < 100) break;
  page += 1;
}
if (!user) {
  const { data, error } = await client.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  user = data.user;
}
if (!user) throw new Error("Admin user could not be created.");
const { error: allowlistError } = await client.from("brain_admin_users").upsert({ user_id: user.id, email, display_name: "Joe", active: true });
if (allowlistError) throw allowlistError;
console.log(`Control Center administrator ready: ${email.replace(/(^.).*(@.*$)/, "$1***$2")}`);
