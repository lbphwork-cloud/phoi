'use client';

/**
 * Trinh soan set do. Dung chung cho ca trang /tao-bai cua nguoi dung va trang
 * /admin/outfit cua quan tri vien — chi khac o quyen, ma quyen thi do RLS va
 * trigger trong database quyet dinh, khong phai do component nay.
 *
 * Luong luu:
 *   1. Upload anh (neu co) len Supabase Storage, thu muc mang ten user id.
 *   2. Tao/cap nhat dong outfits.
 *   3. Voi tung san pham: tao dong products, roi affiliate_links, roi outfit_items.
 *   4. Dat trang thai cuoi: 'draft', 'pending', hoac 'published'.
 *
 * THU TU CAC KHOI TREN MAN HINH: san pham truoc, thong tin set sau, anh dai
 * dien cuoi. Vi ca hai buoc sau deu CAN san pham da nhap xong — mo ta thi viet
 * theo cac mon, con AI dung anh thi lay chinh anh cua tung mon lam mau. Dat
 * chung len tren la moi nguoi lam nua chung roi phai cuon xuong nhap san pham,
 * cuon nguoc len lam tiep.
 *
 * Luu y quan trong: NGUOI DUNG THUONG khong the tu dat status = 'published'.
 * Trigger enforce_outfit_status() trong database chan viec do, va no kiem tra
 * lai bang is_trusted_context() chu khong tin gi o component nay. Quan tri vien
 * thi dat duoc — day la quyen co san trong database tu dau, nut "Dang ngay"
 * chi thoi khong bat ho di duong vong nua.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';
import { useAuth, useTaxonomy, useRateLimit } from '@/lib/hooks';
import { checkAffiliateUrl } from '@/lib/affiliate';
import {
  fetchProductFromUrl, guessCategory, guessColorSlug, platformFromUrl, roleFromCategory,
} from '@/lib/fetchProduct';
import { formatVnd, IMAGE_LIMITS, validateImageFile } from '@/lib/format';
import { uploadImage } from '@/lib/storage';
import { UploadButton } from '@/components/UploadButton';
import {
  SCENES, MODEL_TYPES, buildImagePrompt, requestAiImage,
  buildDescriptionPrompt, requestAiDescription, explainPromptVi,
  type AiProviderId,
} from '@/lib/aiImage';
import {
  useAiCredentials, useKeyInput, useLastAiError, testAiKey, deleteAiKey,
} from '@/lib/aiCredentials';
import { CATEGORY_LABEL, ITEM_ROLE_LABEL } from '@/lib/supabase/types';
import type { ItemRole, Platform, ProductCategory } from '@/lib/supabase/types';

/** Ten nha cung cap hien cho nguoi dung. */
const PROVIDER_LABEL: Record<AiProviderId, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
};

/** Lay key o dau, va tra tien hay khong. */
const PROVIDER_KEY_NOTE: Record<AiProviderId, string> = {
  gemini:
    'Lấy key miễn phí ở aistudio.google.com/apikey — bấm "Create API key". ' +
    'Không cần thẻ tín dụng.',
  openai:
    'Lấy key ở platform.openai.com/api-keys. Tạo ảnh là dịch vụ trả tiền, ' +
    'tính theo từng ảnh.',
};

interface DraftItem {
  /** Khoa tam trong giao dien, khong phai id trong database */
  key: string;
  name: string;
  category: ProductCategory;
  role: ItemRole;
  colorSlug: string;
  priceVnd: string;
  imageUrl: string;
  affiliateUrl: string;
  platform: Platform | null;
  /**
   * Du lieu tori tu dau. Dung ten thay vi so vi tung co bug o day: gia tri 0
   * (tien ich Chrome) la falsy nen bi hien thanh loi mau do.
   */
  source: 'edge' | 'helper' | 'extension' | null;
  fetchNote: string;
  busy: boolean;
}

/**
 * Doc du lieu san pham do tien ich Chrome gui tori qua phan hash cua URL.
 *
 * Tien ich mo trang nay voi #phoi=<base64 JSON>. Dat o HASH chu khong phai
 * query string la co y: phan hash KHONG duoc gui len may chu trong yeu cau
 * HTTP, nen du lieu san pham khong nam trong log truy cap cua Cloudflare hay
 * bat ky may chu trung gian nao.
 *
 * Ham nay o cap module (khong nam trong component) de goi duoc tu ham khoi tao
 * state — nho vay form co du lieu ngay tu lan render dau, khong can effect.
 */
function readExtensionPayload(): { item: DraftItem | null; error: string | null } {
  if (typeof window === 'undefined') return { item: null, error: null };

  const m = /[#&]phoi=([^&]+)/.exec(window.location.hash);
  if (!m) return { item: null, error: null };

  try {
    const raw = decodeURIComponent(escape(atob(m[1])));
    const d = JSON.parse(raw) as {
      name?: string;
      price_vnd?: number | null;
      image_url?: string | null;
      url?: string;
      platform?: Platform | null;
    };

    if (!d?.name || !d?.url) return { item: null, error: null };

    // Kiem tra ten mien ngay ca voi du lieu tu tien ich cua chinh minh: tien ich
    // co the bi sua, va hash trong URL thi ai cung go duoc bang tay.
    const check = checkAffiliateUrl(d.url);
    if (!check.ok) {
      return { item: null, error: `Tiện ích gửi một link không hợp lệ: ${check.message}` };
    }

    const cat = guessCategory(d.name) as ProductCategory;

    return {
      item: {
        ...newItem(),
        name: d.name,
        category: cat,
        role: roleFromCategory(cat) as ItemRole,
        priceVnd: d.price_vnd ? String(d.price_vnd) : '',
        imageUrl: d.image_url ?? '',
        affiliateUrl: d.url,
        platform: d.platform ?? check.platform,
        source: 'extension',
        fetchNote: 'Nhận từ tiện ích Chrome. Kiểm tra lại giá rồi bổ sung màu.',
      },
      error: null,
    };
  } catch {
    return {
      item: null,
      error: 'Không đọc được dữ liệu từ tiện ích Chrome. Bạn nhập tay nhé.',
    };
  }
}

let keySeq = 0;
const newItem = (): DraftItem => ({
  key: `item-${++keySeq}`,
  name: '', category: 'ao', role: 'top', colorSlug: '',
  priceVnd: '', imageUrl: '', affiliateUrl: '', platform: null,
  source: null, fetchNote: '', busy: false,
});

export function OutfitEditor({ asAdmin = false }: { asAdmin?: boolean }) {
  const router = useRouter();
  const { session } = useAuth();
  const tax = useTaxonomy();
  const limitSubmit = useRateLimit('submit-outfit', 10, 60 * 60 * 1000);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [styleSlug, setStyleSlug] = useState('');
  const [occasionSlug, setOccasionSlug] = useState('');
  const [colorSlugs, setColorSlugs] = useState<string[]>([]);
  const [aiGenerated, setAiGenerated] = useState(false);

  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroPreview, setHeroPreview] = useState<string>('');
  const [heroError, setHeroError] = useState<string | null>(null);

  // Anh tung mon: tai len ngay, nen can biet mon nao dang tai.
  const [itemUploading, setItemUploading] = useState<string | null>(null);
  const [itemUploadError, setItemUploadError] = useState<string | null>(null);

  // Tao anh bang AI. `heroUrlDirect` la anh AI da chon: no da nam tren
  // Storage roi nen khong phai tai len lai luc luu.
  const [aiProvider, setAiProvider] = useState<AiProviderId>('gemini');
  const [sceneId, setSceneId] = useState<string>(SCENES[0].id);
  const [modelTypeId, setModelTypeId] = useState<string>(MODEL_TYPES[1].id);
  const [aiBusy, setAiBusy] = useState(false);
  // Ket qua lan goi AI gan nhat. Giu ca CO THANH CONG HAY KHONG chu khong
  // chi giu chu: that bai ma hien bang mot dong chu xam nho nhu luc thanh
  // cong thi nguoi dung tuong nut hong, khong biet la Google tu choi.
  const [aiMessage, setAiMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiUrls, setAiUrls] = useState<string[]>([]);
  const [heroUrlDirect, setHeroUrlDirect] = useState<string>('');
  // Moi lan bam "Tao lai" tang len 1 de cau lenh doi nhe — xem VARIATIONS
  // trong src/lib/aiImage.ts.
  const [aiRound, setAiRound] = useState(0);
  const [descBusy, setDescBusy] = useState(false);
  const [descMessage, setDescMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPromptVi, setShowPromptVi] = useState(false);
  const [showRawPrompt, setShowRawPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  // Key AI cua chinh nguoi dang dang nhap. Quyet dinh nut tao anh co bam duoc
  // hay khong — xem aiReady ben duoi.
  const creds = useAiCredentials();
  const keyInput = useKeyInput(creds.reload);
  const credsLoading = creds.loading;
  const activeCred = creds.activeFor(aiProvider);
  const lastAiError = useLastAiError(aiProvider);

  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyProbe, setKeyProbe] = useState<{ ok: boolean; text: string } | null>(null);

  // Ket qua moi nhat, du den tu luc luu key hay luc bam "Thu key".
  const keyMessage = keyProbe ?? keyInput.message;

  const probeKey = async () => {
    setKeyBusy(true);
    setKeyProbe(null);
    const r = await testAiKey(aiProvider);
    setKeyBusy(false);
    setKeyProbe({ ok: r.ok, text: r.message });
  };

  const removeKey = async () => {
    if (!activeCred) return;
    if (!window.confirm(`Xoá key ${activeCred.key_hint}? Bạn sẽ phải dán lại key mới.`)) return;

    setKeyBusy(true);
    const r = await deleteAiKey(activeCred.id);
    setKeyBusy(false);
    setKeyProbe({ ok: r.ok, text: r.message });
    if (r.ok) { creds.reload(); setShowKeyInput(true); }
  };

  // Doc du lieu tu tien ich Chrome NGAY TRONG ham khoi tao state.
  //
  // Truoc day viec nay nam trong useEffect va goi setItems — tuc la setState
  // dong bo trong effect, cong them mot vong render du thua va mot khoanh khac
  // form hien trong roi moi dien. Doc trong ham khoi tao thi form co du lieu
  // ngay tu lan render dau.
  const [extension] = useState(readExtensionPayload);
  const [items, setItems] = useState<DraftItem[]>(() =>
    extension.item ? [extension.item] : [newItem()],
  );
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(extension.error);

  const patch = (key: string, p: Partial<DraftItem>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  // Don hash sau khi da doc, de bam tai lai trang khong dien lai lan nua.
  // history.replaceState la tac dong ra ngoai React, khong phai setState — nen
  // dat trong effect la dung cho.
  useEffect(() => {
    if (window.location.hash.includes('phoi=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Anh dai dien
  // -------------------------------------------------------------------------

  const pickHero = (f: File | null) => {
    setHeroError(null);
    if (!f) { setHeroFile(null); setHeroPreview(''); return; }

    // Kiem tra o day chi de bao loi som. Gioi han THAT nam o cap bucket
    // Supabase (file_size_limit + allowed_mime_types trong 0004_storage.sql).
    const v = validateImageFile(f, IMAGE_LIMITS.outfit);
    if (!v.ok) { setHeroError(v.message); return; }

    setHeroFile(f);
    setHeroPreview(URL.createObjectURL(f));
  };

  const uploadHero = async (uid: string): Promise<string | null> => {
    if (!heroFile) return null;
    const r = await uploadImage('outfit-images', uid, heroFile);
    if (!r.ok) throw new Error(r.message);
    return r.url;
  };

  /**
   * Tai anh cho MOT mon len ngay lap tuc.
   *
   * Khac anh dai dien: anh dai dien doi den luc bam Luu moi tai len, vi luc do
   * moi biet bai co duoc tao khong. Anh tung mon tai ngay de nguoi dung thay
   * duoc no truoc khi bam tao anh AI — cai nut do can co anh that de tham chieu.
   */
  /**
   * Goi AI dung anh set do tu chinh du lieu dang nhap trong form.
   *
   * Cau lenh duoc dung tu ten cac mon, mau, phong cach va dip — nen anh ra bam
   * theo bai nay chu khong phai mot anh thoi trang chung chung.
   */
  /**
   * Du kien tao anh AI duoc chua, va con thieu gi.
   *
   * DIEU KIEN COT LOI: moi mon DA NHAP deu phai co anh. Set khong can du
   * ao-quan-giay — thieu vai tro nao thi cau lenh tu bu mot mon trung tinh
   * (xem fillersFor trong src/lib/aiImage.ts). Nhung mon da nhap ma khong co
   * anh thi mo hinh phai tu bia, va cai no bia se khong giong mon that.
   */
  const aiReady = (() => {
    const named = items.filter((i) => i.name.trim());
    const missing: string[] = [];

    // Dieu kien dau tien va de sua nhat: co key chua. Truoc day khong kiem o
    // day nen nut luon bam duoc, bam xong doi mot luc roi nhan loi tu Google.
    if (!credsLoading && !activeCred) {
      missing.push(`Chưa có API key ${PROVIDER_LABEL[aiProvider]} — dán vào ô ngay trên.`);
    }
    if (named.length === 0) {
      missing.push('Chưa nhập món nào. AI cần biết dựng gì.');
    }
    for (const i of named) {
      if (!i.imageUrl.trim()) {
        missing.push(`"${i.name.trim()}" chưa có ảnh — lấy từ link hoặc tự tải lên.`);
      }
    }
    if (!styleSlug) missing.push('Chưa chọn phong cách cho set.');

    return { ok: missing.length === 0, missing };
  })();

  /**
   * Du kien viet mo ta duoc chua, va con thieu gi.
   *
   * Nhe hon dieu kien cua tao anh: viet chu thi khong can anh cua tung mon,
   * chi can biet TEN cac mon va phong cach. Nhung van can key, vi khong co key
   * thi bam xong chi nhan mot loi.
   */
  const descReady = (() => {
    const missing: string[] = [];
    if (!credsLoading && !activeCred) {
      missing.push(`Chưa có API key ${PROVIDER_LABEL[aiProvider]} — dán vào ô dưới phần ảnh đại diện.`);
    }
    if (items.every((i) => !i.name.trim())) {
      missing.push('Chưa nhập món nào. AI cần biết viết về cái gì.');
    }
    if (!styleSlug) missing.push('Chưa chọn phong cách cho set.');
    return { ok: missing.length === 0, missing };
  })();

  /**
   * Du kien LAY CAU LENH duoc chua.
   *
   * Nhe hon han dieu kien tao anh: khong can key AI, khong can moi mon deu co
   * anh. Chi can MOT mon da dien du ten, mau va gia — du de cau lenh mo ta duoc
   * mot bo do that chu khong phai mot bo do chung chung.
   *
   * VI SAO CO DUONG NAY
   *   Key AI la thu khong phai ai cung co, va voi nhieu nguoi thi di lay key la
   *   mot rao can lon hon han viec dan mot doan chu vao ChatGPT. Duong nay cho
   *   ho dung dung cong cu ho da co san.
   */
  const promptReady = (() => {
    const full = items.filter((i) => i.name.trim() && i.colorSlug && i.priceVnd.trim());
    const missing: string[] = [];
    if (full.length === 0) {
      missing.push('Cần ít nhất một sản phẩm đã điền đủ tên, màu và giá.');
    }
    if (!styleSlug) missing.push('Chưa chọn phong cách cho set.');
    return { ok: missing.length === 0, missing };
  })();

  /** Du lieu dung chung cho ca cau lenh tao anh lan cau lenh viet mo ta. */
  const promptInput = () => ({
    outfitTitle: title,
    styleLabel: tax.styleLabel(styleSlug),
    occasionLabel: tax.occasionLabel(occasionSlug),
    colorLabels: colorSlugs.map((s) => tax.colorLabel(s)),
    items: items
      .filter((i) => i.name.trim())
      .map((i) => ({
        roleLabel: ITEM_ROLE_LABEL[i.role],
        name: i.name.trim(),
        colorLabel: i.colorSlug ? tax.colorLabel(i.colorSlug) : undefined,
      })),
    sceneId,
    modelTypeId,
    hasReferences: true,
    variation: aiRound,
  });

  /** AI viet mo ta bang tieng Viet. Ket qua la BAN NHAP, nguoi dung sua lai. */
  const generateDescription = async () => {
    setDescBusy(true);
    setDescMessage(null);
    const r = await requestAiDescription({
      provider: aiProvider,
      prompt: buildDescriptionPrompt(promptInput()),
    });
    setDescBusy(false);
    setDescMessage({ ok: r.ok, text: r.message });
    if (r.ok && r.text) setDescription(r.text);
  };

  const generateAiImage = async () => {
    setAiBusy(true);
    setAiMessage(null);

    const prompt = buildImagePrompt(promptInput());

    const r = await requestAiImage({
      provider: aiProvider,
      prompt,
      // Anh cua tung mon lam mau tham chieu. Day la ly do nut nay bi khoa
      // cho den khi moi mon deu co anh.
      referenceUrls: items.map((i) => i.imageUrl).filter(Boolean),
    });
    setAiBusy(false);
    setAiMessage({ ok: r.ok, text: r.message });

    if (r.ok && r.urls.length > 0) setAiUrls(r.urls);
  };

  const uploadItemImage = async (it: DraftItem, file: File) => {
    const userId = session?.user.id;
    if (!userId) { setItemUploadError('Cần đăng nhập để tải ảnh lên.'); return; }

    setItemUploading(it.key);
    setItemUploadError(null);

    const r = await uploadImage('product-images', userId, file);
    setItemUploading(null);

    if (!r.ok || !r.url) { setItemUploadError(r.message); return; }
    patch(it.key, { imageUrl: r.url });
  };

  // -------------------------------------------------------------------------
  // Lay du lieu tu link
  // -------------------------------------------------------------------------

  const runFetch = async (it: DraftItem) => {
    const check = checkAffiliateUrl(it.affiliateUrl);
    if (!check.ok) {
      patch(it.key, { fetchNote: check.message, source: null });
      return;
    }

    patch(it.key, { busy: true, fetchNote: 'Bắt đầu…', platform: check.platform });

    const out = await fetchProductFromUrl(it.affiliateUrl, session?.user.id ?? null, {
      onProgress: (m) => patch(it.key, { fetchNote: m }),
    });

    if (!out.ok || !out.data) {
      patch(it.key, { busy: false, fetchNote: out.message, source: null });
      return;
    }

    const d = out.data;
    const guessedCat = d.name ? (guessCategory(d.name) as ProductCategory) : it.category;

    patch(it.key, {
      busy: false,
      source: out.tier === 1 ? 'edge' : 'helper',
      fetchNote: out.message,
      // Chi dien vao o dang TRONG — khong ghi de thu nguoi dung da sua tay.
      name: it.name || d.name || '',
      priceVnd: it.priceVnd || (d.price_vnd ? String(d.price_vnd) : ''),
      imageUrl: it.imageUrl || d.image_url || '',
      // Chi dien mau khi nguoi dung CHUA chon: khong ghi de lua chon cua ho.
      colorSlug: it.colorSlug || guessColorSlug(d.name ?? '') || '',
      category: it.name ? it.category : guessedCat,
      role: it.name ? it.role : (roleFromCategory(guessedCat) as ItemRole),
      platform: d.platform ?? check.platform,
    });
  };

  // -------------------------------------------------------------------------
  // Luu
  // -------------------------------------------------------------------------

  const validate = (): string | null => {
    if (!title.trim()) return 'Chưa đặt tên cho set đồ.';
    if (!styleSlug) return 'Chưa chọn phong cách.';
    if (!occasionSlug) return 'Chưa chọn dịp sử dụng.';
    if (colorSlugs.length === 0) return 'Chọn ít nhất một màu chủ đạo.';

    const real = items.filter((i) => i.name.trim() || i.affiliateUrl.trim());
    if (real.length === 0) return 'Thêm ít nhất một sản phẩm.';

    for (const [i, it] of real.entries()) {
      if (!it.name.trim()) return `Sản phẩm ${i + 1}: chưa có tên.`;
      if (!it.affiliateUrl.trim()) return `Sản phẩm ${i + 1}: chưa có link mua.`;
      const c = checkAffiliateUrl(it.affiliateUrl);
      if (!c.ok) return `Sản phẩm ${i + 1}: ${c.message}`;
      if (it.priceVnd && Number.isNaN(Number(it.priceVnd))) {
        return `Sản phẩm ${i + 1}: giá phải là số.`;
      }
    }
    return null;
  };

  /**
   * `draft`   — luu lai, chua ai thay.
   * `submit`  — gui quan tri vien duyet. Duong cua nguoi dung thuong.
   * `publish` — dang thang, khong qua duyet. CHI quan tri vien.
   */
  const save = async (mode: 'draft' | 'submit' | 'publish') => {
    const sb = getSupabase();
    if (!sb || !session) { setError('Cần đăng nhập.'); return; }

    const v = validate();
    if (v) { setError(v); return; }

    if (mode !== 'draft') {
      const rl = limitSubmit();
      if (!rl.allowed) {
        setError(`Bạn vừa gửi khá nhiều bài. Thử lại sau ${rl.retryAfterSec} giây.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    const uid = session.user.id;

    try {
      setProgress('Đang tải ảnh…');
      // Anh AI da nam tren Storage roi, khong phai tai len lai. Anh nguoi
      // dung tu chon tu may thi moi phai upload.
      const heroUrl = heroUrlDirect || (await uploadHero(uid));

      setProgress('Đang tạo set đồ…');
      const { data: outfit, error: e1 } = await sb
        .from('outfits')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          hero_image_url: heroUrl,
          style_slug: styleSlug,
          occasion_slug: occasionSlug,
          color_slugs: colorSlugs,
          author_id: uid,
          ai_generated: aiGenerated,
          // Luon tao o 'draft'. Chuyen sang 'pending' o buoc rieng ben duoi de
          // trigger dong dau moc submitted_at dung.
          status: 'draft',
        })
        .select('id, slug')
        .single();

      if (e1 || !outfit) throw new Error(e1?.message ?? 'Không tạo được set đồ.');

      const real = items.filter((i) => i.name.trim() && i.affiliateUrl.trim());

      for (const [idx, it] of real.entries()) {
        setProgress(`Đang lưu sản phẩm ${idx + 1}/${real.length}…`);

        const platform = it.platform ?? platformFromUrl(it.affiliateUrl);
        if (!platform) throw new Error(`Sản phẩm ${idx + 1}: không nhận ra sàn từ link.`);

        const { data: product, error: e2 } = await sb
          .from('products')
          .insert({
            name: it.name.trim(),
            category: it.category,
            color_slug: it.colorSlug || null,
            price_vnd: it.priceVnd ? Number(it.priceVnd) : null,
            price_checked_at: it.priceVnd ? new Date().toISOString() : null,
            image_url: it.imageUrl || null,
            source_platform: platform,
            source_url: it.affiliateUrl.trim(),
            created_by: uid,
            fetched_meta: it.source ? { source: it.source } : null,
          })
          .select('id')
          .single();

        if (e2 || !product) throw new Error(`Sản phẩm ${idx + 1}: ${e2?.message}`);

        // Link affiliate thuoc ve NGUOI DANG. Day la co che "nguoi dang huong
        // toan bo hoa hong": owner_id = chinh ho, va RLS khong cho ai khac sua.
        const { data: link, error: e3 } = await sb
          .from('affiliate_links')
          .insert({
            product_id: product.id,
            owner_id: uid,
            platform,
            url: it.affiliateUrl.trim(),
          })
          .select('id')
          .single();

        if (e3 || !link) throw new Error(`Sản phẩm ${idx + 1} (link): ${e3?.message}`);

        const { error: e4 } = await sb.from('outfit_items').insert({
          outfit_id: outfit.id,
          product_id: product.id,
          affiliate_link_id: link.id,
          role: it.role,
          position: idx,
        });

        if (e4) throw new Error(`Sản phẩm ${idx + 1} (gán vào set): ${e4.message}`);
      }

      if (mode !== 'draft') {
        // Quan tri vien dat thang 'published'. Trigger enforce_outfit_status()
        // van kiem tra lai bang is_trusted_context(), nen nut nay khong tu no
        // cap quyen gi ca — no chi thoi khong bat quan tri vien di duong vong.
        const next = mode === 'publish' ? 'published' : 'pending';
        setProgress(mode === 'publish' ? 'Đang đăng…' : 'Đang gửi duyệt…');

        const { error: e5 } = await sb
          .from('outfits')
          .update({ status: next })
          .eq('id', outfit.id);

        if (e5) {
          throw new Error(
            mode === 'publish'
              ? `Không đăng được: ${e5.message}`
              : `Không gửi duyệt được: ${e5.message}`,
          );
        }

        // Dang thang thi khong di qua trang kiem duyet, nen khong co gi tu ghi
        // nhat ky ho. Khong ghi thi sau nay nhin lai chi thay bai tu nhien co
        // mat o trang chu, khong biet ai cho len va luc nao.
        if (mode === 'publish') {
          await sb.rpc('log_admin_action', {
            p_action: 'outfit.status.published',
            p_entity_type: 'outfit',
            p_entity_id: outfit.id,
            p_detail: { from: 'draft', to: 'published', via: 'trinh-soan-bai' },
          });
        }
      }

      setProgress(null);
      router.push('/bai-cua-toi');
    } catch (e) {
      setSaving(false);
      setProgress(null);
      setError((e as Error).message);
    }
  };

  const totalPrice = items.reduce((s, i) => s + (Number(i.priceVnd) || 0), 0);

  return (
    <div className="flex flex-col gap-10">
      {/* ------------------------------------------------------------------ */}
      <Block
        title="Sản phẩm trong set"
        note="Dán link Shopee hoặc TikTok rồi bấm lấy thông tin. Nếu không lấy được, nhập tay — cách nào cũng hợp lệ."
      >
        <div className="flex flex-col gap-8">
          {items.map((it, idx) => (
            <div key={it.key} className="border p-4" style={{ borderColor: 'var(--line)' }}>
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow">Sản phẩm {idx + 1}</p>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}
                  >
                    Xoá
                  </button>
                )}
              </div>

              <label className="label">Link mua trên Shopee hoặc TikTok</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={it.affiliateUrl}
                  onChange={(e) => patch(it.key, { affiliateUrl: e.target.value, fetchNote: '' })}
                  className="field"
                  placeholder="https://shopee.vn/..."
                  inputMode="url"
                />
                <button
                  type="button"
                  className="btn btn-sm shrink-0"
                  disabled={it.busy || !it.affiliateUrl.trim()}
                  onClick={() => runFetch(it)}
                >
                  {it.busy ? 'Đang lấy…' : 'Lấy thông tin'}
                </button>
              </div>

              {it.fetchNote && (
                <p className={it.source ? 'hint' : 'hint-error'}>
                  {it.source === 'edge' && 'Bậc 1 · '}
                  {it.source === 'helper' && 'Bậc 2 (Local Helper) · '}
                  {it.source === 'extension' && 'Tiện ích Chrome · '}
                  {it.fetchNote}
                </p>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Tên sản phẩm</label>
                  <input
                    value={it.name}
                    onChange={(e) => patch(it.key, { name: e.target.value })}
                    className="field"
                    maxLength={200}
                    placeholder="Áo thun cotton trơn trắng form regular"
                  />
                </div>

                <div>
                  <label className="label">Loại</label>
                  <select
                    value={it.category}
                    onChange={(e) => {
                      const cat = e.target.value as ProductCategory;
                      patch(it.key, { category: cat, role: roleFromCategory(cat) as ItemRole });
                    }}
                    className="field"
                  >
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Vai trò trong set</label>
                  <select
                    value={it.role}
                    onChange={(e) => patch(it.key, { role: e.target.value as ItemRole })}
                    className="field"
                  >
                    {Object.entries(ITEM_ROLE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Màu</label>
                  <select
                    value={it.colorSlug}
                    onChange={(e) => patch(it.key, { colorSlug: e.target.value })}
                    className="field"
                  >
                    <option value="">— Không rõ —</option>
                    {tax.colors.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Giá (VNĐ)</label>
                  <input
                    value={it.priceVnd}
                    onChange={(e) => patch(it.key, { priceVnd: e.target.value.replace(/\D/g, '') })}
                    className="field"
                    inputMode="numeric"
                    placeholder="189000"
                  />
                </div>

                {/* Ba duong lay anh cho mot mon, xep theo do de dung:
                    1. Tu dien khi lay duoc tu link
                    2. Tu tai anh len — dung khi ban tu chup hoac tu lam anh
                    3. Dan dia chi anh — duong cuoi, cho anh da co san o noi khac

                    Duong 2 la thu truoc day thieu: nguoi dung khong co cach nao
                    dua anh cua CHINH HO vao tung mon, chi dan duoc dia chi. */}
                <div className="sm:col-span-2">
                  <label className="label">Ảnh sản phẩm</label>

                  <UploadButton
                    className="mb-2"
                    label="Chọn ảnh từ máy"
                    busy={itemUploading === it.key}
                    maxBytes={IMAGE_LIMITS.product}
                    onPick={(f) => void uploadItemImage(it, f)}
                  />

                  <input
                    value={it.imageUrl}
                    onChange={(e) => patch(it.key, { imageUrl: e.target.value })}
                    className="field"
                    placeholder="Tự điền khi lấy được từ link, hoặc dán địa chỉ ảnh"
                  />
                </div>
              </div>

              {it.imageUrl && (
                <div className="mt-4 w-24">
                  <div className="frame frame-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.imageUrl} alt="" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {itemUploadError && <p className="hint-error">{itemUploadError}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-sm" onClick={() => setItems((xs) => [...xs, newItem()])}>
            Thêm sản phẩm
          </button>
          {totalPrice > 0 && (
            <span className="muted-2 text-sm">Tổng tạm tính: {formatVnd(totalPrice)}</span>
          )}
        </div>
      </Block>

      {/* ------------------------------------------------------------------ */}
      <Block title="Thông tin set đồ">
        <label className="label" htmlFor="title">Tên set đồ</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field mb-5"
          maxLength={120}
          placeholder="Ví dụ: Tối giản trắng đen ngày thường"
        />

        {/* NHAN VA NUT TREN CUNG MOT DONG.
            Truoc day nut nay nam duoi o nhap va de kieu chu xam nhat khong
            vien — chu website bao thang la "chua co nut tao mo ta bang AI".
            Nut ma phai doc ky moi nhan ra thi coi nhu khong co. */}
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <label className="label mb-0" htmlFor="desc">Mô tả</label>
          <button
            type="button"
            className="btn btn-sm"
            disabled={descBusy || !descReady.ok}
            onClick={() => void generateDescription()}
          >
            {descBusy ? 'Đang viết…' : 'Viết mô tả bằng AI'}
          </button>
        </div>

        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field"
          rows={3}
          maxLength={600}
          placeholder="Vì sao cách phối này hợp lý. Một hai câu là đủ."
        />

        {/* Noi RO con thieu gi thay vi chi khoa nut roi de nguoi dung tu doan. */}
        {!descReady.ok && (
          <div className="notice mt-2">
            <p className="text-sm">Chưa viết được vì:</p>
            <ul className="muted mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
              {descReady.missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        )}

        {descMessage && (
          <div className={`mt-2 notice ${descMessage.ok ? '' : 'notice-danger'}`}>
            <p className="text-sm">{descMessage.text}</p>
          </div>
        )}

        <p className="hint mb-5">
          AI viết dựa trên các món và phong cách bạn đã nhập. Kết quả là{' '}
          <strong>bản nháp</strong> — đọc lại và sửa cho đúng ý bạn trước khi đăng.
        </p>

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="style">Phong cách</label>
            <select id="style" value={styleSlug} onChange={(e) => setStyleSlug(e.target.value)} className="field">
              <option value="">— Chọn —</option>
              {tax.styles.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="occ">Dịp sử dụng</label>
            <select id="occ" value={occasionSlug} onChange={(e) => setOccasionSlug(e.target.value)} className="field">
              <option value="">— Chọn —</option>
              {tax.occasions.map((o) => <option key={o.slug} value={o.slug}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <p className="label">Màu chủ đạo</p>
        <div className="flex flex-wrap gap-2">
          {tax.colors.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="chip"
              aria-pressed={colorSlugs.includes(c.slug)}
              onClick={() =>
                setColorSlugs((xs) =>
                  xs.includes(c.slug) ? xs.filter((x) => x !== c.slug) : [...xs, c.slug],
                )
              }
            >
              <span className="swatch" style={{ background: c.hex }} />
              {c.label}
            </button>
          ))}
        </div>
        <p className="hint">Bộ lọc và gợi ý theo mệnh dùng đúng các màu bạn chọn ở đây.</p>
      </Block>

      {/* ------------------------------------------------------------------ */}
      <Block title="Ảnh đại diện" note="Ảnh lớn hiện ở đầu bài. Tối đa 5 MB, định dạng JPG, PNG, WebP hoặc AVIF.">
        <UploadButton
          label="Chọn ảnh đại diện từ máy"
          maxBytes={IMAGE_LIMITS.outfit}
          onPick={(f) => pickHero(f)}
        />
        {heroError && <p className="hint-error">{heroError}</p>}

        {heroPreview && (
          <div className="mt-4 max-w-sm">
            <div className="frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPreview} alt="Xem trước ảnh đại diện" />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Tao anh set do bang AI                                            */}
        {/*                                                                   */}
        {/* Day la duong TUY CHON. Ai khong muon dung AI thi tai anh cua minh */}
        {/* len o tren, hoac de trong — bai van dang duoc. Khong bao gio bat  */}
        {/* buoc phai co key AI moi dung duoc website.                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
          <p className="eyebrow mb-3">Hoặc để AI dựng ảnh set đồ</p>
          <p className="hint mb-4">
            AI dựng một ảnh minh hoạ theo phong cách, màu và các món bạn đã nhập.
            Ảnh sinh ra là <strong>ảnh minh hoạ</strong>, không phải ảnh sản phẩm thật:
            nó không giữ đúng logo, chữ in hay hoạ tiết nhỏ. Ảnh luôn được gắn nhãn
            &ldquo;Ảnh tạo bởi AI&rdquo; và vẫn phải qua kiểm duyệt.
          </p>

          {/* ------------------------------------------------------------ */}
          {/* API key cua chinh ban                                        */}
          {/*                                                              */}
          {/* Dat NGAY TAI DAY chu khong o mot trang quan tri rieng. Cai   */}
          {/* thieu de bam duoc nut phai nam canh cai nut do.              */}
          {/*                                                              */}
          {/* LUON CO DUONG DOI KEY, ke ca khi da co key.                  */}
          {/* Ban dau toi an o nhap di khi tai khoan da co key — nghe hop  */}
          {/* ly, nhung KEY HONG TRONG Y HET KEY TOT. Dung tinh canh hien  */}
          {/* gio: co key, key vo dung vi han muc bang 0, va khong co       */}
          {/* duong nao thay ma khong roi trang.                            */}
          {/* ------------------------------------------------------------ */}
          <div className="notice mb-5">
            {credsLoading ? (
              <p className="muted text-sm">Đang kiểm tra key…</p>
            ) : (
              <>
                {activeCred ? (
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm">
                      Key {PROVIDER_LABEL[aiProvider]}: <code>{activeCred.key_hint}</code>
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      disabled={keyBusy}
                      onClick={() => void probeKey()}
                    >
                      {keyBusy ? 'Đang thử…' : 'Thử key'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      onClick={() => setShowKeyInput((v) => !v)}
                    >
                      {showKeyInput ? 'Thôi' : 'Đổi key'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet btn-danger"
                      disabled={keyBusy}
                      onClick={() => void removeKey()}
                    >
                      Xoá key
                    </button>
                  </div>
                ) : (
                  <p className="mb-3 text-sm">
                    Tài khoản bạn <strong>chưa có key {PROVIDER_LABEL[aiProvider]}</strong>.
                    Mỗi người dùng key của chính mình, nên tiền dùng AI tính vào tài khoản
                    bạn chứ không phải của ai khác.
                  </p>
                )}

                {/* Loi gan nhat cua nha cung cap. Day la thu duy nhat phan biet
                    duoc key con song va key da chet ma khong phai bam thu. */}
                {activeCred && lastAiError && !keyMessage && (
                  <p className="hint-error">Lần gọi gần nhất thất bại: {lastAiError}</p>
                )}

                {(!activeCred || showKeyInput) && (
                  <>
                    <p className="hint mb-3">{PROVIDER_KEY_NOTE[aiProvider]}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="password"
                        className="field"
                        value={keyInput.rawKey}
                        onChange={(e) => keyInput.setRawKey(e.target.value)}
                        placeholder="Dán API key vào đây"
                        autoComplete="off"
                        aria-label={`API key ${PROVIDER_LABEL[aiProvider]}`}
                      />
                      <button
                        type="button"
                        className="btn btn-sm shrink-0"
                        disabled={keyInput.busy || !keyInput.rawKey.trim()}
                        onClick={() => {
                          setShowKeyInput(false);
                          void keyInput.submit(aiProvider);
                        }}
                      >
                        {keyInput.busy ? 'Đang lưu và thử…' : 'Lưu key'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {keyMessage && (
              <p className={keyMessage.ok ? 'hint' : 'hint-error'}>{keyMessage.text}</p>
            )}
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ai-provider">Dịch vụ</label>
              <select
                id="ai-provider"
                className="field"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as AiProviderId)}
              >
                <option value="gemini">Gemini (có gói miễn phí)</option>
                <option value="openai">OpenAI (trả tiền mỗi ảnh)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ai-scene">Bối cảnh</label>
              <select
                id="ai-scene"
                className="field"
                value={sceneId}
                onChange={(e) => setSceneId(e.target.value)}
              >
                {SCENES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ai-model">Dáng người mẫu</label>
              <select
                id="ai-model"
                className="field"
                value={modelTypeId}
                onChange={(e) => setModelTypeId(e.target.value)}
              >
                {MODEL_TYPES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-sm"
              disabled={aiBusy || !aiReady.ok}
              onClick={() => { setAiRound(0); void generateAiImage(); }}
            >
              {aiBusy ? 'Đang tạo ảnh…' : 'Tạo ảnh set đồ bằng AI'}
            </button>

            {aiUrls.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                disabled={aiBusy || !aiReady.ok}
                onClick={() => { setAiRound((n) => n + 1); void generateAiImage(); }}
              >
                Tạo lại (khác đi)
              </button>
            )}
          </div>

          {/* Noi RO con thieu gi, thay vi chi khoa nut roi de nguoi dung tu doan. */}
          {!aiReady.ok && (
            <div className="notice mt-3">
              <p className="text-sm">Chưa tạo được ảnh vì:</p>
              <ul className="muted mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
                {aiReady.missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
              <p className="hint mt-2">
                AI dùng chính ảnh của từng món làm mẫu, nên món nào chưa có ảnh thì
                nó phải tự bịa ra — và cái nó bịa sẽ không giống món bạn bán.
              </p>
            </div>
          )}

          <button
            type="button"
            className="btn btn-sm btn-quiet ml-2"
            onClick={() => setShowPromptVi((v) => !v)}
          >
            {showPromptVi ? 'Ẩn yêu cầu gửi cho AI' : 'Xem yêu cầu gửi cho AI'}
          </button>

          {/* ------------------------------------------------------------ */}
          {/* LAY CAU LENH — duong danh cho nguoi khong co API key          */}
          {/* ------------------------------------------------------------ */}
          <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--line)' }}>
            <p className="eyebrow mb-2">Không có API key?</p>
            <p className="hint mb-3">
              Lấy câu lệnh rồi tự dán vào ChatGPT, Gemini hay bất kỳ công cụ tạo ảnh nào
              bạn đang dùng. Ảnh tạo xong thì <strong>tự tải lên</strong> ở ô phía trên —
              website không nhận được ảnh từ những công cụ đó.
            </p>

            <button
              type="button"
              className="btn btn-sm"
              disabled={!promptReady.ok}
              onClick={() => { setShowRawPrompt((v) => !v); setCopied(false); }}
            >
              {showRawPrompt ? 'Ẩn câu lệnh' : 'Lấy câu lệnh'}
            </button>

            {!promptReady.ok && (
              <div className="notice mt-3">
                <p className="text-sm">Chưa lấy được câu lệnh vì:</p>
                <ul className="muted mt-2 flex list-disc flex-col gap-1 pl-5 text-sm">
                  {promptReady.missing.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            )}

            {showRawPrompt && (
              <div className="mt-4">
                <textarea
                  readOnly
                  className="field"
                  rows={8}
                  value={buildImagePrompt({ ...promptInput(), hasReferences: false })}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      // navigator.clipboard co the bi tu choi (khong phai HTTPS,
                      // hoac nguoi dung chan quyen). O nhap ben tren van chon
                      // duoc bang tay, nen that bai o day khong phai ngo cut.
                      void navigator.clipboard
                        ?.writeText(buildImagePrompt({ ...promptInput(), hasReferences: false }))
                        .then(() => setCopied(true))
                        .catch(() => setCopied(false));
                    }}
                  >
                    Chép câu lệnh
                  </button>
                  {copied && (
                    <span className="text-xs" style={{ color: 'var(--color-ok)' }}>
                      Đã chép. Dán vào công cụ của bạn.
                    </span>
                  )}
                </div>
                <p className="hint mt-2">
                  Câu lệnh viết bằng tiếng Anh — các mô hình tạo ảnh hiểu tiếng Anh tốt hơn
                  hẳn. Bấm &ldquo;Xem yêu cầu gửi cho AI&rdquo; ở trên để đọc bản tiếng Việt.
                  Ảnh tự tạo bằng công cụ ngoài vẫn phải đánh dấu &ldquo;Ảnh do AI tạo&rdquo;
                  ở ô bên dưới.
                </p>
              </div>
            )}
          </div>

          {showPromptVi && (
            <div className="notice mt-4">
              <p className="eyebrow mb-2">Đang yêu cầu AI những gì</p>
              <ul className="muted flex list-disc flex-col gap-1 pl-5 text-sm">
                {explainPromptVi(promptInput()).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="hint mt-3">
                Câu lệnh thật gửi đi bằng tiếng Anh — các mô hình tạo ảnh hiểu tiếng Anh
                tốt hơn hẳn, viết tiếng Việt cho ra ảnh tệ hơn rõ rệt. Đây là bản dịch
                để bạn đọc, không phải thứ được gửi đi.
              </p>
            </div>
          )}

          {aiMessage && (
            <div className={`mt-4 notice ${aiMessage.ok ? '' : 'notice-danger'}`}>
              <p className="text-sm">{aiMessage.text}</p>
            </div>
          )}

          {aiUrls.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {aiUrls.map((u) => (
                <button
                  key={u}
                  type="button"
                  className="w-32 text-left"
                  onClick={() => { setHeroPreview(u); setHeroUrlDirect(u); setAiGenerated(true); }}
                >
                  <div className="frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="Ảnh do AI tạo" />
                  </div>
                  <span className="muted-2 text-xs">Bấm để dùng ảnh này</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={aiGenerated}
            onChange={(e) => setAiGenerated(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            Ảnh này do AI tạo ra
            <span className="muted-2 block text-xs">
              Bắt buộc đánh dấu nếu đúng. Bài sẽ hiện nhãn &quot;Ảnh tạo bởi AI&quot; và
              một dòng lưu ý rằng ảnh không đảm bảo giống tuyệt đối sản phẩm thật.
            </span>
          </span>
        </label>
      </Block>

      {/* ------------------------------------------------------------------ */}
      {error && <div className="notice notice-danger">{error}</div>}
      {progress && <div className="notice">{progress}</div>}

      {/* QUAN TRI VIEN DANG THANG, KHONG TU GUI DUYET CHINH MINH.
          Truoc day ai cung phai qua buoc cho duyet, ke ca nguoi co quyen duyet
          — bat nguoi ta bam duyet chinh bai vua viet xong la mot buoc vo nghia.
          Dau vet kiem duyet van con: nut nay ghi thang vao nhat ky admin. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="btn flex-1"
          disabled={saving}
          onClick={() => save('draft')}
        >
          Lưu bản nháp
        </button>
        <button
          type="button"
          className="btn btn-solid flex-1"
          disabled={saving}
          onClick={() => save(asAdmin ? 'publish' : 'submit')}
        >
          {saving
            ? 'Đang xử lý…'
            : asAdmin
              ? 'Đăng ngay'
              : 'Gửi quản trị viên duyệt'}
        </button>
      </div>

      <p className="muted-2 text-xs leading-relaxed">
        {asAdmin
          ? 'Bạn là quản trị viên nên bài đăng thẳng, không qua bước chờ duyệt. Thao tác này vẫn được ghi vào nhật ký quản trị. Bài hiện ngay trong trang khám phá; riêng trang chi tiết của bài cần lần dựng trang kế tiếp mới có.'
          : 'Bài không hiển thị công khai ngay. Quản trị viên sẽ duyệt, hoặc yêu cầu sửa kèm lý do. Sau khi bài đã được duyệt, nếu bạn sửa ảnh, đổi sản phẩm hoặc đổi link thì bài tự động quay lại chờ duyệt — quy tắc này được thực thi ở tầng database nên không thể bỏ qua.'}
      </p>
    </div>
  );
}

function Block({
  title, note, children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="display-xs mb-1">{title}</h2>
      {note && <p className="muted-2 mb-4 text-sm">{note}</p>}
      <div className={note ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}
