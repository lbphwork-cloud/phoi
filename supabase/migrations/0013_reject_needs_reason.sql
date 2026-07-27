-- =============================================================================
-- Tu choi bai cung phai co ly do
--
-- Truoc day chi 'request_changes' bat buoc nhap ly do. 'reject' thi khong —
-- tuc la mot bai co the bi tu choi vinh vien ma tac gia khong bao gio biet vi
-- sao. Yeu cau sua thi con co duong lam tiep; tu choi la het, nen no CAN mot
-- lo do hon chu khong phai it hon.
--
-- Rang buoc dat o day chu khong chi o giao dien: giao dien la thu ai cung sua
-- duoc bang cong cu nha phat trien, con ham nay thi khong.
-- =============================================================================

create or replace function review_outfit(
  p_outfit_id uuid,
  p_action    review_action,
  p_reason    text default null
)
returns outfits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result outfits;
begin
  if not is_admin() then
    raise exception 'Chi quan tri vien duoc kiem duyet bai dang';
  end if;

  if p_action in ('request_changes', 'reject')
     and coalesce(trim(p_reason), '') = '' then
    raise exception 'Phai nhap ly do khi yeu cau sua hoac tu choi bai';
  end if;

  update outfits
     set status = case p_action
                    when 'approve'         then 'published'::outfit_status
                    when 'reject'          then 'rejected'::outfit_status
                    when 'request_changes' then 'needs_revision'::outfit_status
                  end,
         review_note = p_reason,
         reviewed_at = now(),
         published_at = case when p_action = 'approve'
                             then coalesce(published_at, now()) end
   where id = p_outfit_id
  returning * into result;

  if result.id is null then
    raise exception 'Khong tim thay bai dang';
  end if;

  insert into post_reviews (outfit_id, reviewer_id, action, reason)
  values (p_outfit_id, auth.uid(), p_action, p_reason);

  -- Giu NGUYEN cach dat ten hanh dong va noi dung nhu ban 0003. Doi ten hanh
  -- dong o day se lam nhat ky cu va nhat ky moi khong con loc chung duoc, ma
  -- muc dich cua ban va nay chi la bat buoc nhap ly do.
  insert into admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (auth.uid(), 'outfit.' || p_action, 'outfit', p_outfit_id,
          jsonb_build_object('reason', p_reason, 'new_status', result.status));

  return result;
end;
$$;

grant execute on function review_outfit(uuid, review_action, text) to authenticated;
