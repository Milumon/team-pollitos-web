-- Minecraft access belongs only to approved Team Pollito members.
update public.minecraft_accounts as minecraft
set
  status = 'revoked',
  revoked_at = coalesce(minecraft.revoked_at, now()),
  verified_at = null,
  approved_by = null,
  approved_at = null,
  link_code = null,
  link_code_hash = null,
  link_code_expires_at = null,
  updated_at = now()
where minecraft.status in ('pending', 'approved')
  and not exists (
    select 1
    from public.profiles as profile
    where profile.id = minecraft.user_id
      and profile.link_status = 'approved'
  );
