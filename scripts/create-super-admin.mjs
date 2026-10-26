// Creates the first Super Admin (or promotes an existing account).
// Usage: npm run create-super-admin   (asks for email, password and name)
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;

const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (await rl.question("Email: ")).trim();
const password = (await rl.question("Password (min 8 characters): ")).trim();
const fullName = (await rl.question("Full name: ")).trim();
rl.close();

if (!email || !password || !fullName) {
  console.error("Email, password and full name are all required");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// handle_new_user creates the profile row; an existing account is reused
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

let userId = data.user?.id;
if (error) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  userId = list?.users.find((user) => user.email === email.toLowerCase())?.id;
  if (!userId) {
    console.error(`Could not create user: ${error.message}`);
    process.exit(1);
  }
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true, ban_duration: "none" });
  if (updateError) {
    console.error(`Could not update the password: ${updateError.message}`);
    process.exit(1);
  }
  console.log("Account already exists: password updated and promoted to Super Admin");
}

const { error: profileError } = await supabase
  .from("profiles")
  .update({ full_name: fullName, role: "super_admin", can_sell: true, is_active: true })
  .eq("id", userId);

if (profileError) {
  console.error(`Could not set the role: ${profileError.message}`);
  process.exit(1);
}

console.log(`Super Admin ready: ${email}`);
