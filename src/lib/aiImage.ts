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
  /*
    NEN TRANG DUNG DAU VA LA MAC DINH, theo yeu cau cua chu website.

    Day cung la lua chon dung cho muc dich cua trang: anh o day de NHIN RO BO
    DO. Mot con pho hay mot quan ca phe deu dep hon, nhung chung dua vao khung
    hinh mau sac va chi tiet canh tranh voi chinh mon do — va tren mot the nho
    trong luoi thi thu nguoi ta thay truoc la cai nen chu khong phai cai ao.

    Nen trang con mot loi nua: no ghep duoc voi nhau. Muoi bai anh nen trang
    nam canh nhau thanh mot bo; muoi bai moi bai mot boi canh thi thanh mot
    dong anh nhat tu nhieu noi.
  */
  { id: 'trang', label: 'Nền trắng (mặc định)',
    en: 'pure white seamless background, soft even studio lighting, subject fully separated from background, no props, no shadows on the backdrop' },
  { id: 'studio', label: 'Phông studio trơn', en: 'seamless neutral studio backdrop, soft even lighting' },
  { id: 'pho', label: 'Phố Việt Nam', en: 'quiet Vietnamese city street, morning light, shallow depth of field' },
  { id: 'cafe', label: 'Quán cà phê', en: 'minimal cafe interior, warm window light' },
  { id: 'kien-truc', label: 'Kiến trúc tối giản', en: 'minimal concrete architecture, overcast daylight' },
  { id: 'bien', label: 'Ven biển', en: 'coastal boardwalk, late afternoon sun' },
] as const;

/**
 * Goc nguoi mau, doi theo TUNG LAN TAO.
 *
 * Truoc day cau lenh viet cung "one Southeast Asian man" — moi anh tren ca
 * website deu la mot kieu nguoi. Chu website muon doi ngau nhien theo tung lan,
 * va do la yeu cau dung: mot trang thoi trang chi co mot kieu nguoi mau thi
 * nguoi xem khong thay minh trong do.
 *
 * KHONG NGAU NHIEN THAT SU ma xoay theo so `variation` — cung mot bai bam tao
 * lai se ra goc nguoi khac, nhung mot cau lenh cu the luon cho ra cung mot ket
 * qua. Ngau nhien that se lam khong ai lap lai duoc mot anh da thich.
 */
export const MODEL_ORIGINS = [
  'Southeast Asian', 'East Asian', 'South Asian', 'European',
  'Latin American', 'West African', 'Middle Eastern',
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
  /** Co gui anh tung mon lam mau tham chieu khong. Doi cach viet cau lenh. */
  hasReferences?: boolean;
  /**
   * So lan bam "tao lai". Moi lan doi nhe cau lenh — gui y het thi mo hinh hay
   * tra ve anh gan giong anh cu, bam ba lan van thay nhu mot.
   */
  variation?: number;
}

/** Vai tro can co de mot bo do trong hoan chinh trong anh. */
const CORE_ROLES: Array<{ key: string; match: RegExp; filler: string }> = [
  { key: 'top',    match: /áo|ao/i,          filler: 'a plain well-fitted top in a neutral tone' },
  { key: 'bottom', match: /quần|quan/i,      filler: 'plain straight-leg trousers in a neutral tone' },
  { key: 'shoes',  match: /giày|giay/i,      filler: 'simple low-profile sneakers in a neutral tone' },
];

/**
 * Nhung vai tro chua co trong set, de cau lenh tu bu vao.
 *
 * VI SAO PHAI BU
 *   Nguoi dang co the moi nhap ao va quan. Neu cau lenh chi noi hai mon do thi
 *   mo hinh tu bia ra giay — thuong la mot doi loe loet pha het tong mau. Noi
 *   ro "giay tron, mau trung tinh" thi phan bu do khong cuop mat su chu y khoi
 *   nhung mon that su co trong set.
 */
function fillersFor(items: PromptInput['items']): string[] {
  const have = items.map((i) => i.roleLabel).join(' ');
  return CORE_ROLES.filter((r) => !r.match.test(have)).map((r) => r.filler);
}

/**
 * Ban tieng Viet cua goc nguoi mau, dung cho khung "Dang yeu cau AI nhung gi".
 *
 * Phai cung THU TU voi MODEL_ORIGINS, vi ca hai deu duoc chon bang cung mot so
 * `variation`. Lech thu tu thi cau lenh that va cau giai thich se noi hai dieu
 * khac nhau — va nguoi dung tin cau giai thich.
 */
const MODEL_ORIGIN_VI = [
  'Đông Nam Á', 'Đông Á', 'Nam Á', 'châu Âu',
  'Mỹ Latinh', 'Tây Phi', 'Trung Đông',
] as const;

/** Ban tieng Viet cua cac mon duoc bu them, de khung giai thich khong lan tieng Anh. */
const FILLER_VI: Record<string, string> = {
  'a plain crew-neck t-shirt in a neutral tone': 'một áo thun cổ tròn trơn, màu trung tính',
  'plain straight-leg trousers in a neutral tone': 'một quần ống suông trơn, màu trung tính',
  'simple low-profile sneakers in a neutral tone': 'một đôi giày đế thấp đơn giản, màu trung tính',
};

/** Cach dien dat khac nhau cho tung lan bam "tao lai". */
const VARIATIONS = [
  '',
  ' Slightly different camera angle and pose from a typical catalogue shot.',
  ' Three-quarter view, weight on one leg, hands relaxed.',
  ' Slightly wider framing with more headroom and floor visible.',
  ' Softer directional light from one side.',
];

/**
 * Dung cau lenh. Viet bang tieng Anh vi cac mo hinh tao anh hieu tieng Anh tot
 * hon nhieu — day la ly do ky thuat, khong phai lua chon tham my.
 */
export function buildImagePrompt(input: PromptInput): string {
  const scene = SCENES.find((s) => s.id === input.sceneId) ?? SCENES[0];
  const model = MODEL_TYPES.find((m) => m.id === input.modelTypeId) ?? MODEL_TYPES[1];
  const goc = MODEL_ORIGINS[(input.variation ?? 0) % MODEL_ORIGINS.length];
  const variation = VARIATIONS[(input.variation ?? 0) % VARIATIONS.length];

  /*
    LIET KE TUNG MON MOT DONG, KHONG GOP THANH MOT CAU.

    Ban truoc noi het bon mon trong mot cau ngan cach bang dau cham phay. Mo
    hinh doc mot cau dai thi de bo sot mon cuoi, va cang de bo sot khi cau do
    con phai mang ca ten hang lan ten mau.

    Moi mon mot dong co dau sao la cach danh sach duoc doc nhu mot danh sach —
    mo hinh xu ly tot hon han, va nguoi doc cau lenh cung kiem tra duoc bang
    mat la du hay thieu mon.

    KHI CO ANH DINH KEM thi tung mon ghi "as shown in the attached image" chu
    khong ta bang chu. Mot cau chu khong bao gio ta noi mot hoa tiet hay mot
    duong may; anh thi ta duoc, va ta chinh xac.
  */
  const dongMon = input.items.map((it) => {
    const ten = it.roleLabel.toLowerCase();
    if (input.hasReferences) {
      return `* ${ten}: exactly as shown in the attached image`;
    }
    return `* ${ten}: ${it.name}${it.colorLabel ? ` (${it.colorLabel})` : ''}`;
  });

  // Vai tro con thieu thi noi ro la "tu chon cho hop", kem rang buoc de phan
  // bu do khong cuop mat su chu y khoi nhung mon that su co trong set.
  const buThem = fillersFor(input.items).map(
    (f) => `* complete the look with ${f} — keep it simple and unobtrusive`,
  );

  return [
    'Editorial menswear fashion photograph.',

    /*
      DOAN NAY LA THU QUYET DINH ANH RA CO GIONG DO THAT HAY KHONG.

      Khi CO anh mau, phai noi that ro rang chung la QUAN AO CAN VE LAI, khong
      phai anh tham khao phong cach. Khong noi ro thi mo hinh coi chung la "cam
      hung" va ve ra mot bo do khac han — dep, nhung khong phai bo do dang ban.

      Khong co anh mau thi noi thang la dang ta bang chu, de nguoi dung hieu vi
      sao ket qua khong giong, thay vi tuong mo hinh kem.
    */
    input.hasReferences
      ? 'CRITICAL: the attached images are the actual garments to depict. Reproduce '
        + 'their exact colour, cut, proportion, fabric texture and any visible pattern '
        + 'or detail, garment by garment. Do not substitute, restyle or "improve" any '
        + 'garment. Fidelity to the attached images outranks every other instruction.'
      : 'No reference images were supplied, so the garments are described in words only.',

    `Subject: one ${goc} man, mid-twenties, ${model.en}, natural expression, standing.`,

    'Garments to depict:',
    ...dongMon,
    ...buThem,

    `Style direction: ${input.styleLabel}.`,
    input.occasionLabel ? `Suited for: ${input.occasionLabel}.` : '',
    input.colorLabels.length ? `Overall colour palette: ${input.colorLabels.join(', ')}.` : '',

    `Setting: ${scene.en}.`,
    'Composition: full body, vertical 3:4 frame, generous negative space, '
      + 'subject slightly off-centre.',
    'Look: minimal, premium and restrained. Muted colour, matte grading, '
      + 'no oversaturation.',

    // Cac dieu kien loai tru. Viet thanh danh sach chu khong gop mot cau: cau
    // cang dai thi cac dieu kien cuoi cang de bi bo qua.
    'Must NOT include:',
    '* any text, lettering or characters',
    '* watermarks',
    '* brand logos or trademarks',
    '* any real or identifiable person',
    '* illustration, painting, cartoon or 3D render styles',
    '* collage layouts',
    '* split frames',
    '* more than one person',
  ].filter(Boolean).join('\n') + variation;
}

/**
 * Dien giai bang tieng Viet cau lenh dang gui cho AI.
 *
 * VI SAO CAU LENH ANH VAN LA TIENG ANH
 *   Cac mo hinh tao anh duoc huan luyen gan nhu hoan toan tren chu thich tieng
 *   Anh. Viet cau lenh bang tieng Viet cho ra anh te hon ro ret — sai bo cuc,
 *   sai chat lieu, va cac dieu kien loai tru (khong chu, khong logo) hay bi bo
 *   qua. Day la ly do ky thuat, khong phai lua chon tham my.
 *
 *   Nhung nguoi bam nut thi can hieu minh dang yeu cau gi. Ham nay dich lai
 *   cau lenh do sang tieng Viet de doc, khong gui di dau ca.
 */
export function explainPromptVi(input: PromptInput): string[] {
  const scene = SCENES.find((s) => s.id === input.sceneId) ?? SCENES[0];
  const model = MODEL_TYPES.find((m) => m.id === input.modelTypeId) ?? MODEL_TYPES[1];
  const goc = MODEL_ORIGIN_VI[(input.variation ?? 0) % MODEL_ORIGIN_VI.length];

  const dongMon = input.items.length
    ? input.items.map((it) => {
        const ten = it.roleLabel.toLowerCase();
        return input.hasReferences
          ? `   * ${ten}: theo hình đính kèm`
          : `   * ${ten}: ${it.name}${it.colorLabel ? ` (${it.colorLabel})` : ''}`;
      })
    : ['   * (chưa nhập món nào)'];

  const buThem = fillersFor(input.items).map(
    (f) => `   * hoàn thiện bằng ${FILLER_VI[f] ?? f} — thiết kế đơn giản, màu trung tính`,
  );

  return [
    'Ảnh thời trang nam theo phong cách editorial.',
    input.hasReferences
      ? 'Ảnh của từng món được ĐÍNH KÈM cùng câu lệnh; AI được yêu cầu vẽ lại đúng '
        + 'màu, phom, chất vải và hoạ tiết trong những ảnh đó.'
      : 'Không có ảnh đính kèm, nên toàn bộ trang phục chỉ được mô tả bằng chữ — '
        + 'kết quả sẽ không giống sản phẩm thật.',
    `Chủ thể: một nam giới ${goc}, khoảng 25 tuổi, ${model.label.toLowerCase()}, `
      + 'biểu cảm tự nhiên, đứng tạo dáng.',
    'Trang phục cần thể hiện:',
    ...dongMon,
    ...buThem,
    `Phong cách: ${input.styleLabel || '(chưa chọn)'}.`
      + (input.occasionLabel ? ` Dịp: ${input.occasionLabel}.` : ''),
    input.colorLabels.length ? `Tông màu tổng thể: ${input.colorLabels.join(', ')}.` : '',
    `Bối cảnh: ${scene.label}.`,
    'Bố cục: chụp toàn thân, khung hình dọc tỷ lệ 3:4, nhiều khoảng trống, '
      + 'chủ thể đứng hơi lệch khỏi trung tâm.',
    'Phong cách hình ảnh: tinh giản, cao cấp và tiết chế. Màu nhẹ, xử lý màu lì, '
      + 'không bão hoà quá mức.',
    'Không được xuất hiện:',
    '   * chữ viết hoặc ký tự',
    '   * watermark',
    '   * logo thương hiệu hoặc nhãn hiệu',
    '   * người thật hoặc khuôn mặt có thể nhận diện',
    '   * phong cách minh hoạ, tranh vẽ, hoạt hình hoặc ảnh dựng 3D',
    '   * bố cục collage',
    '   * khung hình chia đôi',
    '   * nhiều người trong cùng một ảnh',
  ].filter(Boolean);
}

/**
 * Cau lenh yeu cau AI viet MO TA SET DO bang tieng Viet.
 *
 * Khac cau lenh tao anh: cai nay viet bang tieng Viet, vi day la mo hinh ngon
 * ngu chu khong phai mo hinh anh, va ket qua phai ra tieng Viet tu nhien cho
 * nguoi Viet doc.
 *
 * Rang buoc quan trong nhat nam o hai dong cuoi: KHONG duoc bia them mon,
 * bia gia hay bia thuong hieu. Mot mo ta nghe hay nhung noi sai san pham la
 * thu gay hai that cho nguoi mua.
 */
export function buildDescriptionPrompt(input: PromptInput): string {
  const garments = input.items
    .map((it) => `${it.roleLabel.toLowerCase()}: ${it.name}${it.colorLabel ? ` (${it.colorLabel})` : ''}`)
    .join('; ');

  return [
    'Viết mô tả cho một set đồ nam trên website gợi ý phối đồ tại Việt Nam.',
    '',
    `Tên set: ${input.outfitTitle || '(chưa đặt)'}`,
    `Phong cách: ${input.styleLabel}`,
    `Dịp mặc: ${input.occasionLabel}`,
    `Màu chủ đạo: ${input.colorLabels.join(', ') || '(chưa chọn)'}`,
    `Các món: ${garments || '(chưa nhập)'}`,
    '',
    'Yêu cầu:',
    '- Viết bằng tiếng Việt, 2 đến 3 câu, tổng dưới 60 từ.',
    '- Giọng bình thường, như một người bạn rành ăn mặc đang gợi ý. Không hoa mỹ, không dùng từ như "đẳng cấp", "sang chảnh", "must-have".',
    '- Nói được vì sao các món này hợp nhau, và mặc dịp nào thì đúng.',
    '- Không dùng dấu chấm than. Không dùng biểu tượng cảm xúc.',
    '- CHỈ nói về những món đã liệt kê ở trên. Không thêm món nào khác.',
    '- Không nhắc tới giá, không nhắc tên thương hiệu, không hứa hẹn chất lượng.',
    '',
    'Chỉ trả về đoạn mô tả, không thêm lời dẫn.',
  ].join('\n');
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
/**
 * Lay THONG BAO THAT tu mot loi cua Edge Function.
 *
 * VI SAO PHAI CO HAM NAY
 *   Khi function tra ve ma trang thai khac 2xx, thu vien supabase-js nem ra
 *   `FunctionsHttpError` voi noi dung co dinh "Edge Function returned a non-2xx
 *   status code" — vo nghia voi nguoi dung. Noi dung that ("Da het han muc
 *   Gemini cho hom nay…") nam trong `error.context`, chinh la doi tuong Response
 *   goc, va se mat luon neu khong ai mo ra doc.
 *
 *   Truoc day cho nay chi hien cau vo nghia do kem loi khuyen sai la "xem
 *   README" — trong khi function chay hoan toan binh thuong va da noi ro van de
 *   bang tieng Viet.
 *
 * `clone()` truoc khi doc: than Response chi doc duoc mot lan, va co the co cho
 * khac cung dang muon doc no.
 */
async function edgeErrorMessage(error: unknown, fallbackHint: string): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;

  if (ctx && typeof (ctx as Response).clone === 'function') {
    try {
      const body = (await (ctx as Response).clone().json()) as { error?: string };
      if (typeof body?.error === 'string' && body.error.trim()) {
        return withQuotaHelp(body.error.trim());
      }
    } catch {
      // Khong phai JSON — roi xuong duoi dung thong bao chung.
    }
  }

  return `${(error as Error)?.message ?? 'Lỗi không rõ'}. ${fallbackHint}`;
}

/**
 * Loi het han muc: NOI MOT CAU, CHI MOT NOI CAN DEN.
 *
 * ===========================================================================
 * BAN TRUOC DAN HAI CAU VAO NHAU VA CHI RA HAI CHO KHAC NHAU.
 *
 * No lay nguyen cau loi cua Google — cau do dan toi ai.google.dev — roi noi
 * them cau cua toi, dan toi aistudio.google.com. Nguoi doc nhan duoc hai dia
 * chi cho cung mot viec va khong biet vao cai nao. Chu website bao dung dieu
 * do. Loi cua toi.
 *
 * Ban nay THAY HAN cau cua Google chu khong noi them. Cau goc van duoc giu o
 * cuoi trong ngoac cho ai muon tra cuu, nhung no khong con la thu doc dau
 * tien.
 * ===========================================================================
 *
 * HAI TINH HUONG KHAC HAN NHAU, va goi chung la "het han muc" thi sai mot nua:
 *
 *   limit = 0  -> Du an Google cua key nay KHONG CO han muc mien phi nao ca,
 *                 ke ca cho viet chu. Cho den sang mai cung khong co gi doi.
 *                 Phai tao key trong mot du an KHAC, hoac bat thanh toan.
 *
 *   limit > 0  -> Da dung het phan cua hom nay. Doi sang ngay mai la lai chay.
 *
 * Phan biet duoc hai cai nay la khac biet giua "cho mot ngay vo ich" va "lam
 * dung viec can lam".
 */
function withQuotaHelp(message: string): string {
  if (!/hạn mức|quota|429|limit/i.test(message)) return message;

  // "limit: 0", "limit_value: 0", "limit\": 0" — Google viet moi noi mot kieu.
  const hetSach = /limit[^0-9a-z]{0,12}0(\D|$)/i.test(message);

  const gocRutGon = message.length > 220 ? message.slice(0, 220) + '…' : message;

  if (hetSach) {
    return (
      'Dự án Google của key này không có hạn mức miễn phí nào — kể cả cho viết chữ. ' +
      'Chờ sang ngày mai cũng không thay đổi. Cách sửa: vào aistudio.google.com/apikey, ' +
      'bấm "Create API key in new project" để lấy key trong một dự án mới, rồi dán key ' +
      'đó vào ô API key ở đây. Nếu vẫn cần dựng ảnh thì phải bật thanh toán cho dự án ' +
      `trên Google Cloud. (Nguyên văn lỗi: ${gocRutGon})`
    );
  }

  return (
    'Đã dùng hết hạn mức của hôm nay. Sang ngày mai là dùng lại được. ' +
    'Nếu cần dùng ngay thì vào aistudio.google.com/apikey lấy key trong một dự án ' +
    `khác, rồi dán vào ô API key ở đây. (Nguyên văn lỗi: ${gocRutGon})`
  );
}

export async function requestAiImage(args: {
  provider: AiProviderId;
  prompt: string;
  outfitId?: string | null;
  /** Ten mo hinh. De trong thi function dung mac dinh cua nha cung cap. */
  model?: string;
  /** Anh tung mon, gui kem lam mau tham chieu. */
  referenceUrls?: string[];
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
        ...(args.referenceUrls?.length ? { referenceUrls: args.referenceUrls } : {}),
        ...(args.model ? { model: args.model } : {}),
      },
    });

    if (error) {
      return {
        ok: false, urls: [], jobId: null,
        message: await edgeErrorMessage(
          error,
          'Nếu chưa triển khai function ai-generate, xem supabase/functions/README.md.',
        ),
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
          message: withQuotaHelp(r?.error ?? 'Tạo ảnh thất bại, không rõ lý do.'),
        };
  } catch (e) {
    return {
      ok: false, urls: [], jobId: null,
      message: `Lỗi khi gọi ai-generate: ${(e as Error).message}`,
    };
  }
}

/**
 * Goi AI viet mo ta set do bang tieng Viet.
 *
 * Dung chung Edge Function `ai-generate` voi `mode: 'text'`. Ly do dung chung
 * thay vi viet function moi: khoa API da duoc ma hoa va giai ma o do roi, tach
 * ra function thu hai nghia la nhan doi doan ma cham vao khoa — cang it noi
 * cham vao khoa cang tot.
 */
export async function requestAiDescription(args: {
  provider: AiProviderId;
  prompt: string;
  model?: string;
}): Promise<{ ok: boolean; text: string; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, text: '', message: 'Chưa cấu hình Supabase.' };

  try {
    const { data, error } = await sb.functions.invoke('ai-generate', {
      body: {
        mode: 'text',
        provider: args.provider,
        prompt: args.prompt,
        ...(args.model ? { model: args.model } : {}),
      },
    });

    if (error) {
      return {
        ok: false, text: '',
        message: await edgeErrorMessage(
          error,
          'Nếu chưa triển khai function ai-generate, xem supabase/functions/README.md.',
        ),
      };
    }

    const r = data as { ok: boolean; text?: string; error?: string };
    return r?.ok && r.text
      ? { ok: true, text: r.text.trim(), message: 'Đã tạo mô tả. Đọc lại rồi sửa cho đúng ý bạn.' }
      : {
          ok: false, text: '',
          message: withQuotaHelp(r?.error ?? 'Tạo mô tả thất bại, không rõ lý do.'),
        };
  } catch (e) {
    return { ok: false, text: '', message: `Lỗi khi gọi ai-generate: ${(e as Error).message}` };
  }
}
