'use client';

/**
 * Noi dung sua duoc tu trang quan tri.
 *
 * NGUYEN TAC QUAN TRONG NHAT: LUON CO GIA TRI DU PHONG
 *   `t(key, fallback)` khong bao gio tra ve chuoi rong khi chua tai xong hoac
 *   khi database khong goi duoc — no tra ve `fallback` viet san trong ma nguon.
 *
 *   Ly do: neu khong lam vay, moi lan mang cham hoac database ngu la trang chu
 *   hien ra mot khung trang khong chu. Mot he thong noi dung khong duoc phep
 *   lam website hong khi chinh no hong.
 *
 *   He qua thuc te: ma nguon van chua nguyen van ban goc. Do la co y — no vua
 *   la ban du phong, vua la tai lieu cho biet o do dang le hien cai gi.
 *
 * TAI MOT LAN CHO CA TRANG
 *   Bang nay nho (khoang 50 dong) nen tai het mot lan roi tra theo khoa trong
 *   bo nho. Tai rieng tung khoa se thanh vai chuc luot goi mang cho mot trang.
 */

import { useMemo } from 'react';
import { useAsyncData, useIsMobile } from './hooks';
import { fieldStyleCss, parseFieldStyle } from './typography';

export interface ContentRow {
  key: string;
  page: string;
  label: string;
  hint: string;
  kind: 'text' | 'textarea' | 'image' | 'url' | 'list' | 'choice' | 'style';
  value: string;
  /** Cac gia tri hop le khi kind = 'choice'. Rong voi cac kieu khac. */
  options: string[];
  sort_order: number;
}

/**
 * Bang tra tu lua chon sang lop CSS / gia tri that.
 *
 * Dat o day thay vi trong component: ca trang chu lan trang xem truoc trong
 * quan tri deu dung, va hai noi do phai ra KET QUA GIONG HET NHAU — neu khong
 * thi ban xem truoc noi doi.
 */
export const HERO_TEXT_COLOR: Record<string, string> = {
  trang: '#ffffff',
  den: '#14120f',
};

export const HERO_OVERLAY: Record<string, string> = {
  khong: 'none',
  nhe: 'linear-gradient(to top, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0) 85%)',
  vua: 'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.34) 42%, rgba(0,0,0,0.06) 78%)',
  dam: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.58) 45%, rgba(0,0,0,0.28) 85%)',
};

export const HERO_BOX: Record<string, string> = {
  khong: '',
  toi: 'rgba(12,11,9,0.72)',
  sang: 'rgba(250,249,246,0.88)',
  mo: 'rgba(12,11,9,0.34)',
};

export const HERO_ALIGN: Record<string, string> = {
  'duoi-trai': 'items-end justify-start text-left',
  'giua': 'items-center justify-center text-center',
  'duoi-giua': 'items-end justify-center text-center',
  // Kieu thu tu: ca cum chu va nut DON XUONG PHAN DUOI anh, canh giua theo
  // chieu ngang, khoang cach deu nhau.
  //
  // Ban dau kieu nay dat chu giua khung roi day rieng nut xuong sat day. Nhin
  // ra hai cum roi nhau: mot cum lo lung giua anh, mot cum dinh day, va khoang
  // trong giua chung lon hon moi khoang trong khac tren trang. Dong ca cum
  // xuong duoi thi mat doc lien mach tu chu nho -> tieu de -> nut.
  'giua-nut-day': 'items-end justify-center text-center',
};

export interface Content {
  /** Lay noi dung theo khoa. `fallback` la bat buoc — xem chu thich dau file. */
  t: (key: string, fallback: string) => string;
  /** Nhu `t` nhung cat theo dau phay, dung cho `kind = 'list'`. */
  list: (key: string, fallback: string) => string[];
  /**
   * Kieu chu rieng cua mot o, neu quan tri vien da dat.
   *
   * Tra ve mot doi tuong RONG khi chua dat gi — khong phai undefined. Nho vay
   * cho goi luon viet duoc `style={c.s('key')}` ma khong can kiem tra, va o
   * nao chua dat thi khong co thuoc tinh nao bi ghi de, tuc la van theo vai
   * tro chung.
   */
  s: (key: string) => React.CSSProperties;
  rows: ContentRow[];
  loading: boolean;
  reload: () => void;
  /** Dang hien o khung hep. De cho goi doi bo cuc chu khong chi doi noi dung. */
  isMobile: boolean;
}

export function useContent(): Content {
  // Khung dien thoai dung o ".mobile" khi o do co noi dung. Doc o day, mot lan
  // cho ca trang, thay vi de tung component tu hoi — hai component hoi hai luc
  // co the ra hai cau tra loi khac nhau ngay giua mot lan xoay may.
  const isMobile = useIsMobile();

  const { data, loading, reload } = useAsyncData<ContentRow[]>('site-content', (sb) =>
    sb
      .from('site_content')
      .select('key, page, label, hint, kind, value, options, sort_order')
      .order('page')
      .order('sort_order'),
  );

  const rows = useMemo(() => data ?? [], [data]);

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.key, r.value);
    return m;
  }, [rows]);

  return useMemo(() => {
    // Chuoi rong trong database cung tinh la "chua dat" -> dung ban du phong.
    // Nguoi dung xoa het chu trong o nhap thuong la muon quay ve mac dinh,
    // khong phai muon mot khoang trong.
    /**
     * BA TANG, theo dung thu tu:
     *   1. o ban dien thoai (chi khi dang o khung hep, va chi khi co noi dung)
     *   2. o ban may tinh
     *   3. ban du phong viet trong ma nguon
     *
     * O dien thoai de trong nghia la "khong co gi rieng", khong phai "de trong
     * tren dien thoai". Do la lua chon co y: neu rong tren dien thoai la an
     * that thi moi lan them mot o chu moi, ai do lai phai nho di dien ca hai
     * ban — va se co ngay quen.
     */
    const t = (key: string, fallback: string) => {
      if (isMobile) {
        const m = map.get(`${key}.mobile`);
        if (m !== undefined && m.trim() !== '') return m;
      }
      const v = map.get(key);
      return v === undefined || v.trim() === '' ? fallback : v;
    };

    const list = (key: string, fallback: string) =>
      t(key, fallback)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    // Khoa cua o kieu chu la khoa cua o chu cong ".style". Quy uoc nay giu cho
    // hai o luon di cung nhau ma khong can them mot cot lien ket nao.
    const s = (key: string): React.CSSProperties =>
      fieldStyleCss(parseFieldStyle(map.get(`${key}.style`) ?? ''));

    return { t, list, s, rows, loading, reload, isMobile };
  }, [map, rows, loading, reload, isMobile]);
}

/**
 * Tinh dien mao phan mo dau tu cac lua chon cua quan tri vien.
 *
 * DUNG CHUNG cho trang chu VA cho ban xem truoc trong /admin/noi-dung. Neu hai
 * noi tu tinh rieng thi som muon cung lech nhau, va luc do ban xem truoc noi
 * doi — do la kieu loi lam nguoi dung mat long tin vao ca trang quan tri.
 */
export function heroAppearance(t: (k: string, f: string) => string) {
  const colorKey = t('home.hero.text_color', 'trang');
  const fg = HERO_TEXT_COLOR[colorKey] ?? HERO_TEXT_COLOR.trang;
  const light = colorKey === 'trang';

  const boxKey = t('home.hero.box', 'khong');
  const boxBg = HERO_BOX[boxKey] ?? '';

  const buttonKey = t('home.hero.button_style', 'sang');
  const alignKey = t('home.hero.align', 'duoi-trai');

  return {
    /** Mau chu chinh. Ap cho ca tieu de va doan mo ta. */
    textStyle: {
      color: fg,
      /*
        VIEN MO QUANH CHU, khong phai vien net.
        Chu sang nam tren anh chup se chim bat cu khi nao phia sau no tinh co
        la mot vung sang — mot manh troi, mot buc tuong trang. Lop phu chung
        khong cuu duoc, vi lam lop phu du dam de cuu chu thi anh bi dim mat.

        BA LOP CHONG NHAU, moi lop mot viec:
          1. 0 1px 2px   — vien sat chan chu, tach net chu khoi nen
          2. 0 2px 10px  — quang toi vua, do la thu lam chu "noi len"
          3. 0 4px 32px  — quang rat rong va rat mo, dim nhe ca vung sau chu

        Do mo tong cong van thap (0.30 / 0.30 / 0.35) nen mat khong nhan ra co
        bong; no chi thay chu ro han. Vien NET (-webkit-text-stroke) thi nguoc
        lai: no lam chu day len va mat het net manh cua kieu chu, nhin ra ngay
        la mot thu duoc dap them vao.

        Chi ap khi chu SANG. Chu toi tren nen sang ma them bong do thi nhin ban.
      */
      textShadow: light
        ? '0 1px 2px rgba(0,0,0,0.30), 0 2px 10px rgba(0,0,0,0.30), 0 4px 32px rgba(0,0,0,0.35)'
        : 'none',
    } as React.CSSProperties,

    /** Mau cho chu phu: nhat hon chu chinh nhung van cung tong. */
    dimColor: light ? 'rgba(255,255,255,0.76)' : 'rgba(20,18,15,0.68)',

    overlay: HERO_OVERLAY[t('home.hero.overlay', 'vua')] ?? HERO_OVERLAY.vua,

    boxStyle: boxBg
      ? ({ background: boxBg, backdropFilter: 'blur(2px)' } as React.CSSProperties)
      : undefined,

    alignClass: HERO_ALIGN[alignKey] ?? HERO_ALIGN['duoi-trai'],

    /**
     * Ca cum chu va nut co duoc dong xuong phan duoi anh khong.
     *
     * Chi dung o kieu 'giua-nut-day'. Ten thuoc tinh giu nguyen de khong phai
     * sua ba noi dang dung no; hanh vi thi da doi — xem chu thich o HERO_ALIGN.
     */
    splitCta: alignKey === 'giua-nut-day',

    /**
     * Co an doan mo ta khong.
     *
     * Kieu 'giua-nut-day' co y chi de HAI HANG CHU o tren. Doan mo ta la hang
     * thu ba, nen o kieu nay no khong duoc dung. KHONG xoa noi dung cua no
     * trong database — doi lai kieu khac la no hien lai nguyen ven.
     */
    hideSubtitle: alignKey === 'giua-nut-day',

    buttonClass:
      buttonKey === 'toi' ? 'btn-solid'
      : buttonKey === 'vien' ? 'btn-ghost-onmedia'
      : 'btn-onmedia',
  };
}
