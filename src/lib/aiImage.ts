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

export type AiProviderId = 'gemini' | 'openai' | 'xai';

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
  // Nen mau tron: van la nen studio nhung doi duoc tong, cho ai muon anh khong
  // trang toat. Van giu "khong dao cu, khong hoa tiet" de mon do van la thu
  // duoc nhin truoc tien.
  { id: 'nen-be', label: 'Nền be', en: 'seamless warm beige background, soft even studio lighting, no props' },
  { id: 'nen-xam', label: 'Nền xám', en: 'seamless light grey background, soft even studio lighting, no props' },
  { id: 'nen-xanh', label: 'Nền xanh nhạt', en: 'seamless pale blue-grey background, soft even studio lighting, no props' },
  { id: 'nen-den', label: 'Nền tối', en: 'seamless charcoal background, soft directional studio lighting, no props' },
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

/**
 * Kieu nguoi mau.
 *
 * NGAU NHIEN LA MAC DINH, theo yeu cau cua chu website. Mot trang thoi trang
 * chi co mot kieu nguoi mau thi nguoi xem khong thay minh trong do.
 *
 * "Ngau nhien" o day KHONG phai Math.random(): no xoay theo so `variation`,
 * giong cach goc nguoi mau dang lam. Nho vay cung mot cau lenh luon cho ra
 * cung mot ket qua — bam "doi cach dien dat" thi doi nguoi, con bam lai dung
 * cau lenh cu thi ra dung anh cu. Ngau nhien that se lam khong ai lap lai duoc
 * mot tam anh da thich.
 */
export const MODEL_TYPES = [
  { id: 'ngau-nhien', label: 'Ngẫu nhiên (mặc định)', en: '' },
  { id: 'gay', label: 'Gầy, cao', en: 'slim build, tall' },
  { id: 'can-doi', label: 'Cân đối', en: 'average athletic build' },
  { id: 'to', label: 'Vai rộng', en: 'broad-shouldered, solid build' },
] as const;

/** Cac dang nguoi that su dung duoc khi chon "ngau nhien". */
const MODEL_TYPES_THAT = MODEL_TYPES.filter((m) => m.en !== '');

/** Chon dang nguoi mau: theo lua chon cua nguoi dung, hoac xoay theo variation. */
function chonDangNguoi(modelTypeId: string, variation: number) {
  const chon = MODEL_TYPES.find((m) => m.id === modelTypeId);
  if (chon && chon.en) return chon;
  return MODEL_TYPES_THAT[variation % MODEL_TYPES_THAT.length];
}

export interface PromptInput {
  outfitTitle: string;
  styleLabel: string;
  occasionLabel: string;
  /** Ten mau tieng Viet, vi du ['Trắng', 'Đen'] */
  colorLabels: string[];
  /** Mo ta tung mon: 'Áo: áo thun trơn trắng' */
  items: Array<{
    roleLabel: string;
    name: string;
    colorLabel?: string;
    /**
     * RIENG MON NAY co anh de dinh kem khong.
     *
     * Truoc day chi co mot co chung cho ca set (`hasReferences`), va no sai
     * ngay khi set khong dong deu: hai mon co anh, hai mon khong, thi cau lenh
     * van ghi ca bon la "theo anh dinh kem". Hai mon khong co anh thanh ra
     * khong duoc ta gi ca — mo hinh tu bia, va nguoi doc cau lenh khong he
     * biet minh vua yeu cau mot thu khong ton tai.
     *
     * Khong dat thi lay theo co chung, de cho goi cu khong doi hanh vi.
     */
    hasImage?: boolean;
  }>;
  sceneId: string;
  modelTypeId: string;
  /** Co chung cho ca set. Chi con dung khi tung mon khong noi ro. */
  hasReferences?: boolean;
  /**
   * So lan bam "tao lai". Moi lan doi nhe cau lenh — gui y het thi mo hinh hay
   * tra ve anh gan giong anh cu, bam ba lan van thay nhu mot.
   */
  variation?: number;
}

/** Vai tro can co de mot bo do trong hoan chinh trong anh. */
const CORE_ROLES: Array<{ key: string; match: RegExp; filler: string; vi: string }> = [
  { key: 'top',    match: /áo|ao/i,     filler: 'top',      vi: 'áo' },
  { key: 'bottom', match: /quần|quan/i, filler: 'trousers', vi: 'quần' },
  { key: 'shoes',  match: /giày|giay/i, filler: 'footwear', vi: 'giày' },
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

/** Ban tieng Viet cua ten vai tro duoc bu them. */
const FILLER_VI: Record<string, string> = {
  top: 'áo',
  trousers: 'quần',
  footwear: 'giày',
};

/** Cach dien dat khac nhau cho tung lan bam "tao lai". */
const VARIATIONS = [
  '',
  ' Slightly different camera angle and pose from a typical catalogue shot.',
  ' Three-quarter view, weight on one leg, hands relaxed.',
  ' Slightly wider framing with more headroom and floor visible.',
  ' Softer directional light from one side.',
];

/** Mon nay co anh de dinh kem khong. Mon khong noi ro thi theo co chung cua set. */
function coAnh(it: PromptInput['items'][number], input: PromptInput): boolean {
  return it.hasImage ?? input.hasReferences ?? false;
}

/** Ten cac mon dang PHAI ta bang chu vi chua co anh. Dung de canh bao nguoi dung. */
export function monChuaCoAnh(input: PromptInput): string[] {
  return input.items.filter((it) => !coAnh(it, input)).map((it) => it.roleLabel.toLowerCase());
}

/**
 * Dung cau lenh. Viet bang tieng Anh vi cac mo hinh tao anh hieu tieng Anh tot
 * hon nhieu — day la ly do ky thuat, khong phai lua chon tham my.
 */
export function buildImagePrompt(input: PromptInput): string {
  const scene = SCENES.find((s) => s.id === input.sceneId) ?? SCENES[0];
  const model = chonDangNguoi(input.modelTypeId, input.variation ?? 0);
  const goc = MODEL_ORIGINS[(input.variation ?? 0) % MODEL_ORIGINS.length];
  const variation = VARIATIONS[(input.variation ?? 0) % VARIATIONS.length];
  const soCoAnh = input.items.filter((it) => coAnh(it, input)).length;

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
  /*
    HAI LOAI DONG, VA CHI HAI.

      CO ANH     -> "dung nhu anh dinh kem". Het. KHONG ta ten, khong ta mau.
      KHONG ANH  -> "tu chon cho hop bo do".

    VI SAO BO HAN PHAN TA BANG CHU
      Mot cau chu khong bao giờ ta noi mot hoa tiet, mot duong may, mot sac
      xam cu the. Dua ten hang vao chi lam mo hinh doc mot chuoi tu khoa quang
      cao roi ve theo tri tuong tuong cua no — ket qua KHONG giong mon do that,
      ma lai trong nhu that. Do la kieu sai nguy hiem nhat cho mot trang gan
      link mua hang.

      Anh thi ta duoc, va ta chinh xac. Mon nao co anh thi de anh noi; mon nao
      khong co thi noi thang la de mo hinh tu chon, dung gia vo la biet.
  */
  const dongMon = input.items.map((it) => {
    const ten = it.roleLabel.toLowerCase();
    return coAnh(it, input)
      ? `* ${ten}: exactly as shown in the attached image`
      : `* ${ten}: your choice — pick something that suits the rest of the outfit, `
        + 'plain and understated';
  });

  // Vai tro con THIEU HAN trong set (khong co dong nao) cung de mo hinh tu
  // chon. Truoc day cho nay ta san "giay de thap mau trung tinh" — mot mo ta
  // ma khong ai yeu cau, va no cuop mat su chu y khoi nhung mon that.
  const buThem = fillersFor(input.items).map(
    (f) => `* ${f}: your choice — pick something that suits the rest of the outfit, `
      + 'plain and understated',
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
    /*
      BA TRUONG HOP, khong phai hai. Truoc day chi co "co anh" va "khong co
      anh", nen mot set nua co nua khong roi vao nhanh "co anh" va cau lenh noi
      doi ve nhung mon con lai.
    */
    soCoAnh === 0
      ? 'No reference images were supplied, so the garments are described in words only.'
      : 'CRITICAL: the attached images are the actual garments to depict. Reproduce '
        + 'their exact colour, cut, proportion, fabric texture and any visible pattern '
        + 'or detail, garment by garment. Do not substitute, restyle or "improve" any '
        + 'garment. Fidelity to the attached images outranks every other instruction.'
        + (soCoAnh < input.items.length
          ? ' Only the garments marked "as shown in the attached image" have a reference; '
            + 'the remaining garments are described in words and must NOT be copied from '
            + 'the attached images.'
          : ''),

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
  const model = chonDangNguoi(input.modelTypeId, input.variation ?? 0);
  const goc = MODEL_ORIGIN_VI[(input.variation ?? 0) % MODEL_ORIGIN_VI.length];
  const soCoAnh = input.items.filter((it) => coAnh(it, input)).length;

  const dongMon = input.items.length
    ? input.items.map((it) => {
        const ten = it.roleLabel.toLowerCase();
        return coAnh(it, input)
          ? `   * ${ten}: đúng như ảnh đính kèm`
          : `   * ${ten}: để AI tự chọn cho hợp bộ đồ (món này chưa có ảnh)`;
      })
    : ['   * (chưa nhập món nào)'];

  const buThem = fillersFor(input.items).map(
    (f) => `   * ${FILLER_VI[f] ?? f}: set chưa có món này — để AI tự chọn cho hợp`,
  );

  return [
    'Ảnh thời trang nam theo phong cách editorial.',
    // Phai khop tung nhanh voi buildImagePrompt o tren. Nguoi dung tin dong nay
    // chu khong doc cau lenh tieng Anh, nen lech mot nhanh la noi doi voi ho.
    soCoAnh === 0
      ? 'Không món nào có ảnh đính kèm, nên AI tự dựng toàn bộ bộ đồ — kết quả sẽ '
        + 'không liên quan gì tới sản phẩm thật.'
      : soCoAnh === input.items.length
        ? 'Ảnh của từng món được ĐÍNH KÈM cùng câu lệnh; AI được yêu cầu vẽ lại đúng '
          + 'màu, phom, chất vải và hoạ tiết trong những ảnh đó.'
        : `${soCoAnh}/${input.items.length} món có ảnh đính kèm và được vẽ đúng theo ảnh. `
          + 'Các món còn lại để AI tự chọn cho hợp bộ đồ — không tả bằng chữ, vì một câu '
          + 'chữ không bao giờ tả đúng được một món đồ cụ thể.',
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
async function edgeErrorMessage(
  error: unknown,
  fallbackHint: string,
  /** Viec dang lam. Quyet dinh cau giai thich khi han muc bang 0. */
  viec: 'text' | 'image' = 'image',
): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;

  if (ctx && typeof (ctx as Response).clone === 'function') {
    try {
      const body = (await (ctx as Response).clone().json()) as { error?: string };
      if (typeof body?.error === 'string' && body.error.trim()) {
        return withQuotaHelp(body.error.trim(), viec);
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
function withQuotaHelp(message: string, viec: 'text' | 'image' = 'image'): string {
  if (!/hạn mức|quota|429|limit/i.test(message)) return message;

  // "limit: 0", "limit_value: 0", "limit\": 0" — Google viet moi noi mot kieu.
  const hetSach = /limit[^0-9a-z]{0,12}0(\D|$)/i.test(message);

  const gocRutGon = message.length > 220 ? message.slice(0, 220) + '…' : message;

  if (hetSach) {
    /*
      HAI CAU KHAC NHAU CHO HAI VIEC, va truoc day chi co mot.

      Cau cu ghi "khong co han muc mien phi nao — KE CA CHO VIET CHU". Voi key
      hien tai cua chu website cau do sai: viet chu chay binh thuong, chi dung
      anh la bang 0. Mot cau bao loi noi sai ve thu vua chay duoc la thu lam
      nguoi ta di sua dung cai khong hong.
    */
    if (viec === 'image') {
      return (
        'Dự án Google của key này không có hạn mức DỰNG ẢNH — gói miễn phí của Google ' +
        'không kèm hạn mức ảnh nào, nên chờ sang ngày mai cũng không đổi. Muốn dựng ảnh ' +
        'thì phải bật thanh toán cho dự án trên Google Cloud. Phần viết chữ có thể vẫn ' +
        `dùng được bằng chính key này. (Nguyên văn lỗi: ${gocRutGon})`
      );
    }

    return (
      'Dự án Google của key này không có hạn mức viết chữ. Chờ sang ngày mai cũng không ' +
      'thay đổi. Cách sửa: vào aistudio.google.com/apikey, bấm "Create API key in new ' +
      `project" để lấy key trong một dự án mới, rồi dán vào ô API key ở đây. (Nguyên văn lỗi: ${gocRutGon})`
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
          'text',
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
