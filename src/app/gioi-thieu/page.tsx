'use client';

/**
 * Trang gioi thieu.
 *
 * CHI CHU, KHONG ANH — theo dung yeu cau cua chu website. Va do cung la lua
 * chon dung cho trang nay: nguoi mo no dang hoi mot cau rat cu the ("trang nay
 * la gi, va no co lay tien cua toi khong"), khong phai dang tim cam hung. Mot
 * buc anh o day chi lam ho phai cuon them mot man hinh moi den cau tra loi.
 *
 * NOI DUNG NAM TRONG DATABASE, khong viet cung trong file nay. Day dung la
 * loai chu se duoc sua lai nhieu lan — moi lan doi mot chu ma phai sua ma
 * nguon roi trien khai lai thi se khong ai buon sua.
 *
 * BAN DU PHONG VIET NGAY TAI CHO. Neu database khong goi duoc thi trang van
 * day du chu. Xem chu thich dau src/lib/content.ts.
 */

import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useContent } from '@/lib/content';
import { SetupNotice } from '@/components/site';

const FALLBACK_BODY = [
  'PHỐI gợi ý cách phối đồ nam cho thị trường Việt Nam. Mỗi bài là một set hoàn chỉnh — '
    + 'áo, quần, giày, phụ kiện — kèm đường dẫn tới từng món trên Shopee hoặc TikTok Shop.',
  'Bạn chọn phong cách, màu và khoảng giá. Nếu muốn, thêm ngày sinh để nhận gợi ý màu '
    + 'theo niên mệnh ngũ hành — không bắt buộc, và tắt được bất cứ lúc nào.',
  'PHỐI không bán hàng và không giữ tiền của bạn. Bạn mua thẳng trên sàn, giá do sàn '
    + 'quyết định. Các đường dẫn là liên kết tiếp thị: người đăng bài có thể nhận hoa hồng '
    + 'từ sàn, còn giá bạn trả không thay đổi.',
  'Nội dung về ngũ hành chỉ là gợi ý màu sắc mang tính tham khảo trong phối đồ. '
    + 'Đây không phải dự đoán vận mệnh.',
].join('\n\n');

export default function AboutPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <About />;
}

function About() {
  const c = useContent();

  // Tach doan theo DONG TRONG chu khong phai theo mot ky tu danh dau nao khac:
  // do la cach nguoi ta van go trong mot o nhap nhieu dong, khong phai hoc them
  // quy uoc gi.
  const paragraphs = c
    .t('about.body', FALLBACK_BODY)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="shell-narrow py-20">
      <p className="eyebrow mb-4">
        <span style={c.s('about.eyebrow')}>{c.t('about.eyebrow', 'Giới thiệu')}</span>
      </p>

      <h1 className="display-sm mb-8">
        <span style={c.s('about.heading')}>{c.t('about.heading', 'PHỐI là gì')}</span>
      </h1>

      <div className="flex flex-col gap-5">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-base leading-relaxed">
            <span style={c.s('about.body')}>{p}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
