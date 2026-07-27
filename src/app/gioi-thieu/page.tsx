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

const FALLBACK = {
  intro: 'Hai việc. Bạn có thể chỉ cần một trong hai.',
  part1Title: 'Gợi ý chọn đồ',
  part1: [
    'Bạn xem các set đã phối sẵn — áo, quần, giày, phụ kiện đi cùng nhau, không phải '
      + 'từng món rời rạc. Lọc theo phong cách, màu và khoảng giá. Thêm ngày sinh nếu '
      + 'muốn nhận gợi ý màu theo niên mệnh ngũ hành: không bắt buộc, và tắt được bất '
      + 'cứ lúc nào.',
    'Thích món nào thì bấm vào, sang thẳng Shopee hoặc TikTok Shop để mua. '
      + 'Chúng tôi không bán hàng và không giữ tiền của bạn.',
  ].join('\n\n'),
  part2Title: 'Đăng bài phối của bạn',
  part2: [
    'Bạn tự phối một set rồi đăng lên đây, gắn liên kết tiếp thị của chính bạn cho '
      + 'từng món.',
    'Hoa hồng sàn trả về thẳng tài khoản của bạn. Chúng tôi không cắt phần trăm nào '
      + 'và không đứng giữa khoản đó. Bài được duyệt trước khi hiển thị công khai.',
  ].join('\n\n'),
};

export default function AboutPage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <About />;
}

/**
 * Tach doan theo DONG TRONG chu khong phai theo mot ky tu danh dau nao khac:
 * do la cach nguoi ta van go trong mot o nhap nhieu dong, khong phai hoc them
 * mot quy uoc rieng cua website nay.
 */
const toParagraphs = (raw: string) =>
  raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function About() {
  const c = useContent();

  return (
    <div className="shell-narrow py-20">
      <p className="eyebrow mb-4">
        <span style={c.s('about.eyebrow')}>{c.t('about.eyebrow', 'Giới thiệu')}</span>
      </p>

      <h1 className="display-sm mb-6">
        <span style={c.s('about.heading')}>
          {c.t('about.heading', 'PHOOIS ra đời để làm gì?')}
        </span>
      </h1>

      <p className="muted mb-14 text-base leading-relaxed">
        <span style={c.s('about.body')}>{c.t('about.body', FALLBACK.intro)}</span>
      </p>

      {/*
        HAI KHOI CO NHAN RIENG, khong phai mot mach chu chay lien.

        Website nay phuc vu hai kieu nguoi khac han nhau: nguoi den de mua, va
        nguoi den de dang bai lay hoa hong. Viet lien mach thi ho phai doc HET
        moi biet doan nao noi ve minh. Co nhan thi nhin mot cai la biet, va
        phan kia bo qua duoc.

        Duong ke ben trai thay cho so thu tu: hai phan nay khong co truoc sau,
        khong ai phai lam phan 1 truoc khi lam phan 2.
      */}
      <div className="flex flex-col gap-12">
        {[
          { n: 1, title: FALLBACK.part1Title, body: FALLBACK.part1 },
          { n: 2, title: FALLBACK.part2Title, body: FALLBACK.part2 },
        ].map((part) => (
          <section
            key={part.n}
            className="border-l pl-6"
            style={{ borderColor: 'var(--fg)' }}
          >
            <h2 className="eyebrow mb-4">
              <span style={c.s(`about.part${part.n}_title`)}>
                {c.t(`about.part${part.n}_title`, part.title)}
              </span>
            </h2>
            <div className="flex flex-col gap-4">
              {toParagraphs(c.t(`about.part${part.n}_body`, part.body)).map((p, i) => (
                <p key={i} className="text-base leading-relaxed">
                  <span style={c.s(`about.part${part.n}_body`)}>{p}</span>
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
