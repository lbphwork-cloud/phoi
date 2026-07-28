'use client';

/**
 * O nhap API key, dat NGAY CANH cai nut can den no.
 *
 * VI SAO KHONG PHAI MOT TRANG CAI DAT RIENG
 *   Cai thieu de bam duoc mot nut phai nam canh chinh cai nut do. Bat nguoi
 *   dung roi trang dang lam do de sang mot trang cai dat, nhap key, roi quay
 *   lai va lam lai tu dau — do la cach chac chan nhat de ho bo cuoc.
 *
 * VI SAO MOI MUC DICH MOT O RIENG
 *   Voi Google, viet chu va dung anh thuoc hai muc gia khac han nhau: key trong
 *   du an mien phi viet chu duoc nhung han muc anh bang 0. Rat nhieu nguoi se
 *   muon giu dung the — mot key mien phi dung hang ngay cho phan chu, va chi
 *   khi that su can anh moi dung den key co tra tien.
 *
 *   Dan cung mot chuoi vao ca hai o cung duoc. Tach ra la MO them lua chon.
 *
 * LUON CO DUONG DOI KEY, ke ca khi da co key.
 *   Ban dau toi an o nhap di khi tai khoan da co key — nghe hop ly, nhung KEY
 *   HONG TRONG Y HET KEY TOT. Dung tinh canh that: co key, key vo dung vi han
 *   muc bang 0, va khong co duong nao thay ma khong roi trang.
 */

import { useState } from 'react';
import {
  deleteAiKey, testAiKey, useKeyInput,
  type AiKeyPurpose,
} from '@/lib/aiCredentials';
import type { AiCredentialPublic, AiProvider } from '@/lib/supabase/types';

const VIEC: Record<AiKeyPurpose, string> = {
  text: 'viết chữ',
  image: 'dựng ảnh',
};

/**
 * Goi y lay key o dau, noi that ve viec key mien phi lam duoc gi.
 *
 * Cau nay tung ghi "Lay key mien phi... Khong can the tin dung" ngay duoi nut
 * dung anh, va no SAI: goi mien phi cua Gemini cho tao chu, con han muc tao
 * anh bang 0. Chu website da mat thoi gian di lay key roi moi phat hien.
 */
const GOI_Y: Record<AiProvider, Partial<Record<AiKeyPurpose, string>>> = {
  gemini: {
    text:
      'Lấy key ở aistudio.google.com/apikey. Gói miễn phí viết chữ được — nhưng chỉ khi '
      + 'dự án của key có hạn mức. Nếu báo "limit: 0" thì phải tạo key trong một dự án khác.',
    image:
      'Gemini KHÔNG dựng ảnh được bằng gói miễn phí — hạn mức ảnh bằng 0. Phải bật thanh '
      + 'toán cho dự án trên Google Cloud rồi mới dùng key ở đây.',
  },
  openai: {
    text: 'Lấy key ở platform.openai.com/api-keys. Tính tiền theo lượng chữ.',
    image: 'Lấy key ở platform.openai.com/api-keys. Tính tiền theo từng ảnh.',
  },
  local_comfyui: {
    text: 'ComfyUI chạy trên máy bạn, không cần key.',
    image: 'ComfyUI chạy trên máy bạn, không cần key.',
  },
};

export function AiKeyBox({
  provider,
  purpose,
  active,
  sharedWithText = false,
  loading,
  onChanged,
}: {
  provider: AiProvider;
  purpose: AiKeyPurpose;
  /** Key dang luu cho dung cap (nha cung cap, muc dich) nay. */
  active: AiCredentialPublic | null;
  /**
   * Key dang hien khong phai key rieng cho viec nay ma la key dung chung.
   *
   * Phai noi ra chu khong duoc im lang: nguoi dung nhin thay mot key va tuong
   * ho da dat key rieng cho viec nay. Den luc key do het han muc cho anh ma
   * van viet chu duoc thi ho se khong hieu chuyen gi dang xay ra.
   */
  sharedWithText?: boolean;
  loading: boolean;
  onChanged: () => void;
}) {
  const keyInput = useKeyInput(onChanged);
  const [showInput, setShowInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ ok: boolean; text: string } | null>(null);

  const message = probe ?? keyInput.message;

  const test = async () => {
    setBusy(true);
    setProbe(null);
    const r = await testAiKey(provider, purpose);
    setBusy(false);
    setProbe({ ok: r.ok, text: r.message });
  };

  const remove = async () => {
    if (!active) return;
    if (!window.confirm(`Xoá key ${active.key_hint} dùng để ${VIEC[purpose]}?`)) return;
    setBusy(true);
    const r = await deleteAiKey(active.id);
    setBusy(false);
    setProbe({ ok: r.ok, text: r.message });
    if (r.ok) { onChanged(); setShowInput(true); }
  };

  if (provider === 'local_comfyui') {
    return (
      <p className="hint">ComfyUI chạy trên máy bạn — không cần API key.</p>
    );
  }

  return (
    <div className="notice">
      <p className="eyebrow mb-2">API key để {VIEC[purpose]}</p>

      {loading ? (
        <p className="muted text-sm">Đang kiểm tra key…</p>
      ) : (
        <>
          {active ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="text-sm">
                Đang dùng: <code>{active.key_hint}</code>
                {sharedWithText && (
                  <span className="muted"> — dùng chung với phần viết chữ</span>
                )}
              </p>
              <button type="button" className="btn btn-sm btn-quiet"
                      disabled={busy} onClick={() => void test()}>
                {busy ? 'Đang thử…' : 'Thử key'}
              </button>
              <button type="button" className="btn btn-sm btn-quiet"
                      onClick={() => setShowInput((v) => !v)}>
                {showInput ? 'Thôi' : 'Đổi key'}
              </button>
              {/* KHONG cho xoa khi dang dung chung: bam vao day se xoa mat
                  chinh key cua phan viet chu, va nguoi dung khong he y dinh
                  do. Muon xoa thi xoa o dung cho cua no. */}
              {!sharedWithText && (
                <button type="button" className="btn btn-sm btn-quiet btn-danger"
                        disabled={busy} onClick={() => void remove()}>
                  Xoá
                </button>
              )}
            </div>
          ) : (
            <p className="mb-3 text-sm">
              Chưa có key cho việc này. PHỐI <strong>không kèm sẵn key nào</strong> — mỗi
              người dùng key của chính mình, nên tiền dùng AI tính vào tài khoản bạn.
            </p>
          )}

          {(!active || showInput) && (
            <>
              <p className="hint mb-3">{GOI_Y[provider][purpose]}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  className="field"
                  value={keyInput.rawKey}
                  onChange={(e) => keyInput.setRawKey(e.target.value)}
                  placeholder="Dán API key của bạn vào đây"
                  autoComplete="off"
                  aria-label={`API key ${provider} để ${VIEC[purpose]}`}
                />
                <button
                  type="button"
                  className="btn btn-sm shrink-0"
                  disabled={keyInput.busy || !keyInput.rawKey.trim()}
                  onClick={() => {
                    setShowInput(false);
                    void keyInput.submit(provider, purpose);
                  }}
                >
                  {keyInput.busy ? 'Đang lưu và thử…' : 'Lưu key'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {message && (
        <p className={message.ok ? 'hint' : 'hint-error'}>{message.text}</p>
      )}
    </div>
  );
}
