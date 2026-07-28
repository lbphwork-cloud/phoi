'use client';

/**
 * Cac mon nam trong mot set do, sua duoc ngay tai cho.
 *
 * VI SAO KHONG CON TRANG "SAN PHAM" RIENG
 *   Truoc day co mot trang liet ke moi san pham trong database. Nhin vao mot
 *   dong "Ao thun cotton tron trang" khong biet no thuoc set nao, nen sua thi
 *   khong biet minh dang lam hong bai nao. San pham o day khong phai mot kho
 *   hang doc lap — no chi ton tai vi co mot set do dung no. Dat no ben trong
 *   set la dat dung cho no thuoc ve.
 *
 * TAI DU LIEU KHI MO RA, KHONG TAI SAN
 *   Danh sach outfit co the len hang tram dong. Tai san pham cua tat ca ngay
 *   tu dau la keo ve mot dong du lieu ma 99% se khong ai nhin. Mo dong nao
 *   tai dong do.
 *
 * LUU TUNG MON
 *   Moi mon mot nut luu. Mot nut luu tat ca nghia la mot loi mang lam mat toan
 *   bo cong sua, va khong biet mon nao hong.
 */

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useAsyncData, useAuth, useTaxonomy } from '@/lib/hooks';
import { uploadImage } from '@/lib/storage';
import { checkAffiliateUrl } from '@/lib/affiliate';
import { fetchProductFromUrl, guessCategory, roleFromCategory, guessColorSlug } from '@/lib/fetchProduct';
import { guessColorSlugs } from '@/lib/guessColor';
import { formatVnd, IMAGE_LIMITS } from '@/lib/format';
import { Spinner } from '@/components/site';
import { UploadButton } from '@/components/UploadButton';
import { ImagePicker, laAnhMauTrong } from '@/components/ImagePicker';
import { ColorPicker } from '@/components/ColorPicker';
import { CATEGORY_LABEL, ITEM_ROLE_LABEL } from '@/lib/supabase/types';
import {
  datTenTheoQuyTac, vietMoTaTheoQuyTac, thieuGiDeDatTen, thieuGiDeVietMoTa, bangMau,
} from '@/lib/outfitNaming';
import {
  buildImagePrompt, explainPromptVi, monChuaCoAnh, requestAiImage,
  SCENES, MODEL_TYPES, type AiProviderId,
} from '@/lib/aiImage';
import { useAiCredentials } from '@/lib/aiCredentials';
import { AiKeyBox } from '@/components/AiKeyBox';
import { AI_PROVIDER_LABEL } from '@/lib/supabase/types';
import type { ItemRole, ProductCategory } from '@/lib/supabase/types';
import type { OutfitWithItems } from '@/lib/supabase/types';

/** Ban nhap cua mot mon. Chi chua truong nguoi dung da dong vao. */
interface ItemDraft {
  name?: string;
  price?: string;
  imageUrl?: string;
  affiliateUrl?: string;
  /*
    BON TRUONG NAY TRUOC DAY KHONG SUA DUOC O DAY, va tung cai deu co hau qua:

      category  — mon them tu trang quan tri bi ghi cung la "phu kien".
      role      — vai tro di thang vao cau lenh tao anh. Sai vai tro thi cau
                  lenh ghi "* phu kien: theo anh dinh kem" cho ca ao lan quan,
                  va anh sinh ra khong con biet dau la ao dau la quan.
      colorSlug — mau THAT trong set. Bo loc mau va phep tinh hop menh doc no.
      availableColorSlugs — cac mau chinh link do con ban, chi de nguoi mua biet.
  */
  category?: ProductCategory;
  role?: ItemRole;
  colorSlug?: string;
  availableColorSlugs?: string[];
  /** Cac anh doc duoc tu link o lan bam "Lay thong tin" gan nhat. */
  imageChoices?: string[];
  /**
   * Link thuong cua san pham (products.source_url) — link KHONG mang ma gioi
   * thieu. Truoc day khoi nay chi sua duoc link tiep thi, nen mot mon dang giu
   * link thuong sai thi khong co duong nao sua tu trang quan tri.
   */
  sourceUrl?: string;
}

export function AdminOutfitItems({ outfitId }: { outfitId: string }) {
  const { session } = useAuth();
  const tax = useTaxonomy();

  const { data, loading, error, reload } = useAsyncData<OutfitWithItems | null>(
    `admin-outfit-items-${outfitId}`,
    (sb) =>
      sb
        .from('outfits')
        .select('*, outfit_items(*, products(*), affiliate_links(*))')
        .eq('id', outfitId)
        .maybeSingle()
        .then(({ data: r, error: e }) => ({ data: (r as OutfitWithItems | null) ?? null, error: e })),
  );

  const [draft, setDraft] = useState<Record<string, ItemDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Mon dang lay thong tin tu link, va cau bao trang thai cua no. */
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [fetchNote, setFetchNote] = useState<Record<string, string>>({});

  /*
    THEM MOT MON MOI VAO SET.

    Truoc day mot set thieu mon thi khong co cach nao bo sung tu trang quan
    tri — phai bao nguoi dang tu sua, hoac xoa ca bai lam lai. Ma phan lon
    truong hop can them lai chinh la khi quan tri vien dang duyet: thay set
    thieu mot doi giay, hoac mot mon bi go nham.

    Giu trong mot khoi trang thai rieng chu khong nhet vao `draft`: `draft` la
    ban nhap cua cac mon DA CO, khoa theo id — mon chua ton tai thi chua co id.
  */
  /*
    THONG TIN CUA CA SET, sua ngay tai day.

    Truoc day khoi nay chi sua duoc tung MON — ten, gia, anh, link. Nhung thu
    quyet dinh set do hien o dau va cho ai thi lai nam o cap SET: phong cach,
    dip, va nhat la MAU CHU DAO. Ba thu do la dau vao cua bo loc trang kham pha
    va cua phep tinh hop menh.

    Nghia la mot set bi gan sai mau thi no se hien sai cho voi moi nguoi dung,
    va quan tri vien khong co duong nao sua ngoai viec bao nguoi dang tu sua.

    GIU BAN NHAP RIENG khoi `draft` (ban nhap cua tung mon): hai thu nay thuoc
    hai bang khac nhau va co hai nut Luu rieng. Gop lam mot thi mot loi mang o
    bang nay se lam mat ca cong sua o bang kia.
  */
  const [outfitDraft, setOutfitDraft] = useState<{
    title?: string; description?: string;
    styleSlug?: string; occasionSlug?: string; colorSlugs?: string[];
  }>({});
  const [outfitBusy, setOutfitBusy] = useState(false);
  const [outfitSaved, setOutfitSaved] = useState(false);

  /** Lan tao prompt thu may — bam "Đổi cách diễn đạt" thi tang len. */
  const [promptLan, setPromptLan] = useState(0);
  const [hienPrompt, setHienPrompt] = useState(false);
  const [daChep, setDaChep] = useState(false);
  /** Boi canh va dang nguoi mau. Truoc day khoa cung nen trang + dang can doi. */
  const [sceneId, setSceneId] = useState<string>('trang');
  const [modelTypeId, setModelTypeId] = useState<string>('ngau-nhien');
  /*
    CAU LENH DA SUA TAY.

    null = chua dong vao, cau lenh bam theo du lieu va tu doi khi du lieu doi.
    Co gia tri = nguoi dung da tu sua, va tu luc do KHONG duoc tu ghi de nua.

    Mot o chu tu nhay lai ve ban may sinh khi nguoi ta vua go xong hai cau la
    mat trang cua ho, khong phai mot tinh nang.
  */
  const [promptSua, setPromptSua] = useState<string | null>(null);

  /*
    DUNG ANH BANG AI NGAY TAI DAY.

    Truoc day khoi nay chi DUNG cau lenh roi cho chep — muon tao anh that thi
    phai sang trang tao bai, nhap lai toan bo mot set do da ton tai chi de bam
    mot cai nut. Ma dung cho can anh nhat lai la day: bai da co du mon, du anh
    san pham, dang cho duyet.
  */
  const [aiProvider, setAiProvider] = useState<AiProviderId>('xai');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiUrls, setAiUrls] = useState<string[]>([]);
  const creds = useAiCredentials();

  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addNote, setAddNote] = useState<string | null>(null);
  const [moi, setMoi] = useState({
    url: '', name: '', price: '', imageUrl: '',
    category: 'ao' as ProductCategory,
    role: 'top' as ItemRole,
    colorSlug: '',
    availableColorSlugs: [] as string[],
    imageChoices: [] as string[],
  });

  // Anh dai dien cua ca set. Giu rieng khoi `draft` vi no thuoc bang outfits,
  // khong thuoc mon nao.
  const [heroDraft, setHeroDraft] = useState<string | null>(null);
  const [heroBusy, setHeroBusy] = useState(false);
  const [heroSaved, setHeroSaved] = useState(false);

  if (loading) return <Spinner label="Đang tải sản phẩm trong set" />;
  if (error) return <p className="hint-error">Không tải được sản phẩm: {error}</p>;
  if (!data) return <p className="muted-2 text-sm">Không tìm thấy set đồ này.</p>;

  const items = [...(data.outfit_items ?? [])].sort((a, b) => a.position - b.position);
  const heroUrl = heroDraft ?? data.hero_image_url ?? '';
  const heroDirty = heroDraft !== null && heroDraft !== (data.hero_image_url ?? '');

  const uploadHero = async (file: File) => {
    if (!session) return;
    setHeroBusy(true);
    setSaveError(null);

    const r = await uploadImage('outfit-images', session.user.id, file);
    setHeroBusy(false);

    if (!r.ok || !r.url) { setSaveError(r.message); return; }
    setHeroDraft(r.url);
    setHeroSaved(false);
  };

  const saveHero = async () => {
    const sb = getSupabase();
    if (!sb || heroDraft === null) return;

    setHeroBusy(true);
    setSaveError(null);

    const { error: e } = await sb
      .from('outfits')
      .update({ hero_image_url: heroDraft.trim() || null })
      .eq('id', outfitId);

    setHeroBusy(false);
    if (e) { setSaveError(`Ảnh đại diện: ${e.message}`); return; }

    setHeroSaved(true);
    setHeroDraft(null);
    reload();
  };

  const set = (itemId: string, patch: ItemDraft) => {
    setDraft((d) => ({ ...d, [itemId]: { ...d[itemId], ...patch } }));
    setSavedId(null);
  };

  const uploadItemImage = async (itemId: string, file: File) => {
    if (!session) return;
    setBusyId(itemId);
    setSaveError(null);

    const r = await uploadImage('product-images', session.user.id, file);
    setBusyId(null);

    if (!r.ok || !r.url) { setSaveError(r.message); return; }
    set(itemId, { imageUrl: r.url });
  };

  /**
   * Go mot mon ra khoi set do.
   *
   * XOA DONG outfit_items, KHONG XOA SAN PHAM.
   *   San pham va link tiep thi cua no van con trong database. Ly do: link do
   *   thuoc ve NGUOI DANG — no mang ma gioi thieu cua ho — va mot quan tri vien
   *   go mot mon khoi mot set khong co nghia la xoa cong suc cua nguoi khac.
   *
   *   San pham khong con set nao dung se hien trong khoi "San pham mo coi" ngay
   *   duoi danh sach outfit, va o do moi co lua chon xoa han. Hai buoc cho hai
   *   quyet dinh khac nhau.
   *
   * TONG GIA TU TINH LAI, khong phai ma o day: trigger trg_outfit_items_total.
   *
   * BAI KHONG BI DUA VE CHO DUYET KHI ADMIN GO — VA DO LA CO Y.
   *   Ban dau toi doan nguoc va viet nham vao hop xac nhan. Phep kiem trong
   *   scripts/verify-schema.mjs bat duoc: trigger outfit_items_require_rereview
   *   thoat som khi is_trusted_context(), ma ham do dung voi admin.
   *
   *   Ly do that hop ly: admin sua bai thi chinh viec sua do DA LA kiem duyet.
   *   Day bai cua chinh minh ve hang doi cua chinh minh la mot vong lap vo
   *   nghia. Nguoi dang thuong go mot mon thi VAN bi day ve cho duyet.
   *
   * GHI NHAT KY TRUOC KHI XOA, khong phai sau. Xoa xong moi ghi ma ghi that
   * bai thi con lai mot lan xoa khong ai truy duoc.
   */
  /**
   * Go mot mon — phan viec THAT SU, khong hoi han gi.
   *
   * Tach ra khoi phan hoi xac nhan de duong go MOT mon va duong go NHIEU mon
   * dung chung dung mot cach lam: cung ghi nhat ky, cung thu tu, cung cach bao
   * loi. Hai ban sao cua doan nay se lech nhau ngay lan sua dau tien.
   */
  const goMon = async (
    item: OutfitWithItems['outfit_items'][number],
  ): Promise<{ ok: boolean; message?: string }> => {
    const sb = getSupabase();
    if (!sb) return { ok: false, message: 'Chưa cấu hình Supabase.' };

    const ten = item.products?.name ?? 'món này';

    const { error: eLog } = await sb.rpc('log_admin_action', {
      p_action: 'outfit_item.delete',
      p_entity_type: 'outfit_item',
      p_entity_id: item.id,
      p_detail: { outfit_id: outfitId, product_name: ten, role: item.role },
    });
    if (eLog) return { ok: false, message: `Không ghi được nhật ký nên chưa xoá: ${eLog.message}` };

    const { error } = await sb.from('outfit_items').delete().eq('id', item.id);
    if (error) return { ok: false, message: `Không gỡ được "${ten}": ${error.message}` };
    return { ok: true };
  };

  const removeItem = async (item: OutfitWithItems['outfit_items'][number]) => {
    const ten = item.products?.name ?? 'món này';
    if (!window.confirm(
      `Gỡ "${ten}" khỏi set đồ?\n\n`
      + 'Sản phẩm và link tiếp thị vẫn được giữ lại — chúng sẽ hiện trong mục '
      + '"Sản phẩm mồ côi" nếu không còn set nào dùng.\n\n'
      + 'Tổng giá của set được tính lại ngay. Bài vẫn giữ nguyên trạng thái '
      + 'hiển thị — bạn là quản trị viên nên không phải chờ duyệt lại.',
    )) return;

    setBusyId(item.id);
    setSaveError(null);

    const r = await goMon(item);

    setBusyId(null);
    if (!r.ok) { setSaveError(r.message ?? 'Không gỡ được món.'); return; }
    reload();
  };

  /** Cac mon dang duoc tich de go mot lan. */
  const [chonMon, setChonMon] = useState<Set<string>>(new Set());
  const [goNhieuBusy, setGoNhieuBusy] = useState(false);

  const doiChonMon = (id: string) =>
    setChonMon((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const goCacMonDaChon = async () => {
    const ds = items.filter((x) => chonMon.has(x.id));
    if (ds.length === 0) return;

    const ten = ds.map((x) => x.products?.name ?? '(chưa có tên)');
    if (!window.confirm(
      `Gỡ ${ds.length} món khỏi set đồ?\n\n`
      + ten.slice(0, 8).map((t) => `· ${t}`).join('\n')
      + (ten.length > 8 ? `\n· … và ${ten.length - 8} món nữa` : '')
      + '\n\nSản phẩm và link tiếp thị vẫn được giữ lại.',
    )) return;

    setGoNhieuBusy(true);
    setSaveError(null);

    let xong = 0;
    for (const it of ds) {
      const r = await goMon(it);
      if (!r.ok) {
        setSaveError(`Đã gỡ ${xong}/${ds.length} món rồi thì dừng: ${r.message}`);
        break;
      }
      xong++;
    }

    setGoNhieuBusy(false);
    setChonMon(new Set());
    reload();
  };

  /**
   * Doi cho mot mon voi mon lien ke.
   *
   * VI SAO THU TU QUAN TRONG
   *   No khong chi la thu tu hien tren man hinh. Cac dong trong cau lenh tao
   *   anh va cau mo ta tu dong deu di theo thu tu nay — nen mot set do liet ke
   *   giay truoc ao se sinh ra ca cau lenh lan mo ta bat dau bang doi giay.
   *
   * BA LAN GHI, KHONG PHAI HAI. Bang co rang buoc unique (outfit_id, position),
   * nen ghi A sang vi tri cua B se dung ngay vao dong B dang giu. Phai dua A ra
   * mot vi tri trong (-1) truoc, tra B ve cho A, roi moi dat A vao cho B.
   *
   * Vi tri am chi ton tai trong khoang giua ba lenh ghi nay. Neu lenh thu hai
   * hong thi con lai mot mon o vi tri -1 — no van hien dung dau danh sach va
   * bam doi cho lan nua la ve lai binh thuong, khong mat du lieu.
   */
  const moveItem = async (index: number, huong: -1 | 1) => {
    const sb = getSupabase();
    if (!sb) return;

    const a = items[index];
    const b = items[index + huong];
    if (!a || !b) return;

    setBusyId(a.id);
    setSaveError(null);

    const buoc = [
      sb.from('outfit_items').update({ position: -1 }).eq('id', a.id),
      sb.from('outfit_items').update({ position: a.position }).eq('id', b.id),
      sb.from('outfit_items').update({ position: b.position }).eq('id', a.id),
    ];

    for (const b1 of buoc) {
      const { error: e } = await b1;
      if (e) { setBusyId(null); setSaveError(`Đổi thứ tự: ${e.message}`); return; }
    }

    setBusyId(null);
    reload();
  };

  /**
   * Lay thong tin tu LINK DANG NAM TRONG O, ngay trong trang quan tri.
   *
   * DOC LINK TRONG O CHU KHONG PHAI LINK DA LUU. Neu nguoi duyet vua dan mot
   * link khac vao thi lay theo link moi do — day la cach thay han mot mon bang
   * mon khac ma khong phai xoa di lam lai: dan link moi, bam lay thong tin,
   * xem lai, roi Luu.
   *
   * VI SAO CAN O DAY chu khong chi o trang tao bai
   *   Gia tren san doi lien tuc, va anh san pham cung bi nguoi ban thay. Bai da
   *   dang mot thang truoc gan nhu chac chan dang hien gia sai. Truoc day muon
   *   cap nhat thi phai mo link, doc gia, roi go tay vao — bon mon la bon lan.
   *
   * CHI DIEN VAO BAN NHAP, KHONG LUU NGAY. Nguoi duyet nhin thay thay doi roi
   * moi bam Luu. Tu ghi de du lieu dang cong khai bang mot thu vua doc ve tu
   * mot trang ben ngoai la viec khong duoc phep lam khong hoi.
   */
  const fetchFromLink = async (
    item: OutfitWithItems['outfit_items'][number],
    o: 'affiliate' | 'thuong' = 'affiliate',
  ) => {
    const url = o === 'thuong'
      ? (draft[item.id]?.sourceUrl ?? item.products?.source_url ?? '')
      : (draft[item.id]?.affiliateUrl ?? item.affiliate_links?.url ?? '');
    if (!url.trim()) {
      setFetchNote((x) => ({ ...x, [item.id]: 'Chưa có link để lấy.' }));
      return;
    }

    setFetchingId(item.id);
    setFetchNote((x) => ({ ...x, [item.id]: 'Bắt đầu…' }));

    const out = await fetchProductFromUrl(url, session?.user.id ?? null, {
      onProgress: (m) => setFetchNote((x) => ({ ...x, [item.id]: m })),
    });

    setFetchingId(null);

    if (!out.ok || !out.data) {
      setFetchNote((x) => ({ ...x, [item.id]: out.message }));
      return;
    }

    const d = out.data;
    const moi: ItemDraft = {};
    if (d.name) moi.name = d.name;
    if (d.price_vnd) moi.price = String(d.price_vnd);
    if (d.image_url) moi.imageUrl = d.image_url;
    // Giu ca danh sach de nguoi duyet chon anh khac neu anh dau khong ro mon do.
    const dsAnh = d.image_urls?.length ? d.image_urls : (d.image_url ? [d.image_url] : []);
    if (dsAnh.length) moi.imageChoices = dsAnh;

    /*
      DOAN LOAI VA MAU TU TEN, nhung CHI DIEN VAO O DANG TRONG.

      Doan sai la chuyen binh thuong — ten hang tren san nhoi day tu khoa. Neu
      ghi de len thu nguoi duyet da chon tay thi mot lan bam "Lay thong tin" de
      cap nhat gia se lang le lam hong ca loai lan mau da sua dung.

      Mau CHU DAO cua ca set thi khong dong vao o day: no la quyet dinh o cap
      set, va co nut rieng ngay tren.
    */
    const cs = draft[item.id]?.colorSlug ?? item.products?.color_slug ?? '';
    if (!cs && d.name) {
      const doan = guessColorSlug(d.name);
      if (doan) moi.colorSlug = doan;
    }

    // Chi doan LOAI khi mon dang mang gia tri mac dinh "phu kien" — do la thu
    // ma nut "Them mon vao set" tung ghi cung cho moi mon.
    const cat = draft[item.id]?.category ?? item.products?.category;
    if (cat === 'phu_kien' && d.name) {
      const catDoan = guessCategory(d.name) as ProductCategory;
      if (catDoan !== 'phu_kien') {
        moi.category = catDoan;
        moi.role = roleFromCategory(catDoan) as ItemRole;
      }
    }

    // Mau con ban tren san: doc tu nhan bien the (chi co qua Local Helper) va
    // tu chinh ten san pham. `max` de 17 vi day la "link nay ban nhung mau
    // nao" — mot cai ao ban nam mau la binh thuong.
    const dsMau = draft[item.id]?.availableColorSlugs ?? item.products?.available_color_slugs ?? [];
    if (dsMau.length === 0) {
      const slugs = tax.colors.map((c) => c.slug);
      const gom = [...new Set([
        ...(d.variant_labels ?? []).flatMap((nhan) => guessColorSlugs(nhan, slugs)),
        ...guessColorSlugs(d.name ?? '', slugs, 17),
      ])];
      if (gom.length) moi.availableColorSlugs = gom;
    }

    if (Object.keys(moi).length === 0) {
      setFetchNote((x) => ({ ...x, [item.id]: 'Đọc được link nhưng không có dữ liệu mới.' }));
      return;
    }

    set(item.id, moi);
    setFetchNote((x) => ({
      ...x,
      [item.id]: `Đã điền vào ô bên dưới: ${Object.keys(moi).length} trường. `
        + 'Xem lại rồi bấm "Lưu món này".',
    }));
  };

  /**
   * Luu cac truong cua ca set do.
   *
   * CHI GUI NHUNG O DA DONG VAO. Gui het moi cot nghia la ghi de bang chinh
   * gia tri dang co — vo hai ve du lieu, nhung no lam moi lan bam Luu deu tinh
   * la mot lan sua trong nhat ky va lam trigger chay khong can thiet.
   *
   * Cac cot nay deu nam trong danh sach duoc cap quyen UPDATE o migration 0002.
   * Nhung cot khong nam trong do (published_at, total_price_vnd, author_id...)
   * chi trigger va ham SECURITY DEFINER duoc dat — dung nhu the.
   */
  const saveOutfit = async () => {
    const sb = getSupabase();
    if (!sb) return;
    if (Object.keys(outfitDraft).length === 0) return;

    setOutfitBusy(true);
    setSaveError(null);

    const patch: Record<string, unknown> = {};
    const d = outfitDraft;
    if (d.title !== undefined) patch.title = d.title.trim();
    if (d.description !== undefined) patch.description = d.description.trim() || null;
    if (d.styleSlug !== undefined) patch.style_slug = d.styleSlug || null;
    if (d.occasionSlug !== undefined) patch.occasion_slug = d.occasionSlug || null;
    if (d.colorSlugs !== undefined) {
      patch.color_slugs = d.colorSlugs;
      // Admin tu chon mau thi khoa lai, khong de trigger 0039 tinh lai theo
      // mon nua. Khong co dong nay thi lan sua mon ke tiep se ghi de len lua
      // chon vua roi va nhin nhu website tu doi mau.
      patch.tone_thu_cong = true;
    }

    const { error } = await sb.from('outfits').update(patch).eq('id', outfitId);

    setOutfitBusy(false);
    if (error) { setSaveError(`Thông tin set: ${error.message}`); return; }

    setOutfitDraft({});
    setOutfitSaved(true);
    reload();
  };

  /** Lay thong tin cho MON DANG THEM (chua co trong database). */
  const fetchForNew = async () => {
    if (!moi.url.trim()) { setAddNote('Chưa có link để lấy.'); return; }

    setAddBusy(true);
    setAddNote('Bắt đầu…');

    const out = await fetchProductFromUrl(moi.url, session?.user.id ?? null, {
      onProgress: (m) => setAddNote(m),
    });
    setAddBusy(false);

    if (!out.ok || !out.data) { setAddNote(out.message); return; }

    const d = out.data;
    const slugs = tax.colors.map((c) => c.slug);
    // Doan loai tu ten roi suy ra vai tro. Chi ap dung khi cac o con TRONG —
    // doan sai la binh thuong, va ghi de len lua chon da sua tay thi te hon.
    const catDoan = d.name ? (guessCategory(d.name) as ProductCategory) : null;

    setMoi((x) => ({
      ...x,
      name: x.name || d.name || '',
      price: x.price || (d.price_vnd ? String(d.price_vnd) : ''),
      imageUrl: x.imageUrl || d.image_url || '',
      imageChoices: d.image_urls?.length ? d.image_urls : (d.image_url ? [d.image_url] : []),
      category: x.name || !catDoan ? x.category : catDoan,
      role: x.name || !catDoan ? x.role : (roleFromCategory(catDoan) as ItemRole),
      colorSlug: x.colorSlug || guessColorSlug(d.name ?? '') || '',
      availableColorSlugs: x.availableColorSlugs.length
        ? x.availableColorSlugs
        : [...new Set([
            ...(d.variant_labels ?? []).flatMap((nhan) => guessColorSlugs(nhan, slugs)),
            ...guessColorSlugs(d.name ?? '', slugs, 17),
          ])],
    }));
    setAddNote('Đã điền vào các ô bên dưới. Xem lại rồi bấm "Thêm vào set".');
  };

  /**
   * Tao mot mon moi va gan vao set.
   *
   * BA BUOC, THEO DUNG THU TU: san pham -> link tiep thi -> dong noi vao set.
   * Buoc sau can id cua buoc truoc, nen khong gop duoc. Buoc nao hong thi dung
   * ngay va bao ro buoc do — khong de lai mot san pham mo coi ma nguoi dung
   * khong biet la no da duoc tao.
   *
   * VI TRI = so lon nhat dang co cong mot. Bang co rang buoc unique
   * (outfit_id, position), nen dem so mon roi lay lam vi tri se dung ngay vao
   * mot cho da bi chiem khi truoc do co mon bi go (vi tri khong lien tuc nua).
   */
  const addItem = async () => {
    const sb = getSupabase();
    if (!sb) return;

    const uid = session?.user.id;
    if (!uid) { setAddNote('Cần đăng nhập.'); return; }

    if (!moi.name.trim()) { setAddNote('Chưa có tên sản phẩm.'); return; }

    const check = checkAffiliateUrl(moi.url);
    if (!check.ok) { setAddNote(check.message); return; }

    setAddBusy(true);
    setAddNote('Đang thêm…');

    const { data: product, error: e1 } = await sb
      .from('products')
      .insert({
        name: moi.name.trim(),
        // Truoc day ghi cung 'phu_kien' cho MOI mon them tu day. Hau qua khong
        // nam o cai nhan: vai tro di thang vao cau lenh tao anh, nen mot bo do
        // day du van bi ta thanh bon mon phu kien.
        category: moi.category,
        color_slug: moi.colorSlug || null,
        available_color_slugs: moi.availableColorSlugs,
        price_vnd: Number(moi.price.replace(/\D/g, '')) || null,
        price_checked_at: moi.price ? new Date().toISOString() : null,
        image_url: moi.imageUrl.trim() || null,
        source_platform: check.platform,
        source_url: moi.url.trim(),
        created_by: uid,
      })
      .select('id')
      .single();

    if (e1 || !product) { setAddBusy(false); setAddNote(`Sản phẩm: ${e1?.message}`); return; }

    const { data: link, error: e2 } = await sb
      .from('affiliate_links')
      .insert({
        product_id: product.id,
        owner_id: uid,
        platform: check.platform,
        url: moi.url.trim(),
      })
      .select('id')
      .single();

    if (e2 || !link) { setAddBusy(false); setAddNote(`Link: ${e2?.message}`); return; }

    const viTri = Math.max(-1, ...items.map((x) => x.position)) + 1;

    const { error: e3 } = await sb.from('outfit_items').insert({
      outfit_id: outfitId,
      product_id: product.id,
      affiliate_link_id: link.id,
      role: moi.role,
      position: viTri,
    });

    setAddBusy(false);
    if (e3) { setAddNote(`Gán vào set: ${e3.message}`); return; }

    setAdding(false);
    setAddNote(null);
    setMoi({
      url: '', name: '', price: '', imageUrl: '',
      category: 'ao', role: 'top', colorSlug: '', availableColorSlugs: [],
      imageChoices: [],
    });
    reload();
  };

  const save = async (item: OutfitWithItems['outfit_items'][number]) => {
    const sb = getSupabase();
    if (!sb) return;

    const d = draft[item.id];
    if (!d) return;

    // Kiem ten mien TRUOC khi gui. Database co trigger chan link la thu that
    // ngan duoc; kiem o day chi de bao loi bang tieng Viet ngay lap tuc thay vi
    // doi mot vong may chu roi nhan thong bao cua Postgres.
    if (d.affiliateUrl !== undefined) {
      const check = checkAffiliateUrl(d.affiliateUrl);
      if (!check.ok) { setSaveError(check.message); return; }
    }

    setBusyId(item.id);
    setSaveError(null);

    if (item.products) {
      const patch: Record<string, unknown> = {};
      if (d.name !== undefined) patch.name = d.name.trim();
      if (d.imageUrl !== undefined) patch.image_url = d.imageUrl.trim();
      if (d.price !== undefined) patch.price_vnd = Number(d.price.replace(/\D/g, '')) || 0;
      if (d.category !== undefined) patch.category = d.category;
      if (d.sourceUrl !== undefined) patch.source_url = d.sourceUrl.trim() || null;
      // Chuoi rong -> null, khong phai chuoi rong: cot co rang buoc doi chieu
      // voi bang mau, va '' khong phai mot mau hop le.
      if (d.colorSlug !== undefined) patch.color_slug = d.colorSlug || null;
      if (d.availableColorSlugs !== undefined) patch.available_color_slugs = d.availableColorSlugs;

      if (Object.keys(patch).length > 0) {
        const { error: e } = await sb.from('products').update(patch).eq('id', item.products.id);
        if (e) { setBusyId(null); setSaveError(`Sản phẩm: ${e.message}`); return; }
      }
    }

    // Vai tro nam o bang outfit_items chu khong phai products: cung mot cai ao
    // co the la "áo" trong set nay va "áo khoác" trong set khac.
    if (d.role !== undefined) {
      const { error: e } = await sb
        .from('outfit_items')
        .update({ role: d.role })
        .eq('id', item.id);
      if (e) { setBusyId(null); setSaveError(`Vai trò: ${e.message}`); return; }
    }

    if (item.affiliate_links && d.affiliateUrl !== undefined) {
      const { error: e } = await sb
        .from('affiliate_links')
        .update({ url: d.affiliateUrl.trim() })
        .eq('id', item.affiliate_links.id);
      if (e) { setBusyId(null); setSaveError(`Link: ${e.message}`); return; }
    }

    setBusyId(null);
    setSavedId(item.id);
    setDraft((x) => { const n = { ...x }; delete n[item.id]; return n; });
    reload();
  };

  const oTitle = outfitDraft.title ?? data.title;
  const oDesc = outfitDraft.description ?? data.description ?? '';
  const oStyle = outfitDraft.styleSlug ?? data.style_slug ?? '';
  const oOcc = outfitDraft.occasionSlug ?? data.occasion_slug ?? '';
  const oColors = outfitDraft.colorSlugs ?? data.color_slugs ?? [];
  const outfitDirty = Object.keys(outfitDraft).length > 0;

  /*
    DAU VAO CHUNG cho ba bo sinh tu dong: dat ten, viet mo ta, dung cau lenh anh.

    Doc tu BAN NHAP dang go truoc, roi moi den du lieu da luu. Nho vay doi
    phong cach o o ben tren la ba nut duoi tu cap nhat theo ngay — khong phai
    bam Luu roi moi thay ket qua doi.

    Dung CHUNG mot bo ham voi trang tao bai (src/lib/outfitNaming.ts). Viet lai
    o day nghia la hai noi se dat ten theo hai kieu, va khong ai nhan ra cho
    den khi so hai bai canh nhau.
  */
  const nguyenLieu = {
    outfitTitle: oTitle,
    styleLabel: oStyle ? tax.styleLabel(oStyle) : '',
    occasionLabel: oOcc ? tax.occasionLabel(oOcc) : '',
    colorLabels: oColors.map((c) => tax.colorLabel(c)),
    items: items.map((it) => {
      // BAN NHAP TRUOC, DU LIEU DA LUU SAU — cho ca ba truong, khong chi ten.
      // Truoc day vai tro va mau chi doc tu du lieu da luu, nen dien mau cho
      // bon mon xong bam "Dat ten tu dong" van ra dung cai ten cu khong mau.
      const cs = draft[it.id]?.colorSlug ?? it.products?.color_slug ?? '';
      return {
        roleLabel: ITEM_ROLE_LABEL[draft[it.id]?.role ?? it.role],
        name: draft[it.id]?.name ?? it.products?.name ?? '',
        colorLabel: cs ? tax.colorLabel(cs) : undefined,
        // Tinh theo TUNG MON: set nua co anh nua khong thi cau lenh phai noi
        // dung mon nao co anh, mon nao dang phai ta bang chu.
        hasImage: Boolean(draft[it.id]?.imageUrl ?? it.products?.image_url),
      };
    }),
  };

  /** Mau gom tu cac mon — dung cho nut "Lấy màu từ các món" o khoi mau chu dao. */
  const mauTuCacMon = [...new Set(
    items
      .map((it) => draft[it.id]?.colorSlug ?? it.products?.color_slug ?? '')
      .filter(Boolean),
  )];

  const tenGoiY = datTenTheoQuyTac(nguyenLieu);
  const moTaGoiY = vietMoTaTheoQuyTac(nguyenLieu);
  const thieuTen = thieuGiDeDatTen(nguyenLieu);
  const thieuMoTa = thieuGiDeVietMoTa(nguyenLieu);

  const promptInput = {
    ...nguyenLieu,
    // Mau chu dao chua chon thi dung mau gom tu cac mon — cau lenh khong nen
    // im lang bo mat thong tin ma nguoi dung vua dien vao tung mon.
    colorLabels: bangMau(nguyenLieu),
    sceneId,
    modelTypeId,
    variation: promptLan,
  };

  /** Cau lenh dang hien: ban tu sua neu co, khong thi ban sinh tu du lieu. */
  const cauLenh = promptSua ?? buildImagePrompt(promptInput);
  const thieuAnh = monChuaCoAnh(promptInput);

  /** Anh cua tung mon, gui kem lam mau tham chieu cho AI. */
  const anhThamChieu = items
    .map((it) => draft[it.id]?.imageUrl ?? it.products?.image_url ?? '')
    .filter((u) => u && !laAnhMauTrong(u));

  /** Con thieu gi de bam duoc nut dung anh. Rong nghia la du. */
  const thieuDeDungAnh: string[] = (() => {
    const thieu: string[] = [];
    if (!creds.loading && !creds.activeFor(aiProvider as never, 'image')
        && !creds.activeFor(aiProvider as never, 'text')) {
      thieu.push(`Chưa có API key ${AI_PROVIDER_LABEL[aiProvider]} — dán vào ô ngay dưới.`);
    }
    if (items.length === 0) thieu.push('Set chưa có món nào.');
    for (const it of items) {
      const u = draft[it.id]?.imageUrl ?? it.products?.image_url ?? '';
      const ten = draft[it.id]?.name ?? it.products?.name ?? 'món này';
      if (!u) thieu.push(`"${ten.slice(0, 30)}" chưa có ảnh.`);
      else if (laAnhMauTrong(u)) {
        thieu.push(`"${ten.slice(0, 30)}" đang dùng ảnh mẫu ô vuông xám — dựng từ nó là mất tiền vô ích.`);
      }
    }
    return thieu;
  })();

  const dungAnh = async () => {
    setAiBusy(true);
    setAiMessage(null);

    const r = await requestAiImage({
      provider: aiProvider,
      // Gui DUNG cau lenh dang hien tren man hinh, ke ca ban da sua tay. Gui
      // mot cau lenh khac thu nguoi dung vua doc la dieu khong giai thich duoc.
      prompt: cauLenh,
      outfitId,
      referenceUrls: anhThamChieu,
    });

    setAiBusy(false);
    setAiMessage({ ok: r.ok, text: r.message });

    if (r.ok && r.urls.length) {
      setAiUrls(r.urls);
      // Gan ngay anh dau vao o anh dai dien. Nguoi ta vua bam nut dung anh dai
      // dien — bat bam them mot lan nua de "chon" no la mot buoc thua.
      setHeroDraft(r.urls[0]);
      setHeroSaved(false);
    }
  };

  /** Dat mot anh AI vua dung lam anh dai dien cua set. Van phai bam Luu. */
  const chonAnhAi = (u: string) => {
    setHeroDraft(u);
    setHeroSaved(false);
  };

  const patchOutfit = (p: typeof outfitDraft) => {
    setOutfitSaved(false);
    setOutfitDraft((x) => ({ ...x, ...p }));
  };

  return (
    <div className="flex flex-col gap-6">
      {saveError && <div className="notice notice-danger">{saveError}</div>}

      {/* ------------------------------------------------------------------ */}
      {/* Thong tin cua ca set                                               */}
      {/*                                                                     */}
      {/* Dat TREN cung vi day la thu quyet dinh set do hien o dau va cho ai: */}
      {/* phong cach, dip va mau chu dao la dau vao cua bo loc trang kham pha */}
      {/* va cua phep tinh hop menh. Sua sai mot mau la set hien sai cho voi  */}
      {/* moi nguoi dung, va truoc day khong co duong nao sua tu day.         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3 border p-4" style={{ borderColor: 'var(--line)' }}>
        <p className="eyebrow">Thông tin set đồ</p>

        {/*
          BA NUT SINH TU DONG, dung CHUNG bo ham voi trang tao bai.

          Deu chay bang QUY TAC, khong goi AI: khong can key, khong cho mang,
          khong ton tien, va cung mot dau vao luon cho cung ket qua. Mot cai ten
          set do chi can tra loi ba cau — phong cach gi, mau gi, mac dip nao —
          va ca ba deu dang nam san trong cac o ngay tren.
        */}
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="label mb-0">Tên set đồ</label>
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              disabled={!tenGoiY}
              onClick={() => tenGoiY && patchOutfit({ title: tenGoiY })}
              title={tenGoiY ? `Đặt thành: ${tenGoiY}` : thieuTen.join(' ')}
            >
              Đặt tên tự động
            </button>
          </div>
          <input
            className="field"
            name="outfit-title"
            autoComplete="off"
            value={oTitle}
            maxLength={120}
            onChange={(e) => patchOutfit({ title: e.target.value })}
          />
          {thieuTen.length > 0 && <p className="hint">Chưa đặt tên tự động được: {thieuTen.join(' ')}</p>}
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="label mb-0">Mô tả</label>
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              disabled={!moTaGoiY}
              onClick={() => moTaGoiY && patchOutfit({ description: moTaGoiY })}
              title={moTaGoiY ? 'Viết ngay từ các món trong set' : thieuMoTa.join(' ')}
            >
              Viết tự động
            </button>
          </div>
          <textarea
            className="field"
            rows={3}
            maxLength={600}
            value={oDesc}
            onChange={(e) => patchOutfit({ description: e.target.value })}
          />
          {thieuMoTa.length > 0 && <p className="hint">Chưa viết tự động được: {thieuMoTa.join(' ')}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Phong cách</label>
            <select
              className="field"
              value={oStyle}
              onChange={(e) => patchOutfit({ styleSlug: e.target.value })}
            >
              <option value="">— Chưa chọn —</option>
              {tax.styles.map((x) => <option key={x.slug} value={x.slug}>{x.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dịp sử dụng</label>
            <select
              className="field"
              value={oOcc}
              onChange={(e) => patchOutfit({ occasionSlug: e.target.value })}
            >
              <option value="">— Chưa chọn —</option>
              {tax.occasions.map((x) => <option key={x.slug} value={x.slug}>{x.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="label mb-0">Màu chủ đạo</label>
            {/*
              GOM MAU TU CAC MON.

              Mau cua ca set dung ra la tap hop mau cua nhung mon lam nen no.
              Truoc day phai doc mau tung mon roi tich tay trong 17 cai chip —
              va do la thao tac de bo qua nhat, nen mot nua danh muc tung nam
              im voi mang mau rong (migration 0028 phai di vet lai).

              Van ghi vao BAN NHAP chu khong luu ngay: van con phai bam Luu, va
              van bo bot duoc mau nao khong muon.
            */}
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              disabled={mauTuCacMon.length === 0}
              onClick={() => patchOutfit({ colorSlugs: mauTuCacMon })}
              title={
                mauTuCacMon.length
                  ? `Đặt thành: ${mauTuCacMon.map((c) => tax.colorLabel(c)).join(', ')}`
                  : 'Chưa món nào chọn màu.'
              }
            >
              Lấy màu từ các món
            </button>
          </div>
          <ColorPicker
            colors={tax.colors}
            selected={oColors}
            onChange={(xs) => patchOutfit({ colorSlugs: xs })}
            multiple
            max={3}
          />
          <p className="hint">
            Bộ lọc ở trang khám phá và phép tính hợp mệnh dùng đúng các màu chọn ở đây.
          </p>
        </div>

        {/*
          THANH LUU BAM DINH DAY KHOI.

          Nut nay von nam o cuoi khoi "Thong tin set do" — sau o ten, o mo ta,
          hai o chon va ca bang mau 18 mau co the xo ra. Nguoi sua ten set do
          go xong o tren cung thi nut Luu nam ngoai man hinh, va ket luan hop
          ly la "khong co nut luu" — dung nhu chu website bao.

          `sticky bottom-0` giu no dinh day khoi trong luc cuon, nen sua o nao
          cung thay duoc nut. Chi to nen khi CO thay doi chua luu: khong thi
          no chi la mot thanh thua che mat noi dung.
        */}
        <div
          className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-3 px-4 py-3"
          style={
            outfitDirty
              ? { background: 'var(--bg)', borderTop: '1px solid var(--line)' }
              : undefined
          }
        >
          <button
            type="button"
            className="btn btn-sm"
            disabled={!outfitDirty || outfitBusy}
            onClick={() => void saveOutfit()}
          >
            {outfitBusy ? 'Đang lưu…' : 'Lưu thông tin set'}
          </button>
          {outfitDirty && !outfitBusy && (
            <span className="text-xs" style={{ color: 'var(--color-warn, var(--fg))' }}>
              Có thay đổi chưa lưu
            </span>
          )}
          {outfitDirty && !outfitBusy && (
            <button type="button" className="btn btn-sm btn-quiet"
                    onClick={() => setOutfitDraft({})}>
              Hoàn tác
            </button>
          )}
          {outfitSaved && (
            <span className="text-xs" style={{ color: 'var(--color-ok)' }}>Đã lưu</span>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Anh dai dien cua ca set                                            */}
      {/*                                                                     */}
      {/* Dat TREN cac mon vi day la thu nguoi xem nhin thay dau tien o trang */}
      {/* chu va trang kham pha — anh mon le chi hien khi da bam vao bai.     */}
      {/* Doi anh dai dien cua bai DA DANG se dua bai quay lai cho duyet:     */}
      {/* trigger outfits_require_rereview() lam viec do, khong phai ma o day.*/}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4 border p-4 sm:flex-row" style={{ borderColor: 'var(--line)' }}>
        <div className="w-24 shrink-0">
          <div className="frame" style={{ aspectRatio: '4 / 5' }}>
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroUrl} alt="" />
            ) : (
              <div className="frame frame-empty absolute inset-0">—</div>
            )}
          </div>
          <p className="muted-2 mt-2 text-center text-xs">Ảnh bài</p>
        </div>

        <div className="flex-1">
          <label className="label">Ảnh đại diện của set</label>
          <UploadButton
            className="mb-2"
            label="Chọn ảnh từ máy"
            busy={heroBusy}
            maxBytes={IMAGE_LIMITS.outfit}
            onPick={(f) => void uploadHero(f)}
          />
          <input
            className="field"
            value={heroUrl}
            placeholder="Hoặc dán địa chỉ ảnh"
            onChange={(e) => { setHeroDraft(e.target.value); setHeroSaved(false); }}
          />

          {/*
            NUT DUNG ANH AI NAM NGAY DAY, canh o anh dai dien.

            Truoc day no nam trong khoi cau lenh phia tren VA chi hien ra sau
            khi bam "Tao cau lenh" — nen muon mot tam anh dai dien phai bam hai
            nut khong lien quan gi den nhau. Nguoi dung dang o o anh dai dien:
            do la luc ho can no.

            Khoi cau lenh phia tren van giu — o do co chon boi canh, dang nguoi
            mau, va xem/sua cau lenh. Day la duong tat cho viec hay lam nhat.
          */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-sm"
              disabled={aiBusy || thieuDeDungAnh.length > 0}
              onClick={() => void dungAnh()}
              title={thieuDeDungAnh.length ? `Chưa bấm được: ${thieuDeDungAnh[0]}`
                                           : 'Dựng ảnh từ ảnh thật của các món'}
            >
              {aiBusy ? 'Đang dựng ảnh…' : 'Dựng ảnh bằng AI'}
            </button>

            <select
              className="field w-auto"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AiProviderId)}
              aria-label="Dịch vụ AI"
            >
              <option value="xai">Grok — dựng đúng ảnh sản phẩm</option>
              <option value="gemini">Gemini — hạn mức ảnh bằng 0</option>
              <option value="openai">ChatGPT (OpenAI)</option>
            </select>

            <span className="muted-2 text-xs">
              Gửi kèm {anhThamChieu.length} ảnh sản phẩm thật. Ảnh dựng xong tự điền vào
              ô trên — vẫn phải bấm Lưu.
              {aiProvider === 'xai' && ' Khoảng 0,2 USD một ảnh.'}
            </span>
          </div>

          {thieuDeDungAnh.length > 0 && (
            <div className="notice mt-3">
              <p className="text-sm">Nút &ldquo;Dựng ảnh bằng AI&rdquo; chưa bấm được vì:</p>
              <ul className="muted mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
                {thieuDeDungAnh.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}

          {/* O nhap key nam NGAY DAY, canh cai nut can den no. Truoc day no
              nam trong khoi cau lenh phia tren va chi hien sau khi bam mo. */}
          <div className="mt-3">
            <AiKeyBox
              provider={aiProvider as never}
              purpose="image"
              active={creds.activeFor(aiProvider as never, 'image')
                ?? creds.activeFor(aiProvider as never, 'text')}
              sharedWithText={!creds.activeFor(aiProvider as never, 'image')
                && Boolean(creds.activeFor(aiProvider as never, 'text'))}
              loading={creds.loading}
              onChanged={creds.reload}
            />
          </div>

          {aiMessage && (
            <p className={aiMessage.ok ? 'hint' : 'hint-error'}>{aiMessage.text}</p>
          )}

          {aiUrls.length > 1 && (
            <div className="mt-3">
              <p className="eyebrow mb-2">Các ảnh vừa dựng — bấm để đổi</p>
              <ImagePicker urls={aiUrls} selected={heroUrl} onPick={chonAnhAi} label="" />
            </div>
          )}

        {/* ------------------------------------------------------------------ */}
        {/* Cau lenh tao anh                                                    */}
        {/*                                                                     */}
        {/* HOP RIENG, khong con nhet cuoi khoi thong tin set. O do no nam duoi */}
        {/* mot hang 17 chip mau va khong co tieu de, nen gan nhu khong ai thay */}
        {/* — chu website bao la "chua co" trong khi no da chay duoc.           */}
        {/*                                                                     */}
        {/* KHONG GOI AI o day: chi DUNG cau lenh roi cho chep, mien phi va      */}
        {/* khong can key. Phan lon nguoi dung se khong bao gio co API key.      */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-3 border p-4" style={{ borderColor: 'var(--line)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Câu lệnh tạo ảnh</p>
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              onClick={() => { setHienPrompt((v) => !v); setDaChep(false); }}
            >
              {hienPrompt ? 'Ẩn câu lệnh' : 'Tạo câu lệnh'}
            </button>
          </div>

          {!hienPrompt && (
            <p className="muted-2 text-sm">
              Dựng câu lệnh từ chính các trường ở trên — phong cách, dịp, màu, và từng
              món trong set. Chạy bằng quy tắc, không gọi AI nên không cần API key.
            </p>
          )}

          {hienPrompt && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Bối cảnh</label>
                  <select
                    className="field"
                    value={sceneId}
                    onChange={(e) => setSceneId(e.target.value)}
                  >
                    {SCENES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Dáng người mẫu</label>
                  <select
                    className="field"
                    value={modelTypeId}
                    onChange={(e) => setModelTypeId(e.target.value)}
                  >
                    {MODEL_TYPES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p className="eyebrow mb-2">Đang yêu cầu AI những gì</p>
                <ul className="muted flex flex-col gap-1 text-sm">
                  {explainPromptVi(promptInput).map((d, i) => <li key={i}>{d}</li>)}
                </ul>
                {thieuAnh.length > 0 && (
                  <p className="hint-error mt-2">
                    {thieuAnh.length === items.length
                      ? 'Chưa món nào có ảnh, nên câu lệnh chỉ tả bằng chữ — ảnh sinh ra sẽ không giống sản phẩm thật.'
                      : `Chưa có ảnh: ${thieuAnh.join(', ')}. Những món này chỉ được tả bằng chữ.`}
                    {' '}Thêm ảnh cho từng món ở dưới rồi bấm lại.
                  </p>
                )}
              </div>

              {/*
                SUA TAY DUOC. O nay tung la <pre> chi doc, nen muon them mot cau
                la phai chep ra ngoai roi sua o cho khac — va sua o cho khac thi
                lan sau quay lai khong con.

                Sua roi thi cau lenh KHONG tu dung lai nua, ke ca khi doi phong
                cach hay doi mau: tu ghi de len chu nguoi ta vua go la mat trang.
                Muon quay ve ban may sinh thi co nut "Dung lai theo du lieu".
              */}
              <div>
                <label className="label">Câu lệnh (tiếng Anh, sửa được)</label>
                <textarea
                  className="field font-mono text-xs"
                  rows={14}
                  value={cauLenh}
                  onChange={(e) => { setPromptSua(e.target.value); setDaChep(false); }}
                />
                <p className="hint">
                  Viết bằng tiếng Anh vì các mô hình tạo ảnh hiểu tiếng Anh tốt hơn hẳn —
                  lý do kỹ thuật, không phải thẩm mỹ. Phần tiếng Việt ở trên là bản dịch
                  để đọc.
                  {promptSua !== null && ' Bạn đã sửa tay nên câu lệnh không tự dựng lại nữa.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    // navigator.clipboard bi tu choi khi khong chay tren HTTPS.
                    // O chu ben tren van boi den chep tay duoc nen day khong phai
                    // ngo cut — nhung phai bao that thay vi bao "Da chep".
                    void navigator.clipboard?.writeText(cauLenh)
                      .then(() => setDaChep(true))
                      .catch(() => setSaveError('Trình duyệt không cho chép tự động. Bôi đen ô câu lệnh rồi chép tay.'));
                  }}
                >
                  {daChep ? 'Đã chép' : 'Chép câu lệnh'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-quiet"
                  onClick={() => { setPromptLan((n) => n + 1); setPromptSua(null); setDaChep(false); }}
                >
                  Đổi cách diễn đạt
                </button>
                {promptSua !== null && (
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    onClick={() => { setPromptSua(null); setDaChep(false); }}
                  >
                    Dựng lại theo dữ liệu
                  </button>
                )}
              </div>
            </>
          )}
        </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              className="btn btn-sm"
              disabled={!heroDirty || heroBusy}
              onClick={() => void saveHero()}
            >
              {heroBusy ? 'Đang lưu…' : 'Lưu ảnh đại diện'}
            </button>
            {heroDirty && !heroBusy && (
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                onClick={() => setHeroDraft(null)}
              >
                Hoàn tác
              </button>
            )}
            {heroSaved && (
              <span className="text-xs" style={{ color: 'var(--color-ok)' }}>Đã lưu</span>
            )}
          </div>

          {data.status === 'published' && (
            <p className="hint">
              Bài đang hiển thị công khai. Đổi ảnh đại diện sẽ đưa bài quay lại chờ duyệt —
              quy tắc nằm ở tầng database.
            </p>
          )}
        </div>
      </div>

      {items.length === 0 && (
        <p className="muted-2 text-sm">Set này chưa có sản phẩm nào.</p>
      )}

      {/* Thanh go nhieu mon, chi hien khi co tich. */}
      {chonMon.size > 0 && (
        <div
          className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border px-4 py-3"
          style={{ background: 'var(--bg)', borderColor: 'var(--line)' }}
        >
          <span className="text-sm font-medium">Đã chọn {chonMon.size} món</span>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={goNhieuBusy}
            onClick={() => void goCacMonDaChon()}
          >
            {goNhieuBusy ? 'Đang gỡ…' : `Gỡ ${chonMon.size} món`}
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={goNhieuBusy}
            onClick={() => setChonMon(new Set())}
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {items.map((it, index) => {
        const p = it.products;
        const d = draft[it.id] ?? {};
        const name = d.name ?? p?.name ?? '';
        const price = d.price ?? String(p?.price_vnd ?? '');
        const imageUrl = d.imageUrl ?? p?.image_url ?? '';
        const affiliateUrl = d.affiliateUrl ?? it.affiliate_links?.url ?? '';
        const sourceUrl = d.sourceUrl ?? p?.source_url ?? '';
        const category = d.category ?? p?.category ?? 'phu_kien';
        const role = d.role ?? it.role;
        const colorSlug = d.colorSlug ?? p?.color_slug ?? '';
        const banMau = d.availableColorSlugs ?? p?.available_color_slugs ?? [];
        const dirty = Object.keys(d).length > 0;
        const busy = busyId === it.id;

        return (
          <div
            key={it.id}
            className="flex flex-col gap-4 border p-4 sm:flex-row"
            style={{ borderColor: 'var(--line)' }}
          >
            <div className="w-24 shrink-0">
              <div className="frame frame-square">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" />
                ) : (
                  <div className="frame frame-empty absolute inset-0">—</div>
                )}
              </div>
              <p className="muted-2 mt-2 text-center text-xs">{ITEM_ROLE_LABEL[it.role]}</p>
              {/* O tich de go NHIEU mon mot lan. Mon nao cung co nut "Go mon
                  nay" rieng o duoi; o tich la duong danh cho luc phai go ba
                  bon mon, khi bam tung nut mot va xac nhan tung lan la met. */}
              <label className="muted-2 mt-2 flex items-center justify-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={chonMon.has(it.id)}
                  onChange={() => doiChonMon(it.id)}
                  aria-label={`Chọn ${name || 'món này'} để gỡ`}
                />
                Chọn
              </label>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Tên sản phẩm</label>
                <input
                  className="field"
                  value={name}
                  maxLength={200}
                  onChange={(e) => set(it.id, { name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Giá (đ)</label>
                <input
                  className="field"
                  value={price}
                  inputMode="numeric"
                  onChange={(e) => set(it.id, { price: e.target.value.replace(/\D/g, '') })}
                />
                <p className="hint">
                  {formatVnd(Number(price) || 0)}. Tổng giá của set được tính lại tự động.
                </p>
              </div>

              {/*
                LOAI VA VAI TRO.

                Doi Loai thi Vai tro tu doi theo — hai thu nay gan nhu luon di
                cung nhau, va bat chon hai lan cho cung mot y nghia la cach chac
                chan de mot trong hai bi bo quen.

                Van cho sua rieng Vai tro: mot cai ao khoac van la "Ao" ve loai,
                nhung trong set do nay no dong vai tro ao ngoai.
              */}
              <div>
                <label className="label">Loại</label>
                <select
                  className="field"
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value as ProductCategory;
                    set(it.id, { category: cat, role: roleFromCategory(cat) as ItemRole });
                  }}
                >
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Vai trò trong set</label>
                <select
                  className="field"
                  value={role}
                  onChange={(e) => set(it.id, { role: e.target.value as ItemRole })}
                >
                  {Object.entries(ITEM_ROLE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <p className="hint">
                  Vai trò này đi thẳng vào câu lệnh tạo ảnh và câu mô tả tự động.
                </p>
              </div>

              {/*
                HAI KHAI NIEM MAU KHAC NHAU — giong het trang tao bai, va phai
                giong het: gop lam mot thi hoac bo loc "mau trang" tra ve nhung
                set khong he co mau trang, hoac nguoi mua khong biet mon do con
                mau nao khac.
              */}
              <div>
                <label className="label">Màu dùng trong set</label>
                <ColorPicker
                  colors={tax.colors}
                  selected={colorSlug ? [colorSlug] : []}
                  onChange={(xs) => set(it.id, { colorSlug: xs[0] ?? '' })}
                />
                <p className="hint">
                  Màu thật sự có trong bộ đồ này. Nút &ldquo;Lấy màu từ các món&rdquo; ở
                  khối trên gom đúng các màu này thành màu chủ đạo của set.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="label">Các màu còn bán trên sàn</label>
                <ColorPicker
                  colors={tax.colors}
                  selected={banMau}
                  onChange={(xs) => set(it.id, { availableColorSlugs: xs })}
                  multiple
                />
                <p className="hint">
                  Chỉ để người xem biết link đó còn lựa chọn nào. Không ảnh hưởng tới bộ
                  lọc hay gợi ý theo mệnh.
                </p>
              </div>

              <div>
                <label className="label">Ảnh</label>
                <UploadButton
                  className="mb-2"
                  label="Chọn ảnh từ máy"
                  busy={busy}
                  maxBytes={IMAGE_LIMITS.product}
                  onPick={(f) => void uploadItemImage(it.id, f)}
                />
                <input
                  className="field"
                  value={imageUrl}
                  placeholder="Hoặc dán địa chỉ ảnh"
                  onChange={(e) => set(it.id, { imageUrl: e.target.value })}
                />
                {laAnhMauTrong(imageUrl) && (
                  <p className="hint-error">
                    Đây là ảnh mẫu (ô vuông xám), không phải ảnh sản phẩm thật. Dựng ảnh
                    AI từ nó là mất tiền vô ích — bấm &ldquo;Lấy thông tin&rdquo; để lấy
                    ảnh thật từ link.
                  </p>
                )}
              </div>

              {/* Cac anh doc duoc tu link — bam de chon anh dung cho mon nay. */}
              {(d.imageChoices?.length ?? 0) > 0 && (
                <div className="sm:col-span-2">
                  <ImagePicker
                    urls={d.imageChoices!}
                    selected={imageUrl}
                    onPick={(u) => set(it.id, { imageUrl: u })}
                    nutXacNhan="Đặt làm ảnh món"
                  />
                </div>
              )}

              {/*
                HAI O LINK, VA HAI O DEU LAY DUOC THONG TIN.

                  * Link thuong    — link san pham binh thuong, khong mang ma
                                     gioi thieu. Dung de doi chieu va de lay
                                     thong tin khi link tiep thi bi rut gon.
                  * Link affiliate — link co ma gioi thieu cua nguoi dang. DAY
                                     moi la link nguoi xem bam vao.

                Trang tao bai da co ca hai tu lau; khoi sua nay thi chi co mot,
                nen mot mon dang giu link thuong sai khong co duong nao sua.
              */}
              <div className="sm:col-span-2">
                <label className="label">Link thường (không có mã giới thiệu)</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="field"
                    value={sourceUrl}
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://shopee.vn/..."
                    onChange={(e) => set(it.id, { sourceUrl: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet shrink-0"
                    disabled={fetchingId === it.id || busy || !sourceUrl.trim()}
                    onClick={() => void fetchFromLink(it, 'thuong')}
                  >
                    {fetchingId === it.id ? 'Đang lấy…' : 'Lấy thông tin'}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="label">Link affiliate</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="field"
                    value={affiliateUrl}
                    inputMode="url"
                    onChange={(e) => set(it.id, { affiliateUrl: e.target.value })}
                  />
                  {/* Doc lai gia va anh tu san, ngay tai day. Gia tren san doi
                      lien tuc va nguoi ban cung thay anh — mot bai dang mot
                      thang truoc gan nhu chac chan dang hien gia sai. */}
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet shrink-0"
                    disabled={fetchingId === it.id || busy || !affiliateUrl.trim()}
                    onClick={() => void fetchFromLink(it)}
                  >
                    {fetchingId === it.id ? 'Đang lấy…' : 'Lấy thông tin'}
                  </button>
                </div>
                {fetchNote[it.id] && (
                  <p className="hint">{fetchNote[it.id]}</p>
                )}
                <p className="hint">
                  Chỉ nhận Shopee hoặc TikTok. Nút &ldquo;Lấy thông tin&rdquo; đọc{' '}
                  <strong>link đang nằm trong ô</strong> — dán link khác vào rồi bấm là
                  thay được cả món mà không phải xoá đi làm lại.
                </p>
              </div>

              <div className="flex items-center gap-3 sm:col-span-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!dirty || busy}
                  onClick={() => void save(it)}
                >
                  {busy ? 'Đang lưu…' : 'Lưu món này'}
                </button>
                {dirty && !busy && (
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    onClick={() =>
                      setDraft((x) => { const n = { ...x }; delete n[it.id]; return n; })
                    }
                  >
                    Hoàn tác
                  </button>
                )}
                {savedId === it.id && (
                  <span className="text-xs" style={{ color: 'var(--color-ok)' }}>Đã lưu</span>
                )}

                {/*
                  DOI THU TU. Luu NGAY chu khong qua ban nhap: day la mot thao
                  tac tren quan he giua hai dong, khong phai mot o chu — giu no
                  cho o ban nhap nghia la phai theo doi trang thai cua ca hai
                  mon cung luc va bam Luu o dung mot trong hai.
                */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    disabled={busy || index === 0}
                    title="Đưa lên trên"
                    onClick={() => void moveItem(index, -1)}
                  >
                    Lên
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-quiet"
                    disabled={busy || index === items.length - 1}
                    title="Đưa xuống dưới"
                    onClick={() => void moveItem(index, 1)}
                  >
                    Xuống
                  </button>
                </div>

                {/* Nut go dat CUOI HANG va tach ra bang ml-auto: no la thao tac
                    khong hoan lai duoc, nen no khong duoc nam canh nut Luu de
                    bam nham. */}
                <button
                  type="button"
                  className="btn btn-sm btn-quiet btn-danger ml-auto"
                  disabled={busy}
                  onClick={() => void removeItem(it)}
                >
                  Gỡ khỏi set
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ------------------------------------------------------------------ */}
      {/* Them mot mon moi vao set                                           */}
      {/*                                                                     */}
      {/* Dat CUOI danh sach vi do la cho no se xuat hien sau khi them. Dat o */}
      {/* dau thi mat phai di nguoc lai de tim mon vua tao.                   */}
      {/* ------------------------------------------------------------------ */}
      {!adding ? (
        <button
          type="button"
          className="btn btn-sm self-start"
          onClick={() => { setAdding(true); setAddNote(null); }}
        >
          Thêm món vào set
        </button>
      ) : (
        <div className="flex flex-col gap-3 border p-4" style={{ borderColor: 'var(--fg)' }}>
          <p className="eyebrow">Món mới</p>

          <div>
            <label className="label">Link Shopee hoặc TikTok</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className="field"
                value={moi.url}
                inputMode="url"
                placeholder="https://shopee.vn/..."
                onChange={(e) => setMoi((x) => ({ ...x, url: e.target.value }))}
              />
              <button
                type="button"
                className="btn btn-sm btn-quiet shrink-0"
                disabled={addBusy || !moi.url.trim()}
                onClick={() => void fetchForNew()}
              >
                {addBusy ? 'Đang lấy…' : 'Lấy thông tin'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Tên sản phẩm</label>
              <input
                className="field"
                value={moi.name}
                maxLength={200}
                onChange={(e) => setMoi((x) => ({ ...x, name: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">Loại</label>
              <select
                className="field"
                value={moi.category}
                onChange={(e) => {
                  const cat = e.target.value as ProductCategory;
                  setMoi((x) => ({ ...x, category: cat, role: roleFromCategory(cat) as ItemRole }));
                }}
              >
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Vai trò trong set</label>
              <select
                className="field"
                value={moi.role}
                onChange={(e) => setMoi((x) => ({ ...x, role: e.target.value as ItemRole }))}
              >
                {Object.entries(ITEM_ROLE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Màu dùng trong set</label>
              <ColorPicker
                colors={tax.colors}
                selected={moi.colorSlug ? [moi.colorSlug] : []}
                onChange={(xs) => setMoi((x) => ({ ...x, colorSlug: xs[0] ?? '' }))}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label">Các màu còn bán trên sàn</label>
              <ColorPicker
                colors={tax.colors}
                selected={moi.availableColorSlugs}
                onChange={(xs) => setMoi((x) => ({ ...x, availableColorSlugs: xs }))}
                multiple
              />
            </div>

            <div>
              <label className="label">Giá (đ)</label>
              <input
                className="field"
                value={moi.price}
                inputMode="numeric"
                onChange={(e) =>
                  setMoi((x) => ({ ...x, price: e.target.value.replace(/\D/g, '') }))
                }
              />
              <p className="hint">{formatVnd(Number(moi.price) || 0)}</p>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Ảnh</label>
              <UploadButton
                className="mb-2"
                label="Chọn ảnh từ máy"
                busy={addBusy}
                maxBytes={IMAGE_LIMITS.product}
                onPick={async (f) => {
                  const userId = session?.user.id;
                  if (!userId) { setAddNote('Cần đăng nhập để tải ảnh lên.'); return; }
                  setAddBusy(true);
                  const r = await uploadImage('product-images', userId, f);
                  setAddBusy(false);
                  if (!r.ok || !r.url) { setAddNote(r.message); return; }
                  setMoi((x) => ({ ...x, imageUrl: r.url! }));
                }}
              />
              <input
                className="field"
                value={moi.imageUrl}
                placeholder="Hoặc dán địa chỉ ảnh"
                onChange={(e) => setMoi((x) => ({ ...x, imageUrl: e.target.value }))}
              />
              {moi.imageChoices.length > 0 && (
                <div className="mt-3">
                  <ImagePicker
                    urls={moi.imageChoices}
                    selected={moi.imageUrl}
                    onPick={(u) => setMoi((x) => ({ ...x, imageUrl: u }))}
                  />
                </div>
              )}
            </div>
          </div>

          {addNote && <p className="hint">{addNote}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-sm"
              disabled={addBusy || !moi.name.trim() || !moi.url.trim()}
              onClick={() => void addItem()}
            >
              {addBusy ? 'Đang thêm…' : 'Thêm vào set'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-quiet"
              disabled={addBusy}
              onClick={() => {
                setAdding(false);
                setAddNote(null);
                setMoi({
      url: '', name: '', price: '', imageUrl: '',
      category: 'ao', role: 'top', colorSlug: '', availableColorSlugs: [],
      imageChoices: [],
    });
              }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
