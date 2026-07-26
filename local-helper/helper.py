#!/usr/bin/env python3
"""
PHOI — Local Helper (Bac 2 cua chuoi lay du lieu san pham)

Chay tren may ca nhan cua ban. Nhiem vu: doc thong tin san pham tu link Shopee
hoac TikTok bang mot trinh duyet THAT tren IP nha mang THAT — thu ma Edge
Function tren cloud khong lam duoc vi cac san chan IP trung tam du lieu.

================================================================================
NGUYEN TAC BAO MAT — DOC TRUOC KHI CHAY
================================================================================

1. WEBSITE KHONG GOI DUOC VAO MAY BAN.
   Chuong trinh nay CHU DONG hoi database "co viec gi khong". Website chi ghi
   mot dong vao bang fetch_jobs, khong mo ket noi nao tori may ban. Khong co
   cong nao mo, khong ngrok, khong webhook di vao.

   Hau qua thuc te: neu website bi chiem quyen, ke tan cong toi da tao duoc job
   rac. Khong chay duoc lenh nao tren may ban.

2. CHUONG TRINH NAY CHI LAM DUNG MOT VIEC: mo mot URL da duoc kiem tra ten mien
   va doc noi dung trang. No khong chay lenh he thong, khong doc file ngoai thu
   muc cua no, khong ghi gi ngoai thu muc tam.

3. TEN MIEN DUOC KIEM TRA LAI O DAY, khong tin database.
   Du job den tu dau, URL phai thuoc mot trong cac ten mien goc o
   ALLOWED_ROOT_DOMAINS ben duoi moi duoc mo.

4. KHONG VUOT CAPTCHA.
   Neu trang hoi CAPTCHA, chuong trinh DUNG lai, hien cua so trinh duyet len va
   cho BAN tu bam. Nguoi that giai CAPTCHA khong phai la vuot rao. Neu ban khong
   co mat trong 90 giay thi job bao that bai va website chuyen sang nhap tay.

5. KHONG TU CHAY THEO LICH.
   Chi lam khi co job do NGUOI bam nut tren website tao ra. Khong tu di cao
   hang loat.

6. SERVICE ROLE KEY CHI NAM TRONG local-helper/.env TREN MAY NAY.
   Khoa do bo qua toan bo Row Level Security. Khong bao gio commit, khong bao
   gio dat vao bien co tien to NEXT_PUBLIC_.

================================================================================
CACH CHAY
================================================================================

    cd local-helper
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    playwright install chromium

    cp .env.example .env      # roi dien SUPABASE_URL va SERVICE_ROLE_KEY
    python helper.py

Tuy chon:
    python helper.py --headless     # khong hien cua so (CAPTCHA se that bai)
    python helper.py --once         # xu ly het job dang cho roi thoat
    python helper.py --interval 5   # doi 5 giay giua hai lan hoi
"""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

try:
    import httpx
except ImportError:
    sys.exit("Thieu httpx. Chay: pip install -r requirements.txt")

try:
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import TimeoutError as PlaywrightTimeout
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit(
        "Thieu playwright. Chay:\n"
        "  pip install -r requirements.txt\n"
        "  playwright install chromium"
    )

# ==============================================================================
# Cau hinh
# ==============================================================================

HERE = Path(__file__).resolve().parent

# Ten mien GOC duoc phep. Moi ten mien con cua chung cung duoc phep.
#
# VI SAO KHOP THEO TEN MIEN GOC, KHONG PHAI DANH SACH CUNG
#   Ban dau day la danh sach cung liet ke tung ten mien. Nhung link that cua
#   nguoi dung dung `vn.shp.ee` — khong co trong danh sach, nen he thong tu choi
#   chinh link that. Shopee con nhieu bien the theo quoc gia (th.shp.ee,
#   id.shp.ee, ...) va co the them bat cu luc nao.
#
# Bon noi phai khop nhau: day, is_allowed_affiliate_host() trong SQL,
# ALLOWED_ROOT_DOMAINS trong src/lib/affiliate.ts, va fetch-product/index.ts.
# verify_helper.py doi chieu ca bon.
ALLOWED_ROOT_DOMAINS = {"shopee.vn", "shp.ee", "shope.ee", "tiktok.com"}

# Moi ten mien con cua hai ten mien nay deu la link rut gon
SHORTENER_ROOT_DOMAINS = {"shp.ee", "shope.ee"}

# Ten mien rut gon cu the, khong suy ra tu ten mien goc duoc
SHORTENER_EXACT_HOSTS = {"s.shopee.vn", "vt.tiktok.com", "vm.tiktok.com"}


def is_under_domain(host: str, domain: str) -> bool:
    """
    host bang domain, hoac la ten mien con cua domain.

    Dau cham truoc domain la phan quan trong nhat: khong co no thi
    "evil-shp.ee" se duoc coi la thuoc "shp.ee".
    """
    return host == domain or host.endswith("." + domain)


def is_allowed_host(host: str | None) -> bool:
    if not host:
        return False
    return any(is_under_domain(host, d) for d in ALLOWED_ROOT_DOMAINS)


def is_shortener_host(host: str | None) -> bool:
    if not host:
        return False
    if host in SHORTENER_EXACT_HOSTS:
        return True
    return any(is_under_domain(host, d) for d in SHORTENER_ROOT_DOMAINS)

# Thu muc luu phien trinh duyet. Nho no ma sau khi ban giai CAPTCHA mot lan,
# nhung lan sau thuong khong bi hoi lai nua.
PROFILE_DIR = HERE / ".browser-profile"

PAGE_TIMEOUT_MS = 30_000
CAPTCHA_WAIT_SEC = 90
MAX_ATTEMPTS = 2


def load_env() -> tuple[str, str]:
    """Doc .env don gian, khong can thu vien ngoai."""
    env_path = HERE / ".env"
    values: dict[str, str] = {}

    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"').strip("'")

    url = os.environ.get("SUPABASE_URL") or values.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or values.get(
        "SUPABASE_SERVICE_ROLE_KEY", ""
    )

    if not url or not key:
        sys.exit(
            "Thieu cau hinh.\n\n"
            "  cp .env.example .env\n"
            "  # roi dien SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY\n\n"
            "Lay o Supabase: Project Settings -> API -> service_role key.\n"
            "KHONG dat khoa nay vao file .env.local cua Next.js."
        )

    return url.rstrip("/"), key


# ==============================================================================
# Tien ich
# ==============================================================================

def url_host(raw: str) -> str | None:
    """Giong ham url_host() trong SQL va urlHost() trong TypeScript."""
    if not raw:
        return None
    h = raw.strip().lower()
    h = re.sub(r"^[a-z][a-z0-9+.-]*://", "", h)
    h = re.sub(r"^[^/@]*@", "", h)          # bo user:pass@ — ky thuat che ten mien
    h = re.split(r"[/?#]", h, maxsplit=1)[0]
    h = h.split(":")[0]
    h = re.sub(r"^www\.", "", h)
    return h or None


def platform_of(host: str | None) -> str | None:
    """
    Suy ra nen tang tu ten mien.

    Dung is_under_domain thay vi kiem tra chuoi con ("shopee" in host): chuoi con
    se cho qua ca "shopee.evil.com".
    """
    if not host:
        return None
    if is_under_domain(host, "shopee.vn"):
        return "shopee"
    if is_under_domain(host, "shp.ee") or is_under_domain(host, "shope.ee"):
        return "shopee"
    if is_under_domain(host, "tiktok.com"):
        return "tiktok"
    return None


def parse_price_vnd(text: str | None) -> int | None:
    """
    Doc gia tu chuoi. Tra ve None khi khong chac.

    CO Y THAN TRONG: de bai cam "tu bia gia". Doan sai mot con so gia con te hon
    la de trong cho nguoi dung tu dien, nen khoang gia ("100.000 - 200.000") bi
    tu choi thay vi doan lay so dau.
    """
    if not text:
        return None

    # Khoang gia thi tu choi. Chu y phai cho phep ky hieu tien te nam GIUA con
    # so va dau gach: "100.000₫ - 200.000₫" la khoang gia, khong phai gia 100k.
    if re.search(r"\d[\d.,]*\s*(?:₫|đ|vnd)?\s*[-–—~]\s*\d", text, re.IGNORECASE):
        return None

    m = re.search(r"(\d[\d.,]{2,})\s*(?:₫|đ\b|vnd\b)", text, re.IGNORECASE)
    if not m:
        return None

    digits = re.sub(r"[.,]", "", m.group(1))
    if not digits.isdigit():
        return None

    n = int(digits)
    return n if 10_000 <= n <= 100_000_000 else None


def looks_like_captcha(title: str, body_text: str) -> bool:
    """Nhan dien trang kiem tra bot. Chi de BAO, khong de vuot."""
    haystack = f"{title} {body_text[:3000]}".lower()

    # Bo dau tieng Viet de so khop duoc voi cac tu khoa khong dau ben duoi.
    # NFKD TACH dau ra thanh ky tu ket hop rieng nhung KHONG xoa no — phai loc
    # bo bang unicodedata.combining(), neu khong thi "xac minh" se khong bao gio
    # khop voi "xác minh".
    haystack = "".join(
        c for c in unicodedata.normalize("NFKD", haystack)
        if not unicodedata.combining(c)
    )
    haystack = haystack.replace("đ", "d")

    markers = (
        "captcha", "verify you are human", "xac minh", "unusual traffic",
        "are you a robot", "security check", "kiem tra bao mat",
        "vui long xac nhan", "access denied", "just a moment",
    )
    return any(m in haystack for m in markers)


def log(msg: str, level: str = "info") -> None:
    stamp = time.strftime("%H:%M:%S")
    prefix = {"info": "   ", "ok": " + ", "warn": " ! ", "err": " x "}[level]
    print(f"[{stamp}]{prefix}{msg}", flush=True)


# ==============================================================================
# Client Supabase toi gian (REST)
# ==============================================================================

class Supabase:
    """
    Chi dung REST API, khong can thu vien supabase-py.
    It phu thuoc hon va de doc hon khi can go loi.
    """

    def __init__(self, url: str, service_key: str) -> None:
        self.rest = f"{url}/rest/v1"
        self.client = httpx.Client(
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            timeout=20.0,
        )

    def claim_next_job(self) -> dict[str, Any] | None:
        """
        Nhan mot job dang cho.

        Dat status='claimed' NGAY khi nhan, va chi cap nhat dong dang o
        'pending' (dieu kien eq.pending trong URL). Nho vay neu ban chay hai
        ban Local Helper cung luc thi moi job chi bi lam mot lan.
        """
        r = self.client.get(
            f"{self.rest}/fetch_jobs",
            params={
                "select": "id,source_url,attempts,created_at",
                "status": "eq.pending",
                "order": "created_at.asc",
                "limit": "1",
            },
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return None

        job = rows[0]

        upd = self.client.patch(
            f"{self.rest}/fetch_jobs",
            params={"id": f"eq.{job['id']}", "status": "eq.pending"},
            headers={"Prefer": "return=representation"},
            json={
                "status": "claimed",
                "tier": 2,
                "claimed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "attempts": job.get("attempts", 0) + 1,
            },
        )
        upd.raise_for_status()

        # Rong nghia la ban khac da nhan truoc — bo qua, khong tranh chap.
        return job if upd.json() else None

    def finish(self, job_id: str, result: dict[str, Any]) -> None:
        self.client.patch(
            f"{self.rest}/fetch_jobs",
            params={"id": f"eq.{job_id}"},
            json={
                "status": "done",
                "result": result,
                "error": None,
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        ).raise_for_status()

    def fail(self, job_id: str, message: str, retry: bool) -> None:
        """retry=True thi tra job ve 'pending' de thu lai lan sau."""
        self.client.patch(
            f"{self.rest}/fetch_jobs",
            params={"id": f"eq.{job_id}"},
            json={
                "status": "pending" if retry else "failed",
                "error": message[:1000],
                "completed_at": None if retry else time.strftime(
                    "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                ),
            },
        ).raise_for_status()


# ==============================================================================
# Doc trang bang trinh duyet that
# ==============================================================================

@dataclass
class PageData:
    name: str | None
    price_vnd: int | None
    image_url: str | None
    resolved_url: str
    resolved_host: str | None
    source: str
    raw: dict[str, str]


# Doc the Open Graph truoc. Neu khong co thi moi doc DOM.
# Uu tien nhu vay vi the OG la thu san CHU DONG cong bo de chia se, con DOM thi
# thay doi lien tuc va de vo.
OG_SCRIPT = """() => {
  const out = {};
  for (const m of document.querySelectorAll('meta[property], meta[name]')) {
    const k = m.getAttribute('property') || m.getAttribute('name');
    const v = m.getAttribute('content');
    if (k && v && (k.startsWith('og:') || k.startsWith('twitter:') || k.startsWith('product:'))) {
      if (!out[k]) out[k] = v;
    }
  }
  out['__title'] = document.title || '';
  out['__h1'] = document.querySelector('h1')?.innerText?.trim() || '';
  out['__bodyText'] = (document.body?.innerText || '').slice(0, 4000);
  return out;
}"""


def read_product_page(page: Any, url: str, interactive: bool) -> PageData:
    page.set_default_timeout(PAGE_TIMEOUT_MS)

    # domcontentloaded thay vi networkidle: trang thuong mai dien tu co rat nhieu
    # yeu cau nen bao networkidle gan nhu khong bao gio xay ra.
    page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)

    # Cho phan render phia client kip chay
    try:
        page.wait_for_timeout(2500)
    except PlaywrightError:
        pass

    og: dict[str, str] = page.evaluate(OG_SCRIPT)
    title = og.get("__title", "")
    body_text = og.get("__bodyText", "")

    # --- CAPTCHA ------------------------------------------------------------
    if looks_like_captcha(title, body_text):
        if not interactive:
            raise RuntimeError(
                "Trang hoi CAPTCHA nhung dang chay o che do --headless nen khong "
                "the co nguoi giai. Chay lai khong co --headless, hoac nhap tay tren website."
            )

        log("Trang dang hoi CAPTCHA.", "warn")
        log(f"Cua so trinh duyet dang mo — BAN hay tu giai, toi doi {CAPTCHA_WAIT_SEC} giay.", "warn")
        log("Chuong trinh nay khong tu vuot CAPTCHA.", "warn")

        deadline = time.monotonic() + CAPTCHA_WAIT_SEC
        while time.monotonic() < deadline:
            page.wait_for_timeout(3000)
            og = page.evaluate(OG_SCRIPT)
            if not looks_like_captcha(og.get("__title", ""), og.get("__bodyText", "")):
                log("CAPTCHA da duoc giai, tiep tuc.", "ok")
                break
        else:
            raise RuntimeError(
                f"Khong ai giai CAPTCHA trong {CAPTCHA_WAIT_SEC} giay. "
                "Website se chuyen sang cho nhap tay."
            )

    final_url = page.url
    host = url_host(final_url)

    # --- Ten san pham -------------------------------------------------------
    name = (og.get("og:title") or og.get("twitter:title") or og.get("__h1") or "").strip()
    source = "og" if og.get("og:title") else "dom"

    # Shopee thuong them ' | Shopee Viet Nam' vao sau ten
    name = re.sub(r"\s*\|\s*(Shopee[^|]*|TikTok[^|]*)$", "", name).strip()

    # --- Gia ----------------------------------------------------------------
    price = (
        parse_price_vnd(og.get("product:price:amount"))
        or parse_price_vnd(og.get("og:description"))
        or parse_price_vnd(body_text[:1500])
    )

    # --- Anh ----------------------------------------------------------------
    image = og.get("og:image") or og.get("twitter:image")
    if image and not image.startswith("http"):
        image = urljoin(final_url, image)

    return PageData(
        name=name[:200] or None,
        price_vnd=price,
        image_url=image,
        resolved_url=final_url,
        resolved_host=host,
        source=source,
        raw={k: v for k, v in og.items() if not k.startswith("__")},
    )


# ==============================================================================
# Vong lam viec
# ==============================================================================

_stop = False


def _handle_stop(*_: Any) -> None:
    global _stop
    _stop = True
    print("\nDang dung sau khi xong job hien tai…", flush=True)


def process_job(sb: Supabase, page: Any, job: dict[str, Any], interactive: bool) -> None:
    job_id = job["id"]
    url = job["source_url"]
    attempts = job.get("attempts", 0) + 1

    log(f"Job {job_id[:8]} — {url[:80]}")

    # --- Kiem tra ten mien LAI o day, khong tin database ---------------------
    host = url_host(url)
    if not is_allowed_host(host):
        log(f"Tu choi: ten mien '{host}' khong nam trong danh sach cho phep.", "err")
        sb.fail(job_id, f"Ten mien '{host}' khong duoc phep.", retry=False)
        return

    try:
        data = read_product_page(page, url, interactive)
    except (PlaywrightTimeout, PlaywrightError) as e:
        retry = attempts < MAX_ATTEMPTS
        log(f"Loi trinh duyet: {e}", "err")
        sb.fail(job_id, f"Loi trinh duyet: {e}", retry=retry)
        return
    except RuntimeError as e:
        log(str(e), "err")
        sb.fail(job_id, str(e), retry=False)
        return

    # --- Ten mien SAU khi chuyen huong cung phai sach ------------------------
    # Day la cho chan open redirect: link rut gon co the tro di bat ky dau.
    if not is_allowed_host(data.resolved_host):
        msg = (
            f"Link chuyen huong ra ngoai Shopee/TikTok (den '{data.resolved_host}'). "
            "Tu choi de tranh link danh lua nguoi dung."
        )
        log(msg, "err")
        sb.fail(job_id, msg, retry=False)
        return

    if is_shortener_host(data.resolved_host):
        msg = f"Van con la link rut gon sau khi chuyen huong ('{data.resolved_host}')."
        log(msg, "err")
        sb.fail(job_id, msg, retry=False)
        return

    if not data.name:
        msg = "Mo duoc trang nhung khong doc duoc ten san pham. Can nhap tay."
        log(msg, "warn")
        sb.fail(job_id, msg, retry=False)
        return

    result = {
        "name": data.name,
        "price_vnd": data.price_vnd,
        "image_url": data.image_url,
        "platform": platform_of(data.resolved_host),
        "resolved_url": data.resolved_url,
        "resolved_host": data.resolved_host,
        "source": data.source,
        "raw": data.raw,
    }

    sb.finish(job_id, result)

    price_text = f"{data.price_vnd:,}d".replace(",", ".") if data.price_vnd else "chua ro gia"
    log(f"Xong: {data.name[:60]} — {price_text}", "ok")
    if data.price_vnd is None:
        log("Khong doc duoc gia, nguoi dung se tu dien.", "info")


def main() -> None:
    ap = argparse.ArgumentParser(
        description="PHOI Local Helper — doc thong tin san pham tu link",
    )
    ap.add_argument("--headless", action="store_true",
                    help="Khong hien cua so trinh duyet. CAPTCHA se that bai.")
    ap.add_argument("--once", action="store_true",
                    help="Xu ly het job dang cho roi thoat.")
    ap.add_argument("--interval", type=float, default=3.0,
                    help="So giay giua hai lan hoi database (mac dinh 3).")
    args = ap.parse_args()

    url, key = load_env()
    sb = Supabase(url, key)
    interactive = not args.headless

    signal.signal(signal.SIGINT, _handle_stop)
    signal.signal(signal.SIGTERM, _handle_stop)

    print("=" * 72)
    print("  PHOI Local Helper")
    print("=" * 72)
    print(f"  Database   : {url}")
    print(f"  Che do     : {'co cua so (giai CAPTCHA duoc)' if interactive else 'khong cua so'}")
    print(f"  Nhip hoi   : {args.interval}s")
    print(f"  Phien luu o: {PROFILE_DIR}")
    print()
    print("  Chuong trinh CHU DONG hoi database. Website khong goi vao may nay.")
    print("  Khong tu vuot CAPTCHA. Khong tu chay theo lich.")
    print("  Dung bang Ctrl+C.")
    print("=" * 72)
    print()

    PROFILE_DIR.mkdir(exist_ok=True)

    with sync_playwright() as pw:
        # launch_persistent_context giu cookie va phien giua cac lan chay. Nho
        # vay giai CAPTCHA mot lan la thuong khong bi hoi lai.
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=args.headless,
            locale="vi-VN",
            timezone_id="Asia/Ho_Chi_Minh",
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        idle_notice_at = 0.0

        try:
            while not _stop:
                try:
                    job = sb.claim_next_job()
                except httpx.HTTPError as e:
                    log(f"Khong noi duoc database: {e}", "err")
                    time.sleep(min(args.interval * 4, 30))
                    continue

                if job is None:
                    if args.once:
                        log("Khong con job nao dang cho. Thoat.", "info")
                        break
                    # Nhac moi 60 giay de biet chuong trinh con song, khong spam
                    now = time.monotonic()
                    if now - idle_notice_at > 60:
                        log("Dang cho viec…", "info")
                        idle_notice_at = now
                    time.sleep(args.interval)
                    continue

                try:
                    process_job(sb, page, job, interactive)
                except httpx.HTTPError as e:
                    log(f"Khong bao duoc ket qua ve database: {e}", "err")
                except Exception as e:  # noqa: BLE001
                    # Bat rong o day la co y: mot job loi khong duoc lam sap
                    # ca chuong trinh. Job se duoc bao that bai va di tiep.
                    log(f"Loi khong luong truoc: {type(e).__name__}: {e}", "err")
                    try:
                        sb.fail(job["id"], f"{type(e).__name__}: {e}", retry=False)
                    except httpx.HTTPError:
                        pass
        finally:
            ctx.close()

    print("\nDa dung.")


if __name__ == "__main__":
    main()
