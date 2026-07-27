'use client';

/**
 * Xoa han mot set do.
 *
 * DUNG CHUNG cho trang Outfit va trang Kiem duyet, de hai noi khong the lech
 * nhau ve cach hoi xac nhan, cach ghi nhat ky va cach bao loi.
 *
 * CAI GI BI XOA THEO, CAI GI O LAI
 *   Cac dong outfit_items bi xoa theo (khoa ngoai dat on delete cascade), cung
 *   voi luot phan hoi va luot bam link cua chinh bai do.
 *
 *   SAN PHAM THI O LAI. Chung duoc co y tham chieu kieu "on delete restrict"
 *   nen khong bi keo theo — mot san pham co the dang nam trong nhieu set khac,
 *   va xoa mot bai ma lam thung cac bai con lai thi te hon nhieu. San pham
 *   khong con thuoc set nao se hien o muc "san pham khong thuoc set nao" cuoi
 *   trang Outfit, xoa tay o do.
 *
 * NHAT KY GHI TRUOC KHI XOA
 *   Ghi sau thi neu buoc xoa thanh cong ma buoc ghi that bai, se co mot bai
 *   bien mat khong dau vet. Ghi truoc thi truong hop xau nhat la mot dong nhat
 *   ky thua — de doi chieu hon nhieu so voi mot khoang trong.
 */

import { getSupabase } from './supabase/client';

export async function deleteOutfit(
  outfit: { id: string; title: string; status: string },
): Promise<{ ok: boolean; message?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Chưa cấu hình Supabase.' };

  await sb.rpc('log_admin_action', {
    p_action: 'outfit.delete',
    p_entity_type: 'outfit',
    p_entity_id: outfit.id,
    p_detail: { title: outfit.title, status: outfit.status },
  });

  const { error } = await sb.from('outfits').delete().eq('id', outfit.id);

  if (error) return { ok: false, message: `Không xoá được "${outfit.title}": ${error.message}` };
  return { ok: true };
}

/** Cau hoi xac nhan dung chung, de hai trang hoi giong het nhau. */
export function confirmDelete(title: string): boolean {
  return window.confirm(
    `Xoá hẳn "${title}"?\n\n` +
      'Bài và các món trong bài sẽ mất vĩnh viễn, không hoàn lại được. ' +
      'Sản phẩm vẫn nằm lại trong kho vì có thể đang được set khác dùng.',
  );
}
