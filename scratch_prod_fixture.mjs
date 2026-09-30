import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"(.*)"$/, "$1")]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const rand = Math.random().toString(36).slice(2, 8);
const email = `soit-billprod-${rand}@mailinator.com`;
const password = "testpass123";
const { data: userRes, error: userErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (userErr) throw userErr;
const { data: company, error: companyErr } = await admin.from("companies").insert({
  company_name: `Billing Prod Fixture ${rand}`,
  slug: `billing-prod-fixture-${rand}`,
  nif: "509799434",
  verification_status: "verified",
}).select("id").single();
if (companyErr) throw companyErr;
await admin.from("employer_users").insert({ auth_user_id: userRes.user.id, company_id: company.id, role: "owner" });
console.log(JSON.stringify({ email, password, authUserId: userRes.user.id, companyId: company.id }, null, 2));
