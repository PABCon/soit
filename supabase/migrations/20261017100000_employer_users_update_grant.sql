-- `updateMemberRole()` (src/lib/db/team.ts) was added to let an owner
-- change a colleague's role, but this table never got an UPDATE policy or
-- grant — only select/insert/delete exist from the original RLS migration.
-- Every call has been failing with "permission denied for table
-- employer_users" since that feature shipped; caught live while verifying
-- the /recruit/team restyle, which exercises this exact action.
grant update on employer_users to authenticated;

create policy "owners update colleague roles"
  on employer_users for update to authenticated
  using (company_id = public.my_company_id() and public.my_employer_role() = 'owner')
  with check (company_id = public.my_company_id() and public.my_employer_role() = 'owner');
