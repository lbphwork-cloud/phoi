'use client';

/**
 * Hook dung chung cho toan bo ung dung.
 *
 * Gom vao mot file vi chung phu thuoc lan nhau (useUserContext can useAuth va
 * useTaxonomy) va deu nho. Tach ra nhieu file chi lam tang so lan import ma
 * khong ro rang hon.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase/client';
import type {
  Color, Occasion, Profile, Style, UserPreferences, UserPrivate,
} from './supabase/types';
import {
  derivePreferencesFromFeedback, emptyUserContext,
  type ColorElementMap, type UserContext,
} from './scoring';

// ---------------------------------------------------------------------------
// Hien dan khi cuon tori
// ---------------------------------------------------------------------------

/**
 * Gan vao mot phan tu de no hien dan khi cuon tori.
 * Bat dau o trang thai 'shown' va chi chuyen sang 'pending' TRONG effect —
 * nghia la neu JavaScript khong chay thi noi dung van hien binh thuong.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Ton trong cai dat tat chuyen dong
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    el.dataset.reveal = 'pending';

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.reveal = 'shown';
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

// ---------------------------------------------------------------------------
// Che do sang / toi
// ---------------------------------------------------------------------------

export type Theme = 'system' | 'light' | 'dark';

const THEME_KEY = 'phoi.theme';

const isTheme = (v: unknown): v is Theme =>
  v === 'system' || v === 'light' || v === 'dark';

/**
 * useTheme dung useSyncExternalStore de doc localStorage.
 *
 * VI SAO KHONG PHAI useState + useEffect
 *   Cach thong thuong la useState('system') roi doc localStorage trong effect
 *   va setState. Cach do co hai van de that:
 *
 *   1. setState dong bo trong effect gay mot vong render du thua (React 19 canh
 *      bao dung ve viec nay).
 *   2. Voi ban xuat tinh, HTML duoc dung san luc build khi khong co localStorage.
 *      Neu server dung 'system' ma client doc ra 'dark' thi React bao khong khop
 *      khi gan ket (hydration mismatch).
 *
 *   useSyncExternalStore duoc thiet ke dung cho tinh huong nay: no co mot ban
 *   doc rieng cho luc dung san (getServerSnapshot) va mot ban doc cho trinh
 *   duyet (getSnapshot). React biet hai ban co the khac nhau nen xu ly dung,
 *   khong canh bao.
 *
 *   Loi thu ba, mien phi: dang ky su kien 'storage' nghia la doi che do o mot
 *   tab se dong bo sang cac tab khac dang mo.
 */
function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('phoi:theme', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('phoi:theme', onChange);
  };
}

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : 'system';
  } catch {
    // localStorage co the bi chan (che do rieng tu tren mot so trinh duyet)
    return 'system';
  }
}

/** Ban doc luc dung san HTML: luc do khong co localStorage. */
const readThemeOnServer = (): Theme => 'system';

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readThemeOnServer);

  const apply = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Khong luu duoc thi van doi che do cho phien hien tai
    }
    // Tu phat su kien: useSyncExternalStore chi nghe 'storage', ma su kien do
    // khong ban trong CHINH tab da ghi.
    window.dispatchEvent(new Event('phoi:theme'));
  }, []);

  // Gan thuoc tinh data-theme len <html>. Day la tac dong ra ngoai React
  // (thao tac DOM), dung cho hop voi effect — khong phai setState.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const cycle = useCallback(() => {
    apply(readTheme() === 'system' ? 'light' : readTheme() === 'light' ? 'dark' : 'system');
  }, [apply]);

  return { theme, setTheme: apply, cycle };
}

// ---------------------------------------------------------------------------
// Dang nhap
// ---------------------------------------------------------------------------

export interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  configured: boolean;
}

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    // Khoi tao loading = isSupabaseConfigured, khong phai true.
    //
    // Neu chua cau hinh database thi khong co gi de tai, nen loading phai la
    // false NGAY TU DAU. Cach cu la dat true roi goi setState(false) trong
    // effect — bo lint cua React 19 bao loi dung: setState dong bo trong effect
    // gay mot vong render du thua, va o day hoan toan tranh duoc bang cach chon
    // gia tri khoi tao cho dung.
    loading: isSupabaseConfigured,
    session: null,
    profile: null,
    isAdmin: false,
    configured: isSupabaseConfigured,
  });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    let alive = true;

    const loadProfile = async (session: Session | null) => {
      if (!session) {
        if (alive) {
          setState({
            loading: false, session: null, profile: null,
            isAdmin: false, configured: true,
          });
        }
        return;
      }

      const { data } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (alive) {
        const profile = (data as Profile | null) ?? null;
        setState({
          loading: false,
          session,
          profile,
          isAdmin: profile?.role === 'admin',
          configured: true,
        });
      }
    };

    sb.auth.getSession().then(({ data }) => loadProfile(data.session));

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      loadProfile(session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  return { ...state, signOut };
}

// ---------------------------------------------------------------------------
// Tu vung (phong cach / mau / dip)
// ---------------------------------------------------------------------------

export interface Taxonomy {
  loading: boolean;
  styles: Style[];
  colors: Color[];
  occasions: Occasion[];
  /** Ban do slug mau -> hanh, dung cho bo cham diem */
  colorElements: ColorElementMap;
  styleLabel: (slug: string | null) => string;
  colorLabel: (slug: string | null) => string;
  colorHex: (slug: string | null) => string;
  occasionLabel: (slug: string | null) => string;
}

export function useTaxonomy(): Taxonomy {
  const [styles, setStyles] = useState<Style[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  // Cung ly do nhu useAuth: chua cau hinh thi khong co gi de tai.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    let alive = true;
    Promise.all([
      sb.from('styles').select('*').order('sort_order'),
      sb.from('colors').select('*').order('sort_order'),
      sb.from('occasions').select('*').order('sort_order'),
    ]).then(([s, c, o]) => {
      if (!alive) return;
      setStyles((s.data as Style[]) ?? []);
      setColors((c.data as Color[]) ?? []);
      setOccasions((o.data as Occasion[]) ?? []);
      setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  const colorElements: ColorElementMap = Object.fromEntries(
    colors.map((c) => [c.slug, c.element]),
  );

  const find = <T extends { slug: string; label: string }>(arr: T[], slug: string | null) =>
    slug ? arr.find((x) => x.slug === slug) : undefined;

  return {
    loading, styles, colors, occasions, colorElements,
    styleLabel: (s) => find(styles, s)?.label ?? '—',
    colorLabel: (s) => find(colors, s)?.label ?? '—',
    colorHex: (s) => colors.find((c) => c.slug === s)?.hex ?? 'transparent',
    occasionLabel: (s) => find(occasions, s)?.label ?? '—',
  };
}

// ---------------------------------------------------------------------------
// Ngu canh ca nhan hoa cua nguoi dung hien tai
// ---------------------------------------------------------------------------

/**
 * Gom so thich da khai bao + nien menh + lich su phan hoi thanh mot UserContext
 * de dua vao bo cham diem.
 *
 * Khach chua dang nhap van dung duoc: tra ve ngu canh rong, moi outfit diem 0,
 * thu tu la moi nhat truoc. Khong bat dang nhap moi cho xem.
 */
/** Mot lan tai xong, gan voi dung tai khoan da tai. */
interface LoadedUserData {
  /** Khoa nhan dang: `${uid}#${nonce}`. Doi khoa = phai tai lai. */
  key: string;
  ctx: UserContext;
  privateData: UserPrivate | null;
  prefs: UserPreferences | null;
}

export function useUserContext(): {
  loading: boolean;
  ctx: UserContext;
  privateData: UserPrivate | null;
  prefs: UserPreferences | null;
  reload: () => void;
} {
  const { session, loading: authLoading } = useAuth();
  const [loaded, setLoaded] = useState<LoadedUserData | null>(null);
  const [nonce, setNonce] = useState(0);

  const uid = session?.user.id ?? null;
  const key = `${uid ?? 'khach'}#${nonce}`;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (authLoading) return;

    const sb = getSupabase();
    // Khong setState o nhanh nay. Truong hop "chua dang nhap" duoc SUY RA ben
    // duoi thay vi ghi vao state — nho vay khong co setState dong bo trong
    // effect, va cung khong con nguy co state cu con sot lai sau khi dang xuat.
    if (!sb || !uid) return;

    let alive = true;

    Promise.all([
      sb.from('user_preferences').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('user_private').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('feedback_events').select('kind, target_value, outfit_id').eq('user_id', uid),
    ]).then(([p, pv, fb]) => {
      if (!alive) return;

      const pref = (p.data as UserPreferences | null) ?? null;
      const priv = (pv.data as UserPrivate | null) ?? null;
      const derived = derivePreferencesFromFeedback(
        (fb.data as Array<{
          kind: string; target_value: string | null; outfit_id: string | null;
        }>) ?? [],
      );

      setLoaded({
        key,
        prefs: pref,
        privateData: priv,
        ctx: {
          preferredStyles: pref?.style_slugs ?? [],
          preferredColors: pref?.color_slugs ?? [],
          priceMinVnd: pref?.price_min_vnd ?? 0,
          priceMaxVnd: pref?.price_max_vnd ?? Number.MAX_SAFE_INTEGER,
          element: priv?.element ?? null,
          elementEnabled: priv?.element_enabled ?? true,
          ...derived,
        },
      });
    });

    return () => { alive = false; };
  }, [uid, authLoading, key]);

  // Du lieu chi duoc dung khi no thuoc DUNG tai khoan dang dang nhap. Sau khi
  // dang xuat hoac doi tai khoan, khoa khong khop nen tu dong quay ve rong.
  const fresh = loaded?.key === key ? loaded : null;

  return {
    // Khach chua dang nhap: khong co gi de tai nen khong bao gio "dang tai".
    loading: authLoading || (uid !== null && fresh === null),
    ctx: fresh?.ctx ?? emptyUserContext(),
    privateData: fresh?.privateData ?? null,
    prefs: fresh?.prefs ?? null,
    reload,
  };
}

// ---------------------------------------------------------------------------
// Tai du lieu mot lan, suy ra trang thai loading
// ---------------------------------------------------------------------------

/**
 * Tai mot truy van Supabase va SUY RA trang thai loading tu khoa, thay vi goi
 * setLoading(true) roi setLoading(false).
 *
 * VI SAO KHONG DUNG setState TRONG THAN EFFECT
 *   React 19 canh bao dung: setState dong bo trong effect gay mot vong render
 *   du thua moi lan effect chay. Voi mot trang co nhieu hook cung lam vay thi
 *   thanh chuoi render lien hoan.
 *
 *   Cach o day: state luu kem KHOA cua lan tai. `loading` la ket qua so sanh
 *   khoa da tai voi khoa hien tai — mot phep suy ra, khong phai mot bien trang
 *   thai. Doi bo loc thi khoa doi, `loading` tu thanh true, khong can set gi.
 *
 * @param key     Chuoi dai dien cho tham so truy van. Doi khoa = tai lai.
 * @param query   Ham nhan client Supabase va tra ve ket qua truy van.
 * @param enabled Dat false de KHONG goi truy van (vi du: chua dang nhap nen
 *                chua biet user id). Khi false thi loading = false va data =
 *                null — tranh gui mot truy van chac chan loi.
 */
export function useAsyncData<T>(
  key: string,
  query: (sb: NonNullable<ReturnType<typeof getSupabase>>) => PromiseLike<{
    data: T | null;
    error: { message: string } | null;
  }>,
  enabled = true,
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [loaded, setLoaded] = useState<{
    key: string; data: T | null; error: string | null;
  } | null>(null);
  const [nonce, setNonce] = useState(0);

  const fullKey = `${key}#${nonce}`;

  // Giu ham truy van trong ref de effect chi phu thuoc vao KHOA, khong phu
  // thuoc vao danh tinh cua ham (danh tinh doi moi lan render).
  // Gan trong effect rieng, khai bao TRUOC effect tai du lieu — effect chay
  // theo thu tu khai bao nen ref luon moi khi effect duoi doc no.
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; });

  useEffect(() => {
    if (!enabled) return;

    const sb = getSupabase();
    if (!sb) return;

    let alive = true;

    Promise.resolve(queryRef.current(sb)).then(({ data, error }) => {
      if (!alive) return;
      setLoaded({ key: fullKey, data: data ?? null, error: error?.message ?? null });
    });

    return () => { alive = false; };
  }, [fullKey, enabled]);

  const fresh = loaded?.key === fullKey ? loaded : null;

  return {
    data: fresh?.data ?? null,
    loading: enabled && isSupabaseConfigured && fresh === null,
    error: fresh?.error ?? null,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}

// ---------------------------------------------------------------------------
// Chan bam nut lien tuc (chong spam phia client)
// ---------------------------------------------------------------------------

/**
 * Gioi han so lan goi trong mot khoang thoi gian, luu o localStorage.
 *
 * DAY KHONG PHAI LOP CHONG SPAM THAT — nguoi dung xoa localStorage la vuot qua.
 * Lop that la rate limit cua Supabase va cua Edge Function. Ham nay chi de
 * tranh bam nham nhieu lan va tranh dot han muc mien phi vi vo tinh.
 */
export function useRateLimit(key: string, maxCalls: number, windowMs: number) {
  return useCallback((): { allowed: boolean; retryAfterSec: number } => {
    const k = `phoi.rl.${key}`;
    const now = Date.now();

    let hits: number[] = [];
    try {
      hits = (JSON.parse(localStorage.getItem(k) ?? '[]') as number[])
        .filter((t) => now - t < windowMs);
    } catch { hits = []; }

    if (hits.length >= maxCalls) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000),
      };
    }

    hits.push(now);
    localStorage.setItem(k, JSON.stringify(hits));
    return { allowed: true, retryAfterSec: 0 };
  }, [key, maxCalls, windowMs]);
}

// ---------------------------------------------------------------------------
// Khung man hinh
// ---------------------------------------------------------------------------

/**
 * Trang co dang hien tren khung hep (dien thoai) khong.
 *
 * 768px la moc `md` cua Tailwind — dung dung con so ma CSS trong ca du an dang
 * dung, de JavaScript va CSS khong bao gio bat dong y kien nhau ve "the nao la
 * dien thoai".
 *
 * DUNG useSyncExternalStore CHU KHONG PHAI useState + useEffect
 *   Cach kia phai dat state trong effect, tuc la lan render dau LUON tra ve
 *   "khong phai dien thoai" roi mot khoanh khac sau moi sua lai — nguoi dung
 *   dien thoai se thay noi dung ban may tinh nhay mot cai roi moi doi. Hook nay
 *   doc gia tri that ngay o lan render dau tien.
 *
 * Luc dung san trang tinh (khong co window) thi tra ve false: ban may tinh la
 * ban day du, nen do la gia tri an toan hon khi chua biet.
 */
function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  };
}

const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMedia(MOBILE_QUERY),
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}
