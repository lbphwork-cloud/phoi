'use client';

import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { SetupNotice, Spinner } from '@/components/site';
import { OutfitEditor } from '@/components/OutfitEditor';
import { useAuth } from '@/lib/hooks';

export default function CreatePage() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <Create />;
}

function Create() {
  const { session, isAdmin, loading } = useAuth();

  if (loading) return <Spinner />;

  if (!session) {
    return (
      <div className="shell-narrow py-20 text-center">
        <p className="eyebrow mb-4">Tạo bài</p>
        <h1 className="display-sm mb-4">Cần đăng nhập để đăng bài</h1>
        <p className="muted mb-8 text-sm">
          Bài đăng gắn với tài khoản của bạn, và link affiliate bạn gắn thuộc về
          bạn — không ai sửa được.
        </p>
        <Link href="/dang-nhap" className="btn btn-solid">Đăng nhập</Link>
      </div>
    );
  }

  return (
    <div className="shell-narrow py-12 md:py-16">
      <p className="eyebrow mb-4">Tạo bài</p>
      <h1 className="display-sm mb-4">Bài phối đồ mới</h1>
      <p className="muted mb-10 text-sm leading-relaxed">
        Bạn gắn link affiliate của chính bạn cho từng sản phẩm và hưởng toàn bộ
        hoa hồng từ link đó. Nhiều người được đăng cùng một sản phẩm, mỗi người
        một link riêng — PHỐI không lấy phần trăm nào.
      </p>

      <div className="notice mb-10">
        <p className="eyebrow mb-2">Ba cách lấy thông tin sản phẩm</p>
        <ol className="muted flex flex-col gap-1 text-sm">
          <li>1. Dán link rồi bấm &quot;Lấy thông tin&quot; — hệ thống đọc thẻ Open Graph của sàn.</li>
          <li>2. Nếu sàn chặn, yêu cầu tự chuyển sang Local Helper chạy trên máy quản trị.</li>
          <li>3. Nếu vẫn không được, nhập tay. Đây là cách hợp lệ và ổn định nhất.</li>
        </ol>
      </div>

      <OutfitEditor asAdmin={isAdmin} />
    </div>
  );
}
