'use client';

/**
 * Hook dung chung cho toan bo ung dung.
 *
 * Gom vao mot file vi chung phu thuoc lan nhau (useUserContext can useAuth va
 * useTaxonomy) va deu nho. Tach ra nhieu file chi lam tang so lan import ma
 * khong ro rang hon.
 */

import {
  useCallback, useEffect, useMemo, useRef, useSyncExternalStore,
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
  /**
   * Quyen admin dang doc tu bo nho trinh duyet, chua duoc database xac nhan
   * lai trong lan tai trang nay.
   *
   * Cong khai ra de giao dien noi that duoc khi can. KHONG duoc dung no de
   * quyet dinh cho phep lam gi — quyet dinh do thuoc ve RLS.
   */
  optimistic: boolean;
}

/*
  =============================================================================
  MOT KHO TRANG THAI DANG NHAP, DUNG CHUNG CHO CA WEBSITE

  LOI CU: MOI COMPONENT MOT BAN SAO.
    useAuth() truoc day giu state bang useState ngay trong tung component. Ca
    website co 18 cho goi no — thanh dieu hoi, trang tao bai, khoi sua outfit,
    lop chan trang quan tri...

    Moi cho trong so do:
      * bat dau o loading = true, nen hien mot o cho rieng cua no;
      * tu goi getSession() roi tu truy van bang `profiles`.

    Chuyen mot trang la 18 truy van GIONG HET NHAU chay song song de lay ve
    cung mot dong du lieu, moi cai mot vong cho mang. Va vi moi ban sao bat dau
    lai tu dau, lop chan trang quan tri hien "Dang kiem tra quyen" moi lan bam
    vao trang admin — du vua bam tu chinh trang admin sang.

  CACH CHUA: dat trang thai o CAP MODULE va cho cac component dang ky nghe.
    Doc phien va tai ho so DUNG MOT LAN cho ca phien lam viec. Cho nao goi sau
    thi doc ngay ket qua da co — khong vong mang, khong chop o cho.

  NHO QUA LAN TAI TRANG (localStorage).
    Ngay ca mot lan goi cung mat mot vong mang, va no roi dung vao luc nguoi
    dung vua mo web. Nen ket qua duoc ghi lai; lan sau menu quan tri hien ngay
    tu khung hinh dau tien.

    DANH DOI, noi ro chu khong giau: neu quyen admin bi go o mot may khac thi
    may nay con hien nham menu cho den lan tai trang ke tiep. Vo hai — moi truy
    van cua trang admin deu bi database kiem tra is_admin() lai, nen thu duy
    nhat ke do thay la mot man hinh trong.

    KHONG BAO GIO GHI TOKEN VAO DAY. Chi ghi id nguoi dung va vai tro. Token do
    thu vien Supabase tu quan ly o kho rieng cua no.
  =============================================================================
*/

const AUTH_CACHE_KEY = 'phoi.auth';

/**
 * Trang thai luc may chu dung trang, va luc React noi lai (hydrate).
 *
 * PHAI LA MOT HANG SO CO DINH. useSyncExternalStore goi getServerSnapshot cho
 * lan render dau khi noi lai; tra ve mot doi tuong moi moi lan goi se lam React
 * lap vo han.
 */
const AUTH_SSR: AuthState = Object.freeze({
  loading: isSupabaseConfigured,
  session: null,
  profile: null,
  isAdmin: false,
  configured: isSupabaseConfigured,
  optimistic: false,
});

let authState: AuthState = AUTH_SSR;
const authListeners = new Set<() => void>();
/** Da bat dau doc phien chua. Chi mot lan cho ca phien, du bao nhieu component. */
let authStarted = false;

function setAuth(next: AuthState) {
  authState = next;
  for (const fn of authListeners) fn();
}

/** Doc quyen da nho tu lan truoc. Hong hay thieu thi coi nhu khong co. */
function readAuthCache(): { uid: string; role: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { uid?: unknown; role?: unknown };
    if (typeof v.uid !== 'string' || typeof v.role !== 'string') return null;
    return { uid: v.uid, role: v.role };
  } catch {
    return null;
  }
}

function writeAuthCache(uid: string, role: string) {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ uid, role }));
  } catch { /* rieng tu / het cho: khong co cache van chay dung, chi cham hon */ }
}

function clearAuthCache() {
  try { localStorage.removeItem(AUTH_CACHE_KEY); } catch { /* nhu tren */ }
}

/**
 * Bat dau theo doi dang nhap. Goi bao nhieu lan cung chi chay mot lan.
 *
 * Tra ve ham dung theo doi — nhung KHONG dung khi component cuoi cung roi di.
 * Trang thai dang nhap la thu ca website dung; dung roi bat lai theo tung
 * component la quay ve dung cai lo hong vua chua.
 */
function startAuth() {
  if (authStarted) return;
  authStarted = true;

  const sb = getSupabase();
  if (!sb) {
    setAuth({ ...AUTH_SSR, loading: false, configured: false });
    return;
  }

  // Hien quyen da nho NGAY, truoc khi hoi database. Van giu loading = true de
  // cho nao can biet "da chac chua" thi biet duoc.
  const cache = readAuthCache();
  if (cache) {
    setAuth({
      ...authState,
      loading: true,
      isAdmin: cache.role === 'admin',
      optimistic: true,
    });
  }

  /** Tai khoan da tai xong ho so. Dung de khoi hoi lai bang `profiles`. */
  let daTai: string | null = null;
  /**
   * Tai khoan DANG duoc hoi ngay luc nay.
   *
   * Chi kiem `daTai` thoi thi chua du: thu vien Supabase ban ca bon su kien
   * gan nhu cung mot luc, nen ca bon deu chay qua cho kiem tra TRUOC khi truy
   * van dau tien kip tra ve. Ket qua do duoc: van bon truy van giong het nhau.
   * Bien nay duoc dat NGAY, truoc `await`, nen ba luot sau nhin thay va dung.
   */
  let dangTai: string | null = null;

  const loadProfile = async (session: Session | null) => {
    if (!session) {
      daTai = null;
      clearAuthCache();
      setAuth({
        loading: false, session: null, profile: null,
        isAdmin: false, configured: true, optimistic: false,
      });
      return;
    }

    /*
      CUNG MOT NGUOI THI KHONG HOI LAI BANG `profiles`.

      Thu vien Supabase ban ra nhieu su kien cho mot lan dang nhap —
      INITIAL_SESSION, SIGNED_IN, roi TOKEN_REFRESHED moi lan gia han token.
      Moi su kien truoc day keo theo mot truy van, va do do duoc: bon truy van
      giong het nhau trong mot lan mo trang quan tri.

      Token doi thi VAN phai cap nhat `session` — cac cho khac lay token tu do
      de goi Edge Function. Chi bo phan hoi lai vai tro, vi vai tro khong doi
      theo token.
    */
    if (daTai === session.user.id && authState.profile) {
      setAuth({ ...authState, session, loading: false, optimistic: false });
      return;
    }

    // Dang co mot luot hoi cho chinh nguoi nay: de luot do lam not.
    if (dangTai === session.user.id) return;
    dangTai = session.user.id;

    let data: unknown = null;
    try {
      ({ data } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle());
    } finally {
      // Tra lai du truy van hong, de lan sau con hoi lai duoc.
      dangTai = null;
    }

    const profile = (data as Profile | null) ?? null;
    daTai = profile ? session.user.id : null;

    if (profile) writeAuthCache(session.user.id, profile.role);
    else clearAuthCache();

    setAuth({
      loading: false,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      configured: true,
      optimistic: false,
    });
  };

  void sb.auth.getSession().then(({ data }) => loadProfile(data.session));
  sb.auth.onAuthStateChange((_event, session) => { void loadProfile(session); });
}

function subscribeAuth(fn: () => void) {
  startAuth();
  authListeners.add(fn);
  return () => { authListeners.delete(fn); };
}

const getAuthSnapshot = () => authState;
const getAuthServerSnapshot = () => AUTH_SSR;

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const state = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);

  const signOut = useCallback(async () => {
    clearAuthCache();
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
  const uid = session?.user.id ?? null;

  /*
    DI QUA BO NHO DUNG CHUNG, khong con moi component mot ban sao.

    Truoc day hook nay giu state rieng va tu chay BA truy van moi lan duoc goi.
    Nam cho goi no — trang chu, trang kham pha, trang chi tiet set do, trang ho
    so — nen mo mot trang co the la ba, sau, chin truy van cho ve dung mot bo
    du lieu. Do la cung mot lo hong vua duoc chua o useAuth, chi o mot hook
    khac.

    Khoa co ca uid: doi tai khoan la doi khoa, nen du lieu cua nguoi truoc
    khong bao gio con sot lai. Chua dang nhap thi khoa la null — useAsyncData
    khong chay truy van nao ca.
  */
  const { data, loading: dataLoading, reload } = useAsyncData<Omit<LoadedUserData, 'key'>>(
    `user-context-${uid ?? 'khach'}`,
    async (sb) => {
      const [p, pv, fb] = await Promise.all([
        sb.from('user_preferences').select('*').eq('user_id', uid!).maybeSingle(),
        sb.from('user_private').select('*').eq('user_id', uid!).maybeSingle(),
        sb.from('feedback_events').select('kind, target_value, outfit_id').eq('user_id', uid!),
      ]);

      const pref = (p.data as UserPreferences | null) ?? null;
      const priv = (pv.data as UserPrivate | null) ?? null;
      const derived = derivePreferencesFromFeedback(
        (fb.data as Array<{
          kind: string; target_value: string | null; outfit_id: string | null;
        }>) ?? [],
      );

      return {
        data: {
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
        },
        error: p.error ?? pv.error ?? fb.error,
      };
    },
    // Khach chua dang nhap thi khong co gi de hoi. `enabled = false` giu cho
    // khoa 'khach' khong bao gio chay mot truy van nao.
    uid !== null,
  );

  const fresh = uid ? data : null;

  return {
    // Khach chua dang nhap: khong co gi de tai nen khong bao gio "dang tai".
    loading: authLoading || (uid !== null && (dataLoading || fresh == null)),
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
