'use client';

/**
 * Chon MOT anh trong so cac anh doc duoc tu link san pham.
 *
 * VI SAO PHAI CHON, KHONG LAY BUA ANH DAU TIEN
 *   Anh dau tien tu the chia se (og:image) la anh BIA do nguoi ban chon — rat
 *   hay la anh ghep nhieu o co chu quang cao dan len, hoac anh nguoi mau chup
 *   xa ca bo do. Ca hai deu la anh TE NHAT de lam mau cho AI dung lai mon do,
 *   va cung la anh te nhat de hien tren the san pham.
 *
 *   Nguoi dang nhin ba anh thi chon duoc anh chup ro mon do nhat trong hai
 *   giay. May thi khong phan biet duoc.
 *
 * MOT ANH LAM CA HAI VIEC: anh hien tren website, va anh mau gui cho AI. Tach
 * lam hai lua chon nghe linh hoat hon nhung thuc te chi lam nguoi dung phai
 * quyet dinh hai lan cho cung mot thu — va anh dep nhat thi luon dung cho ca
 * hai viec.
 *
 * KHONG HUA DU BA ANH. Co link chi cong bo mot anh. Luc do khoi nay van hien,
 * voi dung mot o — de nguoi dung thay ro "chi doc duoc bay nhieu" thay vi
 * tuong minh bo lo cai gi.
 */

/** Anh nen do script tao du lieu mau sinh ra: mot o vuong xam, khong phai anh that. */
export function laAnhMauTrong(url: string | null | undefined): boolean {
  if (!url) return false;
  /*
    Nhan dang bang DUONG DAN chu khong phai bang dung luong.

    Script seed-images.mjs luu anh mau theo mau `<uid>/sp-<id>.webp`, con anh
    that nguoi dung tai len mang ten `<uid>/<thoi-diem>-<ngau-nhien>.webp`.
    Doc dung luong thi chinh xac hon nhung phai goi mang cho tung anh — mot
    trang co hai muoi mon se thanh hai muoi lan goi chi de to mau mot cai nhan.
  */
  return /\/product-images\/[^/]+\/sp-[^/]+\.webp/.test(url);
}

export function ImagePicker({
  urls,
  selected,
  onPick,
  label = 'Ảnh lấy từ link',
}: {
  urls: string[];
  selected: string;
  onPick: (url: string) => void;
  label?: string;
}) {
  if (urls.length === 0) return null;

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2">
        {urls.map((u) => {
          const dangChon = u === selected;
          return (
            <button
              key={u}
              type="button"
              onClick={() => onPick(u)}
              aria-pressed={dangChon}
              title={dangChon ? 'Đang dùng ảnh này' : 'Chọn ảnh này'}
              className="frame frame-square w-20 shrink-0"
              style={{
                // Vien day mau chu cho anh dang chon. Dung outline chu khong
                // phai border: border lam anh xe dich 2px moi lan doi lua chon.
                outline: dangChon ? '2px solid var(--fg)' : '1px solid var(--line)',
                outlineOffset: dangChon ? '2px' : 0,
                cursor: 'pointer',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" />
            </button>
          );
        })}
      </div>
      <p className="hint">
        {urls.length === 1
          ? 'Link này chỉ công bố một ảnh. Muốn ảnh khác thì mở link rồi tự tải lên.'
          : `Đọc được ${urls.length} ảnh. Chọn ảnh chụp rõ món đồ nhất — ảnh này vừa hiện `
            + 'trên website vừa làm ảnh mẫu cho AI dựng.'}
      </p>
    </div>
  );
}
