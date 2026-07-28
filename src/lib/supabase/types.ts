/**
 * Kieu du lieu cua database, viet tay theo supabase/migrations/.
 *
 * Khi nao can sinh lai tu dong (sau khi doi schema nhieu):
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 * Nhung ban viet tay nay co uu diem: doc duoc, co chu thich, va khong can dang
 * nhap Supabase CLI trong giai doan dau.
 */

export type UserRole = 'user' | 'admin';
export type Platform = 'shopee' | 'tiktok';
export type NguHanhDb = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho';

export type ProductCategory =
  | 'ao' | 'quan' | 'giay' | 'tui' | 'dong_ho' | 'kinh' | 'mu' | 'phu_kien';

export type ItemRole =
  | 'top' | 'outerwear' | 'bottom' | 'shoes'
  | 'bag' | 'watch' | 'glasses' | 'hat' | 'accessory';

export type OutfitStatus =
  | 'draft' | 'pending' | 'needs_revision'
  | 'approved' | 'rejected' | 'published' | 'hidden';

export type FeedbackKind =
  | 'dislike_color' | 'dislike_style' | 'dislike_pairing' | 'hide_outfit';

export type JobStatus = 'pending' | 'claimed' | 'done' | 'failed' | 'cancelled';
export type ReviewAction = 'approve' | 'reject' | 'request_changes';
export type AiProvider = 'gemini' | 'openai' | 'local_comfyui';

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  ao: 'Áo', quan: 'Quần', giay: 'Giày', tui: 'Túi',
  dong_ho: 'Đồng hồ', kinh: 'Kính', mu: 'Mũ', phu_kien: 'Phụ kiện',
};

export const ITEM_ROLE_LABEL: Record<ItemRole, string> = {
  top: 'Áo', outerwear: 'Áo khoác', bottom: 'Quần', shoes: 'Giày',
  bag: 'Túi', watch: 'Đồng hồ', glasses: 'Kính', hat: 'Mũ',
  accessory: 'Phụ kiện',
};

export const STATUS_LABEL: Record<OutfitStatus, string> = {
  draft: 'Bản nháp',
  pending: 'Chờ duyệt',
  needs_revision: 'Cần sửa',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  published: 'Đang hiển thị',
  hidden: 'Đã ẩn',
};

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  bio: string | null;
  created_at: string;
}

export interface UserPrivate {
  user_id: string;
  birth_date: string | null;
  lunar_year: number | null;
  can_chi: string | null;
  element: NguHanhDb | null;
  element_label: string | null;
  element_enabled: boolean;
}

export interface UserPreferences {
  user_id: string;
  style_slugs: string[];
  color_slugs: string[];
  price_min_vnd: number;
  price_max_vnd: number;
  onboarded_at: string | null;
}

export interface Style {
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
}

export interface Color {
  slug: string;
  label: string;
  hex: string;
  element: NguHanhDb | null;
  sort_order: number;
}

export interface Occasion {
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  /** Mau THAT SU dung trong set do. Mot mau. Bo loc va phep tinh hop menh doc cot nay. */
  color_slug: string | null;
  /**
   * Cac mau chinh link do dang ban. Nhieu mau, CHI de nguoi mua biet con lua
   * chon nao — khong di vao bo loc, khong di vao phep tinh hop menh.
   *
   * Cot co tu migration 0025 nhung thieu o day, nen moi cho doc no deu phai ep
   * kieu. Mot cot da ton tai ma kieu du lieu khong biet la mot cot se bi quen.
   */
  available_color_slugs: string[];
  price_vnd: number | null;
  price_checked_at: string | null;
  image_url: string | null;
  source_platform: Platform | null;
  source_url: string | null;
  description: string | null;
  created_by: string | null;
  is_seed: boolean;
  created_at: string;
}

export interface AffiliateLink {
  id: string;
  product_id: string;
  owner_id: string | null;
  platform: Platform;
  url: string;
  resolved_url: string | null;
  resolved_host: string | null;
  last_checked_at: string | null;
  is_alive: boolean | null;
  is_active: boolean;
  is_seed: boolean;
}

export interface Outfit {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  hero_image_url: string | null;
  style_slug: string | null;
  occasion_slug: string | null;
  color_slugs: string[];
  total_price_vnd: number | null;
  status: OutfitStatus;
  author_id: string | null;
  ai_generated: boolean;
  ai_provider: AiProvider | null;
  is_seed: boolean;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  view_count: number;
  created_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  product_id: string;
  affiliate_link_id: string | null;
  role: ItemRole;
  position: number;
  note: string | null;
}

/** Outfit kem san pham, dang tra ve tu truy van co join. */
export interface OutfitWithItems extends Outfit {
  outfit_items: Array<
    OutfitItem & {
      products: Product | null;
      affiliate_links: AffiliateLink | null;
    }
  >;
}

export interface FeedbackEvent {
  id: string;
  user_id: string;
  outfit_id: string | null;
  kind: FeedbackKind;
  target_value: string | null;
  created_at: string;
}

export interface FetchJob {
  id: string;
  requested_by: string;
  source_url: string;
  status: JobStatus;
  tier: number | null;
  result: FetchJobResult | null;
  error: string | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
}

/** Ket qua Local Helper hoac Edge Function tra ve sau khi doc mot link. */
export interface FetchJobResult {
  name?: string;
  price_vnd?: number | null;
  image_url?: string | null;
  platform?: Platform | null;
  resolved_url?: string | null;
  resolved_host?: string | null;
  /** Nguon lay duoc du lieu: 'og' = the Open Graph, 'dom' = doc DOM */
  source?: 'og' | 'dom' | 'manual';
  raw?: Record<string, string>;
  /**
   * Nhan cac bien the doc duoc tren trang san — "Trắng", "Đen", "XL", "Size M"...
   *
   * CHUA LOC. Local Helper khong biet bang 17 mau cua website nen no khong
   * quyet dinh cai nao la mau; no dua ve tat ca va website tu doi chieu. Chia
   * viec nhu vay thi doi bang mau khong phai cap nhat helper tren may nguoi
   * dung.
   *
   * Chi co khi di qua Local Helper (trinh duyet that). Duong doc HTML tho
   * khong bao gio co, vi danh sach bien the chi hien ra sau khi JavaScript cua
   * san chay.
   */
  variant_labels?: string[];
}

export interface AiCredentialPublic {
  id: string;
  owner_id: string;
  provider: AiProvider;
  key_hint: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  /** Key nay dung de viet chu hay dung anh. Xem migration 0026. */
  purpose: 'text' | 'image';
}
