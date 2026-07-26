'use client';

/**
 * Dung cau lenh tao anh tu du lieu set do, va goi Edge Function ai-generate.
 *
 * VI SAO DUNG CAU LENH BANG CODE THAY VI DE ADMIN TU GO
 *   Cau lenh tao anh tot can rat nhieu chi tiet lap lai: kieu anh, anh sang,
 *   bo cuc, tone mau, va cac dieu kien loai tru. Go tay moi lan thi vua met vua
 *   khong dong bo — 20 set do se ra 20 phong cach anh khac nhau, va website mat
 *   cam giac lien mach.
 *
 *   O day cau lenh duoc dung tu du lieu co san (phong cach, dip, mau, cac mon
 *   trong set) cong mot phan khung co dinh. Admin van sua duoc truoc khi gui.
 *
 * BON DIEU LUON DUOC GHI VAO CAU LENH, va ly do:
 *   1. Khong hien chu, logo, nhan hieu — mo hinh khuech tan tao chu sai chinh ta
 *      va logo bien dang, nhin la biet anh gia ngay.
 *   2. Khong mo phong nguoi that nao — tranh van de quyen hinh anh ca nhan.
 *   3. Nguoi mau nam chau A, khoang 20-30 tuoi — dung doi tuong cua website.
 *   4. Anh phai co ve la anh chup thoi trang, khong phai anh minh hoa ve.
 */

import { getSupabase } from './supabase/client';

export type AiProviderId = 'gemini' | 'openai';

/** Boi canh chup. Chon san thay vi de go tu do, de anh dong bo giua cac bai. */
export const SCENES = [
  { id: 'studio', label: 'Phông studio trơn', en: 'seamless neutral studio backdrop, soft even lighting' },
  { id: 'pho', label: 'Phố Việt Nam', en: 'quiet Vietnamese city street, morning light, shallow depth of field' },
  { id: 'cafe', label: 'Quán cà phê', en: 'minimal cafe interior, warm window light' },
  { id: 'kien-truc', label: 'Kiến trúc tối giản', en: 'minimal concrete architecture, overcast daylight' },
  { id: 'bien', label: 'Ven biển', en: 'coastal boardwalk, late afternoon sun' },
] as const;

/** Kieu nguoi mau. Giu it lua chon de anh giua cac bai nhin lien mach. */
export const MODEL_TYPES = [
  { id: 'gay', label: 'Gầy, cao', en: 'slim build, tall' },
  { id: 'can-doi', label: 'Cân đối', en: 'average athletic build' },
  { id: 'to', label: 'Vai rộng', en: 'broad-shouldered, solid build' },
] as const;

export interface PromptInput {
  outfitTitle: string;
  styleLabel: string;
  occasionLabel: string;
  /** Ten mau tieng Viet, vi du ['Trắng', 'Đen'] */
  colorLabels: string[];
  /** Mo ta tung mon: 'Áo: áo thun trơn trắng' */
  items: Array<{ roleLabel: string; name: string; colorLabel?: string }>;
  sceneId: string;
  modelTypeId: string;
}

/**
 * Dung cau lenh. Viet bang tieng Anh vi cac mo hinh tao anh hieu tieng Anh tot
 * hon nhieu — day la ly do ky thuat, khong phai lua chon tham my.
 */
export function buildImagePrompt(input: PromptInput): string {
  const scene = SCENES.find((s) => s.id === input.sceneId) ?? SCENES[0];
  const model = MODEL_TYPES.find((m) => m.id === input.modelTypeId) ?? MODEL_TYPES[1];

  const garments = input.items
    .map((it) => `${it.roleLabel.toLowerCase()}: ${it.name}${it.colorLabel ? ` (${it.colorLabel})` : ''}`)
    .join('; ');

  return [
    'Editorial menswear fashion photograph.',
    `Subject: one Southeast Asian man, mid-twenties, ${model.en}, natural expression, standing.`,
    `Outfit to depict — ${garments}.`,
    `Overall colour palette: ${input.colorLabels.join(', ')}.`,
    `Style direction: ${input.styleLabel}. Suited for: ${input.occasionLabel}.`,
    `Setting: ${scene.en}.`,
    'Composition: full body, vertical 3:4 frame, generous negative space, subject slightly off-centre.',
    'Look: restrained and premium, muted colour grading, matte finish, no heavy saturation.',
    // Cac dieu kien loai tru — ly do tung dong o chu thich dau file
    'Must not include: any text, lettering, watermark, brand logo or trademark.',
    'Must not resemble any real or identifiable person.',
    'Must not look like an illustration, painting, 3D render or cartoon.',
    'No collage, no split frames, no multiple people.',
  ].join(' ');
}

export interface GenerateResult {
  ok: boolean;
  urls: string[];
  jobId: string | null;
  message: string;
}

/**
 * Goi Edge Function ai-generate.
 *
 * Function tu tao dong trong ai_jobs, giai ma key cua ban, goi nha cung cap, va
 * tai anh len storage. Anh tra ve la BAN NHAP — ban tu xem roi chon gan vao set
 * do, vi anh AI luon phai qua kiem duyet tay.
 */
export async function requestAiImage(args: {
  provider: AiProviderId;
  prompt: string;
  outfitId?: string | null;
  /** Ten mo hinh. De trong thi function dung mac dinh cua nha cung cap. */
  model?: string;
}): Promise<GenerateResult> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, urls: [], jobId: null, message: 'Chưa cấu hình Supabase.' };
  }

  try {
    const { data, error } = await sb.functions.invoke('ai-generate', {
      body: {
        provider: args.provider,
        prompt: args.prompt,
        outfitId: args.outfitId ?? null,
        ...(args.model ? { model: args.model } : {}),
      },
    });

    if (error) {
      return {
        ok: false, urls: [], jobId: null,
        message:
          `Không gọi được ai-generate: ${error.message}. ` +
          'Nếu chưa triển khai function này, xem supabase/functions/README.md.',
      };
    }

    const r = data as { ok: boolean; urls?: string[]; jobId?: string; error?: string; note?: string };

    return r?.ok
      ? {
          ok: true,
          urls: r.urls ?? [],
          jobId: r.jobId ?? null,
          message: r.note ?? 'Đã tạo ảnh.',
        }
      : {
          ok: false,
          urls: [],
          jobId: r?.jobId ?? null,
          message: r?.error ?? 'Tạo ảnh thất bại, không rõ lý do.',
        };
  } catch (e) {
    return {
      ok: false, urls: [], jobId: null,
      message: `Lỗi khi gọi ai-generate: ${(e as Error).message}`,
    };
  }
}
