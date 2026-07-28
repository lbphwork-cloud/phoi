'use client';

/**
 * Hook dung chung cho toan bo ung dung.
 *
 * Gom vao mot file vi chung phu thuoc lan nhau (useUserContext can useAuth va
 * useTaxonomy) va deu nho. Tach ra nhieu file chi lam tang so lan import ma
 * khong ro rang hon.
 */

import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
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

/**
 * HAI TRANG THAI, KHONG CON 'system'.
 *
 * Truoc day co ba: Tu dong / Sang / Toi. Ba trang thai tren MOT cai nut nghia
 * la di tu trang thai nay sang trang thai kia co khi phai bam hai lan — chu
 * website dem duoc dieu do va goi no la "thao tac nao cung phai click 2 lan".
 * Mot cai nut hai trang thai thi mot lan bam luon ra dung thu minh muon.
 *
 * DIEU MAT DI, noi ro de khong ai tuong la khong mat: nguoi de may tu doi sang
 * toi theo gio se khong con duoc theo may nua. Day la danh doi duoc chon co y,
 * khong phai so sot.
 */
export type Theme = 'light' | 'dark';

const THEME_KEY = 'phoi.theme';

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';

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

/**
 * CHE DO MAC DINH LA TOI.
 *
 * Do la lua chon cua chu website: anh thoi trang tren nen toi trong dam hon,
 * va phan lon nguoi xem se khong bao gio dong vao cai nut doi che do.
 *
 * Doi mot dong nay la CHUA DU: xem chu thich ThemeScript trong layout.tsx.
 * Doc localStorage chi chay duoc sau khi JavaScript tai xong, ma luc do trang
 * da ve xong mot lan roi — neu khong lam gi them thi moi lan mo trang se loe
 * trang mot cai truoc khi chuyen sang toi.
 */
const DEFAULT_THEME: Theme = 'dark';

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    // localStorage co the bi chan (che do rieng tu tren mot so trinh duyet)
    return DEFAULT_THEME;
  }
}

/** Ban doc luc dung san HTML: luc do khong co localStorage. */
const readThemeOnServer = (): Theme => DEFAULT_THEME;

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
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Mot lan bam la doi han sang trang thai kia. Ten van la `cycle` de khong
  // phai sua moi noi goi no, nhung gio no dung nghia la mot cong tac.
  const cycle = useCallback(() => {
    apply(readTheme() === 'dark' ? 'light' : 'dark');
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

/**
 * Ba bang danh muc, tai MOT LAN cho ca phien.
 *
 * Truoc day moi component goi useTaxonomy deu tu tai lai ca ba bang, va tai lai
 * lan nua moi khi chuyen trang. Ba bang nay cong lai chua 34 dong va gan nhu
 * khong bao gio doi — tai lai chung o moi trang la ba luot cho mang de lay ve
 * dung thu vua co.
 *
 * Di qua useAsyncData nen ket qua nam trong bo nho dung chung: ai hoi truoc thi
 * goi, ai hoi sau dung lai, va chuyen trang khong goi lai.
 */
export function useTaxonomy(): Taxonomy {
  const { data, loading } = useAsyncData('taxonomy', async (sb) => {
    const [s, c, o] = await Promise.all([
      sb.from('styles').select('*').order('sort_order'),
      sb.from('colors').select('*').order('sort_order'),
      sb.from('occasions').select('*').order('sort_order'),
    ]);
    const err = s.error ?? c.error ?? o.error;
    return {
      data: {
        styles: (s.data as Style[]) ?? [],
        colors: (c.data as Color[]) ?? [],
        occasions: (o.data as Occasion[]) ?? [],
      },
      error: err ? { message: err.message } : null,
    };
  });

  const styles = useMemo(() => data?.styles ?? [], [data]);
  const colors = useMemo(() => data?.colors ?? [], [data]);
  const occasions = useMemo(() => data?.occasions ?? [], [data]);

  const colorElements: ColorElementMap = Object.fromEntries(
    colors.map((c: Color) => [c.slug, c.element]),
  );

  const find = <T extends { slug: string; label: string }>(arr: T[], slug: string | null) =>
    slug ? arr.find((x) => x.slug === slug) : undefined;

  return {
    loading, styles, colors, occasions, colorElements,
    styleLabel: (s) => find(styles, s)?.label ?? '—',
    colorLabel: (s) => find(colors, s)?.label ?? '—',
    colorHex: (s) => colors.find((c: Color) => c.slug === s)?.hex ?? 'transparent',
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
/**
 * BO NHO DUNG CHUNG CHO CA TRANG.
 *
 * VI SAO PHAI CO
 *   Truoc day moi component goi useAsyncData deu tu chay truy van cua rieng no.
 *   Bang site_content duoc SAU component doc — TypographyStyle, Favicon, thanh
 *   menu, chan trang, than trang — nen mot lan mo trang chu la SAU luot goi
 *   database cho dung mot bang, cung mot cau truy van, cung mot ket qua.
 *
 *   Da do bang trinh duyet that: trang chu 29 luot goi, trang kham pha 91 luot,
 *   trong do site_content chiem 5-6 luot moi trang. Do la lang phi thuan tuy —
 *   khong doi mot pixel nao tren man hinh.
 *
 *   Gio ket qua nam trong mot Map cap module. Ai hoi truoc thi chay truy van,
 *   ai hoi sau thi cho chinh loi hua do. Ket qua giu lai ca khi chuyen trang,
 *   nen sang trang thu hai la chu hien ngay khong phai cho mang.
 *
 * VI SAO KHONG DAT HAN THOI GIAN SONG
 *   Du lieu o day la noi dung trang va danh muc — thu doi vai thang mot lan.
 *   Ai sua thi goi reload(), va reload() xoa o nho roi bao TAT CA nguoi dang
 *   nghe tai lai. Mot bo dem tu het han sau N giay chi tao ra nhung lan tai
 *   khong ai yeu cau.
 */
type Snapshot = { data: unknown; error: string | null };

const CACHE = new Map<string, Snapshot>();
const INFLIGHT = new Map<string, Promise<void>>();
const LISTENERS = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const fn of LISTENERS.get(key) ?? []) fn();
}

function runQuery(
  key: string,
  query: (sb: NonNullable<ReturnType<typeof getSupabase>>) => PromiseLike<{
    data: unknown; error: { message: string } | null;
  }>,
): void {
  // Da co nguoi goi cung khoa dang chay thi khong goi them. Day chinh la cho
  // bo di 5 luot goi thua moi trang.
  if (INFLIGHT.has(key)) return;

  const sb = getSupabase();
  if (!sb) return;

  const p = Promise.resolve(query(sb))
    .then(({ data, error }) => {
      CACHE.set(key, { data: data ?? null, error: error?.message ?? null });
    })
    .catch((e: unknown) => {
      CACHE.set(key, { data: null, error: (e as Error).message });
    })
    .finally(() => {
      INFLIGHT.delete(key);
      notify(key);
    });

  INFLIGHT.set(key, p);
}

/** Xoa mot khoa khoi bo nho dung chung. Dung khi du lieu vua bi sua o noi khac. */
export function invalidateAsyncData(key: string) {
  CACHE.delete(key);
  notify(key);
}

export function useAsyncData<T>(
  key: string,
  query: (sb: NonNullable<ReturnType<typeof getSupabase>>) => PromiseLike<{
    data: T | null;
    error: { message: string } | null;
  }>,
  enabled = true,
): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  // Giu ham truy van trong ref de effect chi phu thuoc vao KHOA, khong phu
  // thuoc vao danh tinh cua ham (danh tinh doi moi lan render).
  const queryRef = useRef(query);
  useEffect(() => { queryRef.current = query; });

  const subscribe = useCallback((onChange: () => void) => {
    let set = LISTENERS.get(key);
    if (!set) { set = new Set(); LISTENERS.set(key, set); }
    set.add(onChange);
    return () => { set!.delete(onChange); };
  }, [key]);

  // Tra ve CHINH doi tuong trong Map, khong tao doi tuong moi: React so sanh
  // bang danh tinh, nen tao moi moi lan doc se thanh vong lap render vo tan.
  const getSnapshot = useCallback(() => CACHE.get(key), [key]);
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => undefined);

  useEffect(() => {
    if (!enabled) return;
    if (CACHE.has(key)) return;
    runQuery(key, queryRef.current as never);
  }, [key, enabled]);

  const reload = useCallback(() => {
    CACHE.delete(key);
    runQuery(key, queryRef.current as never);
    notify(key);
  }, [key]);

  return {
    data: (snap?.data as T | null) ?? null,
    loading: enabled && isSupabaseConfigured && snap === undefined,
    error: snap?.error ?? null,
    reload,
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
