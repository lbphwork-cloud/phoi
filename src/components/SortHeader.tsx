'use client';

/**
 * Sap xep bang bang cach bam vao tieu de cot.
 *
 * VI SAO LA MOT THU DUNG CHUNG CHU KHONG VIET LAI O TUNG TRANG
 *   Co bon bang danh sach trong website nay, va ca bon deu can cung mot thu:
 *   bam mot lan sap tang, bam lai sap giam, hien mui ten cho biet dang sap
 *   theo cot nao. Viet lai bon lan la bon co hoi de bon trang hanh xu khac
 *   nhau — va nguoi dung se nhan ra su khac nhau do truoc khi ai kip sua.
 *
 * SAP TREN DU LIEU DA TAI VE, KHONG GOI LAI DATABASE
 *   Cac bang nay deu gioi han vai tram dong va da nam san trong bo nho. Goi
 *   lai chi de doi thu tu la mot vong cho khong can thiet, va no lam mat trang
 *   thai cuon cua nguoi dung.
 *
 * SO SANH CHU TIENG VIET CHO DUNG
 *   'Đ' phai dung sau 'D' va truoc 'E', 'Ă' ngay sau 'A'. So sanh bang dau '<'
 *   thi may xep theo ma ky tu, va moi chu co dau deu bi day xuong cuoi bang —
 *   danh sach "A den Z" se co ca mot khoi chu tieng Viet nam roi o duoi. Dung
 *   Intl.Collator voi ngon ngu 'vi' thi tra ve dung thu tu tu dien.
 */

import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
  /** Bam vao mot cot: lan dau sap tang, bam lai cot do thi dao chieu. */
  toggle: (key: K) => void;
}

/** So sanh chu theo dung thu tu tu dien tieng Viet. */
const soSanhChu = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

export function useTableSort<K extends string>(
  macDinh: K | null = null,
  chieuMacDinh: SortDir = 'asc',
): SortState<K> {
  const [key, setKey] = useState<K | null>(macDinh);
  const [dir, setDir] = useState<SortDir>(chieuMacDinh);

  return {
    key,
    dir,
    toggle: (k: K) => {
      if (k === key) {
        setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setKey(k);
        setDir('asc');
      }
    },
  };
}

/**
 * Sap mot mang theo trang thai sap xep.
 *
 * `lay` tra ve gia tri de so sanh cho tung dong. Tra ve chuoi thi so theo thu
 * tu tu dien tieng Viet; tra ve so hoac null thi so theo so. null luon xuong
 * CUOI bat ke chieu nao — mot o trong khong phai "nho nhat", no la "khong co",
 * va day no len dau danh sach chi lam nguoi doc phai cuon qua.
 */
export function useSorted<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  lay: (row: T, key: K) => string | number | null | undefined,
): T[] {
  return useMemo(() => {
    if (!sort.key) return rows;
    const k = sort.key;
    const heSo = sort.dir === 'asc' ? 1 : -1;

    return [...rows].sort((a, b) => {
      const x = lay(a, k);
      const y = lay(b, k);

      const xTrong = x === null || x === undefined || x === '';
      const yTrong = y === null || y === undefined || y === '';
      if (xTrong && yTrong) return 0;
      if (xTrong) return 1;
      if (yTrong) return -1;

      if (typeof x === 'number' && typeof y === 'number') return (x - y) * heSo;
      return soSanhChu.compare(String(x), String(y)) * heSo;
    });
    // `lay` co danh tinh moi moi lan render nen KHONG dua vao danh sach phu
    // thuoc — dua vao se lam useMemo khong bao gio dung lai ket qua da tinh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort.key, sort.dir]);
}

/**
 * Tieu de cot bam duoc.
 *
 * Mui ten CHI hien o cot dang duoc sap. Hien mui ten mo o moi cot nghe thi
 * "goi y duoc", nhung tren mot bang bay cot thi thanh bay ky hieu nhap nhay va
 * mat khong con biet cot nao dang co tac dung.
 */
export function SortHeader<K extends string>({
  sort,
  colKey,
  children,
}: {
  sort: SortState<K>;
  colKey: K;
  children: React.ReactNode;
}) {
  const dangSap = sort.key === colKey;

  return (
    /* `aria-sort` thuoc ve O TIEU DE COT, khong phai cai nut ben trong.
       Dat nham cho thi trinh doc man hinh khong doc ra trang thai sap xep —
       no chi doc mot cai nut khong ro dang lam gi. */
    <th aria-sort={dangSap ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => sort.toggle(colKey)}
        className="sort-header"
        title={`Sắp xếp theo ${typeof children === 'string' ? children : 'cột này'}`}
      >
        {children}
        {dangSap && <span aria-hidden="true">{sort.dir === 'asc' ? ' ↑' : ' ↓'}</span>}
      </button>
    </th>
  );
}
