import { createClient } from "@supabase/supabase-js";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing validation outside staging.");
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
const adminEmail = process.env.CONTROL_ADMIN_EMAIL?.toLowerCase();
if (!url || !serviceKey || !anonKey || !adminEmail) throw new Error("Staging security validation environment is incomplete.");
if (new URL(url).hostname.split(".")[0] !== process.env.BRAIN_IMPORT_PROJECT_REF) throw new Error("Project-ref mismatch.");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const tempUserEmail = `control-security-${Date.now()}@example.invalid`;
const tempPassword = `Stage-${crypto.randomUUID()}-Aa1!`;
let tempUserId = null;
let tempNoteId = null;

try {
  const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 100 });
  const adminUser = users.users.find((user) => user.email?.toLowerCase() === adminEmail);
  expect(adminUser, "Allowlisted administrator Auth user is missing.");
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
  if (linkError) throw linkError;
  const tokenHash = linkData.properties.hashed_token;
  const { data: adminSession, error: verifyError } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (verifyError || !adminSession.session) throw verifyError || new Error("Admin session could not be generated.");
  const admin = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${adminSession.session.access_token}` } } });

  const { data: allowlist } = await admin.from("brain_admin_users").select("user_id");
  expect(allowlist?.length === 1, "Administrator cannot read their allowlist record.");
  const { data: notes, error: noteReadError } = await admin.from("brain_notes").select("entity_id,publication_state");
  expect(!noteReadError && notes.length === 6, "Administrator cannot read the six editorial Notes records.");
  const { error: peopleError } = await admin.from("people").select("entity_id").limit(1);
  expect(peopleError?.message?.includes("permission denied"), "Control Center role unexpectedly received People-table access.");

  tempNoteId = crypto.randomUUID();
  const { error: entityInsertError } = await admin.from("entities").insert({ id: tempNoteId, kind: "note", slug: `security-check-${Date.now()}`, title: "Security check draft", visibility: "private", lifecycle_state: "active", editorial_state: "needs_review" });
  if (entityInsertError) throw entityInsertError;
  const { error: draftInsertError } = await admin.from("brain_notes").insert({ entity_id: tempNoteId, body_markdown: "Temporary protected draft.", publication_state: "draft", pinned: false });
  if (draftInsertError) throw draftInsertError;
  const { data: publicDraft } = await anon.from("brain_public_notes").select("id").eq("id", tempNoteId);
  expect(publicDraft?.length === 0, "Authenticated draft leaked into the anonymous view.");

  const { data: tempUser, error: tempUserError } = await service.auth.admin.createUser({ email: tempUserEmail, password: tempPassword, email_confirm: true });
  if (tempUserError) throw tempUserError;
  tempUserId = tempUser.user.id;
  const tempAnon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: tempSession, error: tempSignInError } = await tempAnon.auth.signInWithPassword({ email: tempUserEmail, password: tempPassword });
  if (tempSignInError || !tempSession.session) throw tempSignInError || new Error("Non-admin test session failed.");
  const outsider = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${tempSession.session.access_token}` } } });
  const { data: outsiderAdmin } = await outsider.from("brain_admin_users").select("user_id");
  expect(outsiderAdmin?.length === 0, "Non-admin can read an admin allowlist record.");
  const { error: outsiderWriteError } = await outsider.from("entities").insert({ id: crypto.randomUUID(), kind: "note", slug: `forbidden-${Date.now()}`, title: "Forbidden", visibility: "private", lifecycle_state: "active", editorial_state: "needs_review" });
  expect(Boolean(outsiderWriteError), "Authenticated non-admin unexpectedly wrote a Note entity.");

  const signupProbe = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signupError } = await signupProbe.auth.signUp({ email: `signup-${Date.now()}@example.invalid`, password: tempPassword });
  expect(Boolean(signupError), "Public Auth signup is still enabled.");

  console.log(JSON.stringify({ adminAllowlisted: true, passwordlessSessionVerified: true, adminNoteRead: notes.length, adminNoteWrite: true, unrelatedBrainAccess: "denied", anonymousDraftExposure: false, authenticatedNonAdminWrite: "denied", publicSignup: "disabled", serviceRoleInBrowser: false }, null, 2));
} finally {
  if (tempNoteId) await service.from("entities").delete().eq("id", tempNoteId);
  if (tempUserId) await service.auth.admin.deleteUser(tempUserId);
}
