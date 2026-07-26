#!/usr/bin/env python3
"""
Kiem chung cac ham thuan cua Local Helper, va doi chieu cau hinh ten mien giua
BON noi: Python (day), SQL (migration 0003), TypeScript (src/lib/affiliate.ts),
va Edge Function (supabase/functions/fetch-product/index.ts).

Bon noi de bi sua lech nhau. Hau qua rat kho hieu: form bao link hop le nhung
database tu choi, hoac Local Helper mo mot ten mien ma web khong cho nhap.

Nhom 4 co ly do cu the: he thong ban dau dung danh sach ten mien CUNG va da tu
choi chinh link that cua nguoi dung (vn.shp.ee khong co trong danh sach). Cac
phep thu o nhom do khoa lai hanh vi dung sau khi doi sang khop theo ten mien goc.

Chay:  python3 verify_helper.py

Khong can cai httpx hay playwright: hai thu vien do duoc thay bang ban gia lap
truoc khi import, vi cac ham dang kiem tra khong dung tori chung.
"""

from __future__ import annotations

import re
import sys
import types
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

# --- Gia lap httpx va playwright de import duoc helper.py ---------------------
for name in ("httpx",):
    if name not in sys.modules:
        sys.modules[name] = types.ModuleType(name)
        sys.modules[name].HTTPError = type("HTTPError", (Exception,), {})  # type: ignore[attr-defined]
        sys.modules[name].Client = object  # type: ignore[attr-defined]

if "playwright" not in sys.modules:
    pw = types.ModuleType("playwright")
    pw_sync = types.ModuleType("playwright.sync_api")
    pw_sync.Error = type("Error", (Exception,), {})           # type: ignore[attr-defined]
    pw_sync.TimeoutError = type("TimeoutError", (Exception,), {})  # type: ignore[attr-defined]
    pw_sync.sync_playwright = lambda: None                     # type: ignore[attr-defined]
    sys.modules["playwright"] = pw
    sys.modules["playwright.sync_api"] = pw_sync

sys.path.insert(0, str(HERE))
import helper  # noqa: E402

passed = 0
failed = 0


def check(label: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
    if ok:
        passed += 1
    else:
        failed += 1


# =============================================================================
print("\n=== 1. url_host ===")

HOST_CASES = [
    ("https://WWW.Shopee.VN:443/abc?x=1#y", "shopee.vn"),
    ("https://shopee.vn@evil.example.com/x", "evil.example.com"),
    ("https://shopee.vn.evil.example.com/x", "shopee.vn.evil.example.com"),
    ("https://evil.example.com/?u=https://shopee.vn", "evil.example.com"),
    ("https://shp.ee/abc", "shp.ee"),
    ("https://vt.tiktok.com/ZS123/", "vt.tiktok.com"),
    ("", None),
]
for raw, expected in HOST_CASES:
    got = helper.url_host(raw)
    check(f"{raw[:44] or chr(39) * 2} -> {expected}", got == expected,
          "" if got == expected else f"-> {got}")

check("platform_of nhan dien shopee", helper.platform_of("shp.ee") == "shopee")
check("platform_of nhan dien tiktok", helper.platform_of("vt.tiktok.com") == "tiktok")
check("platform_of tra None voi ten mien la", helper.platform_of("evil.example.com") is None)

# =============================================================================
print("\n=== 2. parse_price_vnd — than trong hon la doan sai ===")

PRICE_CASES = [
    ("189.000₫", 189_000),
    ("Giá chỉ 259.000đ hôm nay", 259_000),
    ("1.250.000 VND", 1_250_000),
    ("189,000₫", 189_000),
    # Khoang gia: PHAI tra None, khong duoc doan lay so dau
    ("100.000₫ - 200.000₫", None),
    ("100.000 – 200.000đ", None),
    # Khong co don vi tien
    ("Áo thun form regular size L", None),
    # Qua nho / qua lon, khong hop ly
    ("5₫", None),
    ("999.999.999.999₫", None),
    (None, None),
    ("", None),
]
for text, expected in PRICE_CASES:
    got = helper.parse_price_vnd(text)
    label = (text or "(rong)")[:40]
    check(f"{label!r} -> {expected}", got == expected,
          "" if got == expected else f"-> {got}")

# =============================================================================
print("\n=== 3. looks_like_captcha ===")

CAPTCHA_CASES = [
    ("Verify you are human", "Please complete the CAPTCHA", True),
    ("Just a moment...", "Checking your browser", True),
    ("Xác minh bảo mật", "Vui lòng xác nhận bạn không phải robot", True),
    ("Access Denied", "unusual traffic from your network", True),
    ("Áo thun nam trơn | Shopee Việt Nam", "Chi tiết sản phẩm. Giá 189.000₫", False),
    ("", "", False),
]
for title, body, expected in CAPTCHA_CASES:
    got = helper.looks_like_captcha(title, body)
    check(f"{(title or '(rong)')[:40]!r} -> {expected}", got == expected,
          "" if got == expected else f"-> {got}")

# =============================================================================
print("\n=== 3b. Nhan dien trang chan bot va tieu de trang chu ===")

# Ca hai nhom duoi day khoa lai BUG THAT phat hien khi chay thu link cua nguoi
# dung. Neu ai sua lai thanh so khop chuoi con, test se do ngay.

BOT_URL_CASES = [
    # Shopee KHONG tra 403 ma chuyen huong sang day. HTTP van la 200.
    ("https://shopee.vn/verify/traffic/error?home_url=x", True),
    ("https://shopee.vn/verify/captcha", True),
    ("https://example.com/cdn-cgi/challenge-platform/x", True),
    # Trang san pham that
    ("https://shopee.vn/product/1388112438/49358623905", False),
    ("https://shopee.vn/Ao-Thun-i.123.456", False),
    ("", False),
]
for url, expected in BOT_URL_CASES:
    got = helper.is_bot_check_url(url)
    check(f"is_bot_check_url({(url or '(rong)')[:46]}) -> {expected}", got == expected,
          "" if got == expected else f"-> {got}")

# Tieu de THAT lay tu hai link cua nguoi dung
REAL_TITLES = [
    "Áo Thun Len Dệt Kim Phối Cổ Tròn Cài 1 Cúc Tay Ngắn 𝐂𝐎𝐎𝐋𝐂𝐑𝐄𝐖 Phong Cách "
    "Cleanfit Hàn Quốc - ALH05 ATN103 | Shopee Việt Nam",
    "[BEST SELLER] Áo polo nam BASIC SYMBOL, POLO QUỐC DÂN vải cá sấu cotton "
    "interlock - POLOMANOR | Shopee Việt Nam",
]
for t in REAL_TITLES:
    got = helper.is_generic_title(t)
    check(f"tieu de SAN PHAM that KHONG bi coi la trang chu: {t[:40]}…",
          got is False,
          "" if got is False else "BI TU CHOI NHAM — moi san pham Shopee deu ket "
                                  "thuc bang '| Shopee Viet Nam'")

GENERIC_TITLES_TEST = [
    ("Shopee Việt Nam | Mua và Bán Trên Ứng Dụng Di Động Hoặc Website", True),
    ("Shopee Việt Nam | Mua Sắm Online", True),
    ("TikTok Shop", True),
    ("", True),
    ("Áo", True),          # qua ngan, khong the la ten san pham
    ("Áo thun nam", False),
]
for t, expected in GENERIC_TITLES_TEST:
    got = helper.is_generic_title(t)
    check(f"is_generic_title({(t or '(rong)')[:44]}) -> {expected}", got == expected,
          "" if got == expected else f"-> {got}")

# Cat hau to
SUFFIX_CASES = [
    ("Áo polo nam - POLOMANOR | Shopee Việt Nam", "Áo polo nam - POLOMANOR"),
    ("Quần jeans | TikTok Shop", "Quần jeans"),
    ("Áo khoác | Cửa hàng ABC", "Áo khoác | Cửa hàng ABC"),   # khong phai hau to san
    ("Áo thun", "Áo thun"),
]
for raw, expected in SUFFIX_CASES:
    got = helper.strip_marketplace_suffix(raw)
    check(f"strip_marketplace_suffix -> {expected[:40]}", got == expected,
          "" if got == expected else f"-> {got}")

check("strip_accents bo dau va doi d gach ngang",
      helper.strip_accents("Áo Thun Đẹp") == "ao thun dep",
      helper.strip_accents("Áo Thun Đẹp"))

# =============================================================================
print("\n=== 4. Khop ten mien theo ten mien goc ===")

ALLOWED_CASES = [
    # Hai link THAT cua nguoi dung — day la ly do phai doi sang khop ten mien goc
    ("vn.shp.ee", True, "link that cua nguoi dung"),
    ("shp.ee", True, "ten mien goc"),
    ("th.shp.ee", True, "bien the quoc gia khac"),
    ("shopee.vn", True, ""),
    ("s.shopee.vn", True, ""),
    ("affiliate.shopee.vn", True, ""),
    ("tiktok.com", True, ""),
    ("vt.tiktok.com", True, ""),
    ("shop.tiktok.com", True, ""),
    # PHAI bi tu choi
    ("evil-shp.ee", False, "thieu dau cham truoc shp.ee"),
    ("shp.ee.evil.com", False, "shp.ee o dau, khong phai cuoi"),
    ("shopee.vn.evil.com", False, "ten mien la gan them shopee.vn"),
    ("shopee.evil.com", False, "chuoi con 'shopee' nhung khong thuoc shopee.vn"),
    ("evil.com", False, ""),
    ("", False, ""),
]
for host, expected, note in ALLOWED_CASES:
    got = helper.is_allowed_host(host)
    label = f"{'NHAN' if expected else 'TU CHOI'} {host or '(rong)'}"
    check(label + (f" — {note}" if note else ""), got == expected,
          "" if got == expected else f"-> {got}")

SHORTENER_CASES = [
    ("vn.shp.ee", True),
    ("shp.ee", True),
    ("shope.ee", True),
    ("s.shopee.vn", True),
    ("vt.tiktok.com", True),
    ("shopee.vn", False),      # ten mien day du, khong phai rut gon
    ("tiktok.com", False),
    ("shop.tiktok.com", False),
]
for host, expected in SHORTENER_CASES:
    got = helper.is_shortener_host(host)
    check(f"{host} la link rut gon? {expected}", got == expected,
          "" if got == expected else f"-> {got}")

# platform_of phai dung is_under_domain, khong dung chuoi con
check("platform_of nhan dien vn.shp.ee la shopee",
      helper.platform_of("vn.shp.ee") == "shopee")
check("platform_of TU CHOI shopee.evil.com",
      helper.platform_of("shopee.evil.com") is None,
      str(helper.platform_of("shopee.evil.com")))

# =============================================================================
print("\n=== 4b. BON noi phai cung mot cau hinh ten mien ===")


def lists_from_sql() -> dict[str, set[str]]:
    sql = (ROOT / "supabase/migrations/0003_functions.sql").read_text(encoding="utf-8")

    def arr_after(fn_name: str, nth: int = 0) -> set[str]:
        start = sql.find(f"create or replace function {fn_name}")
        if start < 0:
            return set()
        body = sql[start:sql.find("$$;", start)]
        arrays = re.findall(r"array\[([^\]]*)\]", body)
        if len(arrays) <= nth:
            return set()
        return set(re.findall(r"'([a-z0-9.-]+)'", arrays[nth]))

    def exact_hosts() -> set[str]:
        start = sql.find("create or replace function is_shortener_host")
        body = sql[start:sql.find("$$;", start)]
        m = re.search(r"p_host in \(([^)]*)\)", body)
        return set(re.findall(r"'([a-z0-9.-]+)'", m.group(1))) if m else set()

    return {
        "allowed": arr_after("is_allowed_affiliate_host"),
        "shortener_roots": arr_after("is_shortener_host"),
        "shortener_exact": exact_hosts(),
    }


def lists_from_file(path: str, names: dict[str, str]) -> dict[str, set[str]]:
    txt = (ROOT / path).read_text(encoding="utf-8")
    out: dict[str, set[str]] = {}
    for key, const in names.items():
        m = re.search(rf"{const}[^=]*=\s*[\[{{](.*?)[\]}}]", txt, re.DOTALL)
        out[key] = set(re.findall(r"['\"]([a-z0-9.-]+)['\"]", m.group(1))) if m else set()
    return out


sources = {
    "Python": {
        "allowed": set(helper.ALLOWED_ROOT_DOMAINS),
        "shortener_roots": set(helper.SHORTENER_ROOT_DOMAINS),
        "shortener_exact": set(helper.SHORTENER_EXACT_HOSTS),
    },
    "SQL": lists_from_sql(),
    "TypeScript": lists_from_file("src/lib/affiliate.ts", {
        "allowed": "ALLOWED_ROOT_DOMAINS",
        "shortener_roots": "SHORTENER_ROOT_DOMAINS",
        "shortener_exact": "SHORTENER_EXACT_HOSTS",
    }),
    "EdgeFn": lists_from_file("supabase/functions/fetch-product/index.ts", {
        "allowed": "ALLOWED_ROOT_DOMAINS",
        "shortener_roots": "SHORTENER_ROOT_DOMAINS",
        "shortener_exact": "SHORTENER_EXACT_HOSTS",
    }),
}

for key, label in [
    ("allowed", "ALLOWED_ROOT_DOMAINS"),
    ("shortener_roots", "SHORTENER_ROOT_DOMAINS"),
    ("shortener_exact", "SHORTENER_EXACT_HOSTS"),
]:
    ref = sources["Python"][key]
    diffs = {
        name: sorted((src[key] - ref) | (ref - src[key]))
        for name, src in sources.items()
        if src[key] != ref
    }
    check(f"{label} giong nhau o Python / SQL / TypeScript / Edge Function",
          not diffs,
          f"{len(ref)} ten mien" if not diffs else f"lech: {diffs}")

check("moi ten mien goc rut gon deu nam trong danh sach cho phep",
      sources["Python"]["shortener_roots"] <= sources["Python"]["allowed"],
      str(sorted(sources["Python"]["shortener_roots"] - sources["Python"]["allowed"])) or "ok")

check("moi ten mien rut gon cu the deu duoc phep",
      all(helper.is_allowed_host(h) for h in helper.SHORTENER_EXACT_HOSTS),
      str([h for h in helper.SHORTENER_EXACT_HOSTS if not helper.is_allowed_host(h)]) or "ok")

check("moi ten mien goc deu suy ra duoc nen tang",
      all(helper.platform_of(d) is not None for d in helper.ALLOWED_ROOT_DOMAINS),
      str(sorted(d for d in helper.ALLOWED_ROOT_DOMAINS if helper.platform_of(d) is None)) or "ok")

# =============================================================================
print("\n=== 5. Hang so an toan ===")

check("khong tu chay theo lich: khong co lich trong ma nguon",
      "schedule" not in helper.__doc__.lower().replace("theo lich", ""),
      "chi chay khi co job do nguoi tao")
check("MAX_ATTEMPTS co gioi han", 1 <= helper.MAX_ATTEMPTS <= 3, f"= {helper.MAX_ATTEMPTS}")
check("CAPTCHA_WAIT_SEC du de nguoi that bam", helper.CAPTCHA_WAIT_SEC >= 30,
      f"= {helper.CAPTCHA_WAIT_SEC}s")
check("PAGE_TIMEOUT_MS hop ly", 10_000 <= helper.PAGE_TIMEOUT_MS <= 60_000,
      f"= {helper.PAGE_TIMEOUT_MS}ms")

print(f"\n>>> {passed} PASS, {failed} FAIL" + (" — CO LOI\n" if failed else " — TAT CA PASS\n"))
sys.exit(1 if failed else 0)
