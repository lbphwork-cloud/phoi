-- =============================================================================
-- MAU CHU DAO CUA SET DO CHI LAY TU AO VA QUAN
--
-- VI SAO
--   Truoc day `outfits.color_slugs` la mot danh sach go tay, khong rang buoc gi
--   voi cac mon that trong set. Hai hau qua da xay ra:
--
--   1. SAI SO LIEU. Migration 0038 gan mau theo vong ngu hanh chu khong nhin
--      vao mon nao ca, nen co bai ghi tone "vang, be" trong khi ao navy quan be
--      — mau vang khong ton tai o dau trong set do. Bo loc theo mau tra ve bai
--      nay khi loc "vang", va nguoi dung bam vao thi khong thay mau vang nao.
--
--   2. GIAY VA PHU KIEN LAM LOANG TONE. Mot set ao trang quan den di giay do
--      thi tong the van la trang-den; doi giay khong doi tong mau cua bo do.
--      Nhung neu tone tinh ca giay thi set do bi coi la "co mau do", va voi
--      nguoi menh Thuy (han che Hoa) thi ca set bi tru diem chi vi doi giay.
--
--   Chu website chot: tone chi lay tu AO va QUAN.
--
-- AO KHOAC CHI TINH KHI KHONG CO AO TRONG
--   Set do co ca ao so mi lan ao khoac thi ao trong moi la mau nen. Tinh ca hai
--   se cho ra ba mau chu dao cho mot set — nhieu hon so mau ma mat nguoi doc ra
--   khi nhin thoang qua.
--
-- VAN SUA TAY DUOC
--   Cot `tone_thu_cong` danh dau nhung bai da duoc nguoi that chon mau. Trigger
--   khong dung vao nhung bai do nua. Day la nguyen tac chu website dat tu dau:
--   cai gi tu dong sinh ra thi phai sua lai bang tay duoc.
-- =============================================================================

alter table outfits
  add column if not exists tone_thu_cong boolean not null default false;

comment on column outfits.tone_thu_cong is
  'true = mau chu dao do nguoi dung tu chon, trigger khong tinh lai nua.';

-- ---------------------------------------------------------------------------
-- Tinh tone tu cac mon
--
-- Thu tu tra ve co y nghia: ao truoc, roi ao khoac, roi quan. Giao dien hien
-- toi da 5 o mau theo dung thu tu nay, nen mau ao luon la o dau tien.
-- ---------------------------------------------------------------------------
create or replace function tinh_tone_outfit(p_outfit uuid)
returns text[]
language sql
stable
as $$
  with mon as (
    select oi.role, oi.position, p.color_slug
      from outfit_items oi
      join products p on p.id = oi.product_id
     where oi.outfit_id = p_outfit
       and p.color_slug is not null
  ),
  chon as (
    select color_slug,
           case role
             when 'top'       then 1
             when 'outerwear' then 2
             when 'bottom'    then 3
           end as uu_tien,
           position
      from mon
     where role in ('top', 'bottom')
        -- Ao khoac chi duoc tinh khi set khong co ao trong.
        or (role = 'outerwear' and not exists (select 1 from mon where role = 'top'))
  ),
  gon as (
    -- Hai mon cung mau thi chi ke mot lan, giu vi tri som nhat.
    select color_slug, min(uu_tien * 1000 + position) as thu_tu
      from chon
     group by color_slug
  )
  select coalesce(array_agg(color_slug order by thu_tu), '{}')
    from gon;
$$;

-- ---------------------------------------------------------------------------
-- Tinh lai khi cac mon thay doi
-- ---------------------------------------------------------------------------
create or replace function trg_tone_theo_mon()
returns trigger
language plpgsql
as $$
declare
  v_outfit uuid;
  v_tone   text[];
begin
  v_outfit := coalesce(new.outfit_id, old.outfit_id);
  v_tone := tinh_tone_outfit(v_outfit);

  -- Tone rong thi GIU NGUYEN gia tri cu. Xoa het mon ra khoi mot bai (buoc
  -- trung gian binh thuong khi sua bai) khong duoc lam bai do mat sach mau va
  -- bien khoi moi bo loc.
  if cardinality(v_tone) > 0 then
    update outfits
       set color_slugs = v_tone
     where id = v_outfit
       and not tone_thu_cong
       and color_slugs is distinct from v_tone;
  end if;

  return null;
end $$;

drop trigger if exists tone_theo_mon on outfit_items;
create trigger tone_theo_mon
  after insert or update or delete on outfit_items
  for each row execute function trg_tone_theo_mon();

-- ---------------------------------------------------------------------------
-- Tinh lai khi doi mau cua mot san pham
--
-- Admin sua mau mot chiec quan tu den sang navy thi moi set do dung chiec quan
-- do phai doi tone theo. Khong co trigger nay thi tone dung yen va lai lech
-- khoi mon that — dung cai loi ma migration nay sinh ra de sua.
-- ---------------------------------------------------------------------------
create or replace function trg_tone_theo_san_pham()
returns trigger
language plpgsql
as $$
begin
  if new.color_slug is distinct from old.color_slug then
    update outfits o
       set color_slugs = tinh_tone_outfit(o.id)
     where not o.tone_thu_cong
       and exists (
         select 1 from outfit_items oi
          where oi.outfit_id = o.id and oi.product_id = new.id
       )
       and cardinality(tinh_tone_outfit(o.id)) > 0;
  end if;
  return null;
end $$;

drop trigger if exists tone_theo_san_pham on products;
create trigger tone_theo_san_pham
  after update on products
  for each row execute function trg_tone_theo_san_pham();

-- ---------------------------------------------------------------------------
-- TINH LAI TOAN BO DU LIEU DANG CO
--
-- Day la buoc sua so lieu sai cua 0038. Chi dung vao bai nao that su tinh ra
-- duoc tone tu mon — bai khong co ao quan thi giu nguyen mau dang ghi.
-- ---------------------------------------------------------------------------
update outfits o
   set color_slugs = tinh_tone_outfit(o.id)
 where cardinality(tinh_tone_outfit(o.id)) > 0
   and o.color_slugs is distinct from tinh_tone_outfit(o.id);

-- ---------------------------------------------------------------------------
-- Quyen: nguoi dung duoc danh dau bai cua minh la "mau do toi tu chon".
-- Khong cap quyen nay thi trinh soan ghi duoc mau nhung lan sua mon ke tiep se
-- de trigger ghi de len lua chon cua ho.
-- ---------------------------------------------------------------------------
grant update (tone_thu_cong) on outfits to authenticated;
