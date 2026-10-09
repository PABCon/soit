-- Top Employer profile enhancements (real-usage QA item): "team photos"
-- — company_team_members had no photo column at all, just name/role.
-- Same column-wide grant as the rest of this table (20260930200000_
-- company_rich_profile.sql), no grant change needed.
alter table company_team_members
  add column photo_url text;
