#!/usr/bin/env python3
import base64
import json
import os
import re
import secrets
import threading
import time
import hashlib
import hmac
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse
import urllib.error
import urllib.request

BIND = os.environ.get("DASH_BIND", "127.0.0.1")
PORT = int(os.environ.get("DASH_PORT", "8788"))
DATA_DIR = os.environ.get("DASH_DATA_DIR", "/srv/www/kiss-this-dashboard/shared/data")
CONFIG_FILE = os.path.join(DATA_DIR, "dashboard-config.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
DEFAULT_CONFIG_PATH = os.environ.get(
    "DASH_DEFAULT_CONFIG",
    "/srv/www/kiss-this-dashboard/current/dashboard-default-config.json",
)
APP_ROOT = os.environ.get(
    "DASH_APP_ROOT",
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)
SESSION_TTL_SECONDS = int(os.environ.get("DASH_SESSION_TTL", "43200"))
SESSION_COOKIE_NAME = "dash_session"
ICON_INDEX_TTL_SECONDS = int(os.environ.get("DASH_ICON_INDEX_TTL", "21600"))
ICON_SEARCH_MAX_LIMIT = int(os.environ.get("DASH_ICON_SEARCH_MAX_LIMIT", "30"))
SELFHST_ICON_INDEX_URL = os.environ.get(
    "DASH_ICON_INDEX_URL",
    "https://raw.githubusercontent.com/selfhst/icons/main/index.json",
)
SELFHST_ICON_RAW_BASE = os.environ.get(
    "DASH_ICON_RAW_BASE",
    "https://raw.githubusercontent.com/selfhst/icons/main",
)
ICONIFY_API_BASE = os.environ.get(
    "DASH_ICONIFY_API_BASE",
    "https://api.iconify.design",
)
ICONIFY_SOURCE_PREFIXES = {
    "iconify-simple": "simple-icons",
    "iconify-logos": "logos",
}
ICONIFY_PREFIX_SOURCES = {value: key for key, value in ICONIFY_SOURCE_PREFIXES.items()}
BUTTON_COLOR_MODE_CYCLE_DEFAULT = "cycle-default"
BUTTON_COLOR_MODE_CYCLE_CUSTOM = "cycle-custom"
BUTTON_COLOR_MODE_SOLID_ALL = "solid-all"
BUTTON_COLOR_MODE_SOLID_PER_GROUP = "solid-per-group"
DEFAULT_BUTTON_CYCLE_HUE_STEP = 15
DEFAULT_BUTTON_CYCLE_SATURATION = 70
DEFAULT_BUTTON_CYCLE_LIGHTNESS = 74
DEFAULT_BUTTON_SOLID_COLOR = "#93c5fd"

sessions = {}
sessions_lock = threading.Lock()
file_lock = threading.Lock()
icon_index_lock = threading.Lock()
icon_index_cache = {
    "fetched_at": 0,
    "items": [],
}


# -------------------- Shared Helpers --------------------
def now_ts():
    return int(time.time())


def json_load(path, default):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def json_write_atomic(path, payload):
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
    os.replace(tmp_path, path)


def http_get(url, timeout=15):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "kiss-this-dashboard/1.1 (+selfhst-icons)",
            "Accept": "application/json, image/svg+xml, image/png;q=0.9, */*;q=0.8",
        },
    )
    return urllib.request.urlopen(request, timeout=timeout)


def normalize_bool_flag(value):
    return str(value or "").strip().lower() in {"y", "yes", "true", "1"}


def normalize_selfhst_icon_entry(row):
    if not isinstance(row, dict):
        return None

    reference = str(row.get("Reference") or "").strip()
    if not reference:
        return None

    name = str(row.get("Name") or reference).strip() or reference
    category = str(row.get("Category") or "").strip()
    tags = str(row.get("Tags") or "").strip()

    return {
        "name": name,
        "reference": reference,
        "category": category,
        "tags": tags,
        "hasSvg": normalize_bool_flag(row.get("SVG")),
        "hasPng": normalize_bool_flag(row.get("PNG")),
        "hasWebp": normalize_bool_flag(row.get("WebP")),
        "hasLight": normalize_bool_flag(row.get("Light")),
        "hasDark": normalize_bool_flag(row.get("Dark")),
    }


def get_selfhst_icon_index():
    now = now_ts()

    with icon_index_lock:
        cached_items = icon_index_cache.get("items") or []
        fetched_at = int(icon_index_cache.get("fetched_at") or 0)
        if cached_items and now - fetched_at < ICON_INDEX_TTL_SECONDS:
            return cached_items

    with http_get(SELFHST_ICON_INDEX_URL, timeout=20) as response:
        parsed = json.loads(response.read().decode("utf-8"))

    if not isinstance(parsed, list):
        raise ValueError("Unexpected icon index format.")

    items = []
    for row in parsed:
        normalized = normalize_selfhst_icon_entry(row)
        if normalized:
            items.append(normalized)

    with icon_index_lock:
        icon_index_cache["items"] = items
        icon_index_cache["fetched_at"] = now

    return items


def search_selfhst_icons(query, limit):
    normalized_query = str(query or "").strip().lower()
    tokens = [token for token in re.split(r"\s+", normalized_query) if token]

    items = get_selfhst_icon_index()
    results = []

    for item in items:
        name = item["name"].lower()
        reference = item["reference"].lower()
        category = item["category"].lower()
        tags = item["tags"].lower()
        haystack = f"{name} {reference} {category} {tags}"

        if normalized_query:
            if normalized_query not in haystack:
                continue

            score = 0
            if reference == normalized_query:
                score += 1200
            elif reference.startswith(normalized_query):
                score += 900

            if name == normalized_query:
                score += 1000
            elif name.startswith(normalized_query):
                score += 800

            if normalized_query in name:
                score += 500
            if normalized_query in reference:
                score += 450
            if normalized_query in tags:
                score += 220
            if normalized_query in category:
                score += 120

            for token in tokens:
                if token in name:
                    score += 80
                if token in reference:
                    score += 70
                if token in tags:
                    score += 35
        else:
            score = 0

        preview_ext = "svg" if item["hasSvg"] else ("png" if item["hasPng"] else "")
        preview_url = (
            f"{SELFHST_ICON_RAW_BASE}/{preview_ext}/{quote(item['reference'], safe='-._~')}.{preview_ext}"
            if preview_ext
            else ""
        )

        results.append(
            {
                "score": score,
                "name": item["name"],
                "reference": item["reference"],
                "category": item["category"],
                "tags": item["tags"],
                "hasSvg": item["hasSvg"],
                "hasPng": item["hasPng"],
                "hasWebp": item["hasWebp"],
                "hasLight": item["hasLight"],
                "hasDark": item["hasDark"],
                "previewUrl": preview_url,
            }
        )

    results.sort(
        key=lambda item: (
            -int(item.get("score", 0)),
            item.get("name", "").lower(),
            item.get("reference", "").lower(),
        )
    )
    return results[:limit]


def find_selfhst_icon(reference):
    wanted = str(reference or "").strip().lower()
    if not wanted:
        return None

    for item in get_selfhst_icon_index():
        if item["reference"].lower() == wanted:
            return item
    return None


def fetch_selfhst_icon_data(reference, prefer_format="svg"):
    item = find_selfhst_icon(reference)
    if not item:
        raise KeyError("Icon not found.")

    ordered_formats = []
    preferred = "png" if str(prefer_format).lower() == "png" else "svg"
    if preferred == "svg":
        if item["hasSvg"]:
            ordered_formats.append("svg")
        if item["hasPng"]:
            ordered_formats.append("png")
    else:
        if item["hasPng"]:
            ordered_formats.append("png")
        if item["hasSvg"]:
            ordered_formats.append("svg")

    if not ordered_formats:
        raise ValueError("Selected icon does not have a supported format.")

    last_error = None

    for ext in ordered_formats:
        url = f"{SELFHST_ICON_RAW_BASE}/{ext}/{quote(item['reference'], safe='-._~')}.{ext}"
        try:
            with http_get(url, timeout=20) as response:
                raw = response.read()
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code == 404:
                continue
            raise
        except Exception as error:  # noqa: BLE001
            last_error = error
            continue

        if not raw:
            continue

        if not content_type:
            content_type = "image/svg+xml" if ext == "svg" else "image/png"

        encoded = base64.b64encode(raw).decode("ascii")
        return {
            "name": item["name"],
            "reference": item["reference"],
            "icon": f"{item['reference']}.{ext}",
            "iconData": f"data:{content_type};base64,{encoded}",
            "format": ext,
            "contentType": content_type,
        }

    if last_error:
        raise RuntimeError(f"Failed to fetch icon from source: {last_error}")
    raise RuntimeError("Failed to fetch icon from source.")


def search_iconify_icons(query, limit, icon_prefix, source_id, category_label):
    normalized_query = str(query or "").strip()
    if len(normalized_query) < 2:
        return []

    search_url = (
        f"{ICONIFY_API_BASE}/search"
        f"?query={quote(normalized_query, safe='')}"
        f"&limit={int(limit)}"
        f"&prefixes={quote(icon_prefix, safe='-._~')}"
    )

    with http_get(search_url, timeout=20) as response:
        parsed = json.loads(response.read().decode("utf-8"))

    icon_names = parsed.get("icons") if isinstance(parsed, dict) else []
    if not isinstance(icon_names, list):
        return []

    results = []
    for icon_name in icon_names:
        if not isinstance(icon_name, str) or ":" not in icon_name:
            continue

        prefix, name = icon_name.split(":", 1)
        if prefix != icon_prefix or not name:
            continue

        label = name.replace("-", " ").strip() or name
        preview_url = f"{ICONIFY_API_BASE}/{quote(prefix, safe='-._~')}/{quote(name, safe='-._~')}.svg"
        results.append(
            {
                "name": label.title(),
                "reference": icon_name,
                "category": category_label,
                "tags": "",
                "previewUrl": preview_url,
                "source": source_id,
            }
        )

    return results[:limit]


def search_iconify_simple_icons(query, limit):
    return search_iconify_icons(query, limit, "simple-icons", "iconify-simple", "Simple Icons")


def search_iconify_logos_icons(query, limit):
    return search_iconify_icons(query, limit, "logos", "iconify-logos", "Logos")


def normalize_iconify_name(icon_name, source_hint=""):
    value = str(icon_name or "").strip().lower()
    value = re.sub(r"\s+", "", value)
    value = re.sub(r":+", ":", value)

    hint = str(source_hint or "").strip().lower()
    if ":" not in value and hint in ICONIFY_SOURCE_PREFIXES:
        value = f"{ICONIFY_SOURCE_PREFIXES[hint]}:{value}"

    if not re.fullmatch(r"[a-z0-9-]+:[a-z0-9][a-z0-9._-]*", value):
        raise ValueError("Invalid icon name.")

    prefix, name = value.split(":", 1)
    if prefix not in ICONIFY_PREFIX_SOURCES:
        raise ValueError("Unsupported Iconify icon set.")
    return value, prefix, name


def fetch_iconify_icon_data(icon_name, prefer_format="svg", source_hint=""):
    value, prefix, name = normalize_iconify_name(icon_name, source_hint=source_hint)

    fmt = "png" if str(prefer_format).lower() == "png" else "svg"
    url = f"{ICONIFY_API_BASE}/{quote(prefix, safe='-._~')}/{quote(name, safe='-._~')}.{fmt}"

    try:
        with http_get(url, timeout=20) as response:
            raw = response.read()
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
    except urllib.error.HTTPError:
        if fmt == "png":
            url = f"{ICONIFY_API_BASE}/{quote(prefix, safe='-._~')}/{quote(name, safe='-._~')}.svg"
            with http_get(url, timeout=20) as response:
                raw = response.read()
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            fmt = "svg"
        else:
            raise

    if not raw:
        raise RuntimeError("Icon source returned empty data.")

    if not content_type:
        content_type = "image/svg+xml" if fmt == "svg" else "image/png"

    encoded = base64.b64encode(raw).decode("ascii")
    label = name.replace("-", " ").strip() or name
    return {
        "name": label.title(),
        "reference": value,
        "source": ICONIFY_PREFIX_SOURCES.get(prefix, "iconify-simple"),
        "icon": f"{name}.{fmt}",
        "iconData": f"data:{content_type};base64,{encoded}",
        "format": fmt,
        "contentType": content_type,
    }


def fetch_iconify_simple_icon_data(icon_name, prefer_format="svg"):
    imported = fetch_iconify_icon_data(icon_name, prefer_format=prefer_format, source_hint="iconify-simple")
    if imported.get("source") != "iconify-simple":
        raise ValueError("Only simple-icons icons are supported for this source.")
    return imported


def parse_cookies(raw_cookie_header):
    cookies = {}
    if not raw_cookie_header:
        return cookies

    for part in raw_cookie_header.split(";"):
        if "=" not in part:
            continue
        key, value = part.strip().split("=", 1)
        cookies[key] = value
    return cookies


def hash_password(password, salt_hex, iterations):
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return digest.hex()


def build_password_record(password):
    salt = secrets.token_hex(16)
    iterations = 210_000
    return {
        "salt": salt,
        "iterations": iterations,
        "hash": hash_password(password, salt, iterations),
    }


def verify_password(password, record):
    try:
        calculated = hash_password(
            password,
            record["salt"],
            int(record.get("iterations", 210_000)),
        )
        return hmac.compare_digest(calculated, record["hash"])
    except Exception:
        return False


def user_requires_password_change(users_payload, username):
    if not isinstance(users_payload, dict):
        return False
    users = users_payload.get("users")
    if not isinstance(users, dict):
        return False
    record = users.get(str(username or ""))
    if not isinstance(record, dict):
        return False
    return bool(record.get("mustChangePassword", False))


def is_password_change_required(username):
    return user_requires_password_change(get_users_payload(), username)


def clear_password_change_required(users_payload, username):
    if not isinstance(users_payload, dict):
        return False
    users = users_payload.get("users")
    if not isinstance(users, dict):
        return False
    record = users.get(str(username or ""))
    if not isinstance(record, dict):
        return False
    if not record.get("mustChangePassword"):
        return False
    record["mustChangePassword"] = False
    users[str(username or "")] = record
    users_payload["users"] = users
    return True


def has_any_users(users_payload=None):
    payload = users_payload if isinstance(users_payload, dict) else get_users_payload()
    users = payload.get("users")
    if not isinstance(users, dict):
        return False
    return any(isinstance(key, str) and key.strip() for key in users.keys())


def make_safe_tab_id(raw_value):
    source = str(raw_value or "dashboard").strip().lower()
    safe = []
    previous_dash = False
    for char in source:
        if char.isalnum():
            safe.append(char)
            previous_dash = False
        elif not previous_dash:
            safe.append("-")
            previous_dash = True
    safe_value = "".join(safe).strip("-")[:32]
    return safe_value or "tab"


def make_unique_tab_id(base_id, used_ids):
    if base_id not in used_ids:
        used_ids.add(base_id)
        return base_id

    counter = 2
    candidate = f"{base_id}-{counter}"
    while candidate in used_ids:
        counter += 1
        candidate = f"{base_id}-{counter}"

    used_ids.add(candidate)
    return candidate


def normalize_title(value):
    title = str(value or "").strip()
    return title or "KISS this dashboard"


def normalize_hex_color(value):
    text = str(value or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", text):
        return text.lower()
    return ""


def clamp_int(value, minimum, maximum, fallback):
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(maximum, numeric))


def normalize_button_color_mode(value):
    mode = str(value or "").strip().lower()
    if mode == BUTTON_COLOR_MODE_CYCLE_DEFAULT:
        return BUTTON_COLOR_MODE_CYCLE_CUSTOM
    if mode in {
        BUTTON_COLOR_MODE_CYCLE_CUSTOM,
        BUTTON_COLOR_MODE_SOLID_ALL,
        BUTTON_COLOR_MODE_SOLID_PER_GROUP,
    }:
        return mode
    return BUTTON_COLOR_MODE_CYCLE_CUSTOM


def normalize_legacy_tabs(input_tabs):
    source_tabs = input_tabs if isinstance(input_tabs, list) else []
    used_ids = set()
    tabs = []

    for tab in source_tabs:
        if not isinstance(tab, dict):
            continue
        label = str(tab.get("label") or tab.get("id") or "").strip()
        if not label:
            continue
        requested_id = make_safe_tab_id(tab.get("id") or tab.get("label") or "tab")
        tab_id = make_unique_tab_id(requested_id, used_ids)
        tabs.append({"id": tab_id, "label": label})

    if not any(tab["id"] == "external" for tab in tabs):
        tabs.insert(0, {"id": "external", "label": "External"})

    if not any(tab["id"] == "internal" for tab in tabs):
        tabs.append({"id": "internal", "label": "Internal"})

    return tabs


def detect_type_from_text(text):
    source = str(text or "").lower()
    if not source:
        return ""

    if any(token in source for token in ["extern", "public", "internet", "wan"]):
        return "external"

    if any(token in source for token in ["intern", "local", "lan", "private"]):
        return "internal"

    return ""


def looks_like_private_host(hostname):
    host = str(hostname or "").strip().lower()
    if not host:
        return False

    if host == "localhost" or host.endswith(".local"):
        return True

    if host.startswith("10.") or host.startswith("192.168."):
        return True

    if host.startswith("172."):
        parts = host.split(".")
        if len(parts) >= 2:
            try:
                second_octet = int(parts[1])
                return 16 <= second_octet <= 31
            except ValueError:
                return False

    return False


def detect_type_from_url(raw_url):
    value = str(raw_url or "").strip()
    if not value:
        return ""

    try:
        parsed = urlparse(value if "://" in value else f"http://{value}")
        host = parsed.hostname or ""
    except Exception:
        return ""

    return "internal" if looks_like_private_host(host) else "external"


def normalize_entry_links(entry, legacy_tabs):
    links = {}
    entry_links = entry.get("links") if isinstance(entry.get("links"), dict) else {}

    for key, value in entry_links.items():
        links[str(key)] = str(value).strip() if isinstance(value, str) else ""

    if isinstance(entry.get("external"), str) and not links.get("external"):
        links["external"] = entry["external"].strip()

    if isinstance(entry.get("internal"), str) and not links.get("internal"):
        links["internal"] = entry["internal"].strip()

    tab_type_by_id = {}
    for tab in legacy_tabs:
        tab_id = str(tab.get("id", ""))
        explicit = tab_id if tab_id in ["external", "internal"] else ""
        tab_type_by_id[tab_id] = explicit or detect_type_from_text(f"{tab_id} {tab.get('label', '')}")

    for key, value in list(links.items()):
        if not value:
            continue
        detected = key if key in ["external", "internal"] else tab_type_by_id.get(key) or detect_type_from_text(key)
        if detected and not links.get(detected):
            links[detected] = value

    unresolved_values = [
        value
        for key, value in links.items()
        if key not in ["external", "internal"] and value
    ]

    for value in unresolved_values:
        detected = detect_type_from_url(value)
        if detected and not links.get(detected):
            links[detected] = value
            continue

        if not links.get("external"):
            links["external"] = value
            continue

        if not links.get("internal"):
            links["internal"] = value

    if not links.get("external"):
        links["external"] = ""

    if not links.get("internal"):
        links["internal"] = ""

    return {
        "external": links["external"],
        "internal": links["internal"],
    }


def normalize_entry(entry, legacy_tabs):
    if not isinstance(entry, dict):
        entry = {}

    return {
        "id": str(entry.get("id") or f"button-{secrets.token_hex(4)}"),
        "name": str(entry.get("name") or "New Button"),
        "icon": str(entry.get("icon") or ""),
        "iconData": str(entry.get("iconData") or ""),
        "links": normalize_entry_links(entry, legacy_tabs),
    }


def normalize_group(group, legacy_tabs):
    if not isinstance(group, dict):
        group = {}

    source_entries = group.get("entries") if isinstance(group.get("entries"), list) else []
    entries = [normalize_entry(entry, legacy_tabs) for entry in source_entries]

    return {
        "id": str(group.get("id") or f"group-{secrets.token_hex(4)}"),
        "title": str(group.get("title") or "New Group"),
        "groupEnd": bool(group.get("groupEnd", False)),
        "buttonSolidColor": normalize_hex_color(group.get("buttonSolidColor")),
        "entries": entries,
    }


def normalize_theme_preset_theme(theme):
    if not isinstance(theme, dict):
        theme = {}

    return {
        "backgroundColor": normalize_hex_color(theme.get("backgroundColor")),
        "groupBackgroundColor": normalize_hex_color(theme.get("groupBackgroundColor")),
        "textColor": normalize_hex_color(theme.get("textColor")),
        "buttonTextColor": normalize_hex_color(theme.get("buttonTextColor")),
        "tabColor": normalize_hex_color(theme.get("tabColor")),
        "activeTabColor": normalize_hex_color(theme.get("activeTabColor")),
        "tabTextColor": normalize_hex_color(theme.get("tabTextColor")),
        "activeTabTextColor": normalize_hex_color(theme.get("activeTabTextColor")),
        "buttonColorMode": normalize_button_color_mode(theme.get("buttonColorMode")),
        "buttonCycleHueStep": clamp_int(
            theme.get("buttonCycleHueStep"), 1, 180, DEFAULT_BUTTON_CYCLE_HUE_STEP
        ),
        "buttonCycleSaturation": clamp_int(
            theme.get("buttonCycleSaturation"), 0, 100, DEFAULT_BUTTON_CYCLE_SATURATION
        ),
        "buttonCycleLightness": clamp_int(
            theme.get("buttonCycleLightness"), 0, 100, DEFAULT_BUTTON_CYCLE_LIGHTNESS
        ),
        "buttonSolidColor": normalize_hex_color(theme.get("buttonSolidColor")) or DEFAULT_BUTTON_SOLID_COLOR,
    }


def normalize_theme_preset(preset, fallback_index):
    if not isinstance(preset, dict):
        preset = {}

    name = str(preset.get("name") or "").strip() or f"Theme {fallback_index}"
    return {
        "id": str(preset.get("id") or f"theme-{secrets.token_hex(4)}"),
        "name": name,
        "theme": normalize_theme_preset_theme(preset.get("theme")),
    }


def normalize_dashboard(dashboard, legacy_tabs, fallback_label):
    if not isinstance(dashboard, dict):
        dashboard = {}

    source_groups = dashboard.get("groups") if isinstance(dashboard.get("groups"), list) else []
    groups = [normalize_group(group, legacy_tabs) for group in source_groups]
    source_theme_presets = (
        dashboard.get("themePresets") if isinstance(dashboard.get("themePresets"), list) else []
    )
    theme_presets = [
        normalize_theme_preset(preset, index + 1) for index, preset in enumerate(source_theme_presets)
    ]

    dashboard_id = make_safe_tab_id(dashboard.get("id") or fallback_label or "dashboard")
    if dashboard_id == "dashboard":
        dashboard_id = f"dashboard-{secrets.token_hex(3)}"

    label = str(dashboard.get("label") or "").strip() or fallback_label or "Dashboard"

    return {
        "id": dashboard_id,
        "label": label,
        "showLinkModeToggle": bool(dashboard.get("showLinkModeToggle", True)),
        "enableInternalLinks": bool(dashboard.get("enableInternalLinks", False)),
        "textColor": normalize_hex_color(dashboard.get("textColor")),
        "buttonTextColor": normalize_hex_color(dashboard.get("buttonTextColor")),
        "tabColor": normalize_hex_color(dashboard.get("tabColor")),
        "activeTabColor": normalize_hex_color(dashboard.get("activeTabColor")),
        "tabTextColor": normalize_hex_color(dashboard.get("tabTextColor")),
        "activeTabTextColor": normalize_hex_color(dashboard.get("activeTabTextColor")),
        "backgroundColor": normalize_hex_color(dashboard.get("backgroundColor")),
        "groupBackgroundColor": normalize_hex_color(dashboard.get("groupBackgroundColor")),
        "buttonColorMode": normalize_button_color_mode(dashboard.get("buttonColorMode")),
        "buttonCycleHueStep": clamp_int(
            dashboard.get("buttonCycleHueStep"), 1, 180, DEFAULT_BUTTON_CYCLE_HUE_STEP
        ),
        "buttonCycleSaturation": clamp_int(
            dashboard.get("buttonCycleSaturation"), 0, 100, DEFAULT_BUTTON_CYCLE_SATURATION
        ),
        "buttonCycleLightness": clamp_int(
            dashboard.get("buttonCycleLightness"), 0, 100, DEFAULT_BUTTON_CYCLE_LIGHTNESS
        ),
        "buttonSolidColor": normalize_hex_color(dashboard.get("buttonSolidColor"))
        or DEFAULT_BUTTON_SOLID_COLOR,
        "themePresets": theme_presets,
        "groups": groups,
    }


def normalize_dashboards(config, legacy_tabs):
    source_dashboards = config.get("dashboards") if isinstance(config.get("dashboards"), list) else []
    if source_dashboards:
        used_ids = set()
        dashboards = []
        for index, dashboard in enumerate(source_dashboards):
            normalized = normalize_dashboard(dashboard, legacy_tabs, f"Dashboard {index + 1}")
            normalized["id"] = make_unique_tab_id(normalized["id"], used_ids)
            dashboards.append(normalized)
        return dashboards

    legacy_groups = config.get("groups") if isinstance(config.get("groups"), list) else []
    fallback_dashboard = normalize_dashboard(
        {
            "id": "dashboard-1",
            "label": "Dashboard 1",
            "groups": legacy_groups,
        },
        legacy_tabs,
        "Dashboard 1",
    )
    return [fallback_dashboard]


def normalize_config(config):
    if not isinstance(config, dict):
        config = {}

    legacy_tabs = normalize_legacy_tabs(config.get("tabs"))
    dashboards = normalize_dashboards(config, legacy_tabs)

    return {
        "title": normalize_title(config.get("title")),
        "dashboards": dashboards,
    }


def ensure_files_ready():
    os.makedirs(DATA_DIR, exist_ok=True)

    with file_lock:
        if not os.path.exists(CONFIG_FILE):
            default_config = json_load(DEFAULT_CONFIG_PATH, None)
            if default_config is None:
                default_config = {
                    "title": "KISS this dashboard",
                    "dashboards": [
                        {
                            "id": "dashboard-1",
                            "label": "Dashboard 1",
                            "groups": [],
                        }
                    ],
                }
            json_write_atomic(CONFIG_FILE, normalize_config(default_config))

        if not os.path.exists(USERS_FILE):
            users_payload = {
                "users": {}
            }
            json_write_atomic(USERS_FILE, users_payload)


def get_users_payload():
    with file_lock:
        payload = json_load(USERS_FILE, {"users": {}})

    if not isinstance(payload, dict):
        return {"users": {}}

    users = payload.get("users")
    if not isinstance(users, dict):
        payload["users"] = {}

    return payload


def save_users_payload(payload):
    with file_lock:
        json_write_atomic(USERS_FILE, payload)


def get_config_payload():
    with file_lock:
        config = json_load(CONFIG_FILE, {"title": "KISS this dashboard", "dashboards": []})
    return normalize_config(config)


def save_config_payload(config):
    normalized = normalize_config(config)
    with file_lock:
        json_write_atomic(CONFIG_FILE, normalized)
    return normalized


def prune_sessions():
    now = now_ts()
    expired_tokens = []
    for token, info in sessions.items():
        if info.get("expires", 0) <= now:
            expired_tokens.append(token)

    for token in expired_tokens:
        sessions.pop(token, None)


def create_session(username):
    token = secrets.token_urlsafe(32)
    with sessions_lock:
        prune_sessions()
        sessions[token] = {
            "username": username,
            "expires": now_ts() + SESSION_TTL_SECONDS,
        }
    return token


def resolve_session_username(raw_cookie_header):
    cookies = parse_cookies(raw_cookie_header)
    token = cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None

    with sessions_lock:
        prune_sessions()
        info = sessions.get(token)
        if not info:
            return None

        info["expires"] = now_ts() + SESSION_TTL_SECONDS
        return info.get("username")


def remove_session(raw_cookie_header):
    cookies = parse_cookies(raw_cookie_header)
    token = cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return

    with sessions_lock:
        sessions.pop(token, None)


def valid_username(username):
    return bool(re.fullmatch(r"[A-Za-z0-9._-]{3,40}", str(username or "")))


def update_session_username(raw_cookie_header, old_username, new_username):
    cookies = parse_cookies(raw_cookie_header)
    token = cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return

    with sessions_lock:
        prune_sessions()
        info = sessions.get(token)
        if not info:
            return
        if info.get("username") != old_username:
            return
        info["username"] = new_username


# -------------------- HTTP Handler --------------------
class DashboardAPIHandler(BaseHTTPRequestHandler):
    server_version = "DashboardAPI/1.0"

    def _send_json(self, status_code, payload, extra_headers=None):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")

        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)

        self.end_headers()
        self.wfile.write(raw)

    def _send_bytes(self, status_code, raw, content_type, extra_headers=None):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None

        if length <= 0:
            return {}

        body = self.rfile.read(length)
        try:
            return json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    def _path(self):
        return urlparse(self.path).path

    def _require_auth(self, require_password_change_completed=False):
        username = resolve_session_username(self.headers.get("Cookie"))
        if not username:
            self._send_json(401, {"message": "Authentication required."})
            return None
        if require_password_change_completed and is_password_change_required(username):
            self._send_json(
                403,
                {"message": "First-time setup required: change the account password before editing the dashboard."},
            )
            return None
        return username

    def _serve_static(self, request_path):
        raw_path = str(request_path or "/")
        path = raw_path.split("?", 1)[0].split("#", 1)[0]
        if not path or path == "/":
            relative = "index.html"
        else:
            relative = path.lstrip("/")
            if path.endswith("/"):
                relative = f"{relative.rstrip('/')}/index.html"

        relative = os.path.normpath(relative).replace("\\", "/").lstrip("/")
        if not relative or relative in {".", "/"}:
            relative = "index.html"

        if (
            relative.startswith("backend/")
            or relative.startswith("ops/")
            or relative.startswith(".")
            or "/." in relative
            or relative == ".."
            or relative.startswith("../")
        ):
            return False

        allowed_exts = {
            ".html",
            ".js",
            ".json",
            ".css",
            ".svg",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".ico",
            ".txt",
        }
        _, ext = os.path.splitext(relative.lower())
        if ext not in allowed_exts:
            return False

        app_root = os.path.abspath(APP_ROOT)
        file_path = os.path.abspath(os.path.join(app_root, relative))
        if not (file_path == app_root or file_path.startswith(app_root + os.sep)):
            return False
        if not os.path.isfile(file_path):
            return False

        try:
            with open(file_path, "rb") as handle:
                raw = handle.read()
        except OSError:
            self._send_json(500, {"message": "Failed to read static file."})
            return True

        content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        if file_path.endswith(".js"):
            content_type = "application/javascript; charset=utf-8"
        elif file_path.endswith(".html"):
            content_type = "text/html; charset=utf-8"
        elif file_path.endswith(".json"):
            content_type = "application/json; charset=utf-8"
        elif file_path.endswith(".css"):
            content_type = "text/css; charset=utf-8"
        elif content_type.startswith("text/"):
            content_type = f"{content_type}; charset=utf-8"

        self._send_bytes(200, raw, content_type)
        return True

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)

        if path == "/health":
            self._send_json(200, {"ok": True})
            return

        if path == "/api/config":
            config = get_config_payload()
            self._send_json(200, {"config": config})
            return

        if path == "/api/auth/status":
            username = resolve_session_username(self.headers.get("Cookie"))
            if username:
                self._send_json(
                    200,
                    {
                        "authenticated": True,
                        "username": username,
                        "mustChangePassword": is_password_change_required(username),
                    },
                )
            else:
                self._send_json(200, {"authenticated": False, "setupRequired": not has_any_users()})
            return

        if path == "/api/icons/search":
            username = self._require_auth(require_password_change_completed=True)
            if not username:
                return

            search_query = str((query.get("q") or [""])[0]).strip()
            source = str((query.get("source") or ["selfhst"])[0]).strip().lower() or "selfhst"
            try:
                limit = int((query.get("limit") or ["20"])[0])
            except (TypeError, ValueError):
                limit = 20

            limit = max(1, min(limit, ICON_SEARCH_MAX_LIMIT))

            if len(search_query) < 2:
                self._send_json(200, {"items": [], "query": search_query, "message": "Enter at least 2 characters."})
                return

            try:
                if source == "iconify-simple":
                    items = search_iconify_simple_icons(search_query, limit)
                elif source == "iconify-logos":
                    items = search_iconify_logos_icons(search_query, limit)
                else:
                    source = "selfhst"
                    items = search_selfhst_icons(search_query, limit)
            except Exception as error:  # noqa: BLE001
                self._send_json(502, {"message": f"Icon search source unavailable: {error}"})
                return

            self._send_json(
                200,
                {
                    "query": search_query,
                    "items": items,
                    "source": source,
                },
            )
            return

        if self._serve_static(path):
            return

        self._send_json(404, {"message": "Not found."})

    def do_POST(self):
        path = self._path()
        payload = self._read_json_body()

        if payload is None:
            self._send_json(400, {"message": "Invalid JSON body."})
            return

        if path == "/api/auth/bootstrap":
            if has_any_users():
                self._send_json(409, {"message": "An admin account is already configured.", "setupRequired": False})
                return

            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))

            if not valid_username(username):
                self._send_json(
                    400,
                    {"message": "Username must be 3-40 chars and use only letters, numbers, dot, dash or underscore."},
                )
                return

            if len(password) < 4:
                self._send_json(400, {"message": "Password must be at least 4 characters."})
                return

            users_payload = get_users_payload()
            users = users_payload.get("users", {})
            if not isinstance(users, dict):
                users = {}

            if users:
                self._send_json(409, {"message": "An admin account is already configured.", "setupRequired": False})
                return

            users[username] = build_password_record(password)
            users_payload["users"] = users
            save_users_payload(users_payload)

            token = create_session(username)
            self._send_json(
                200,
                {"ok": True, "username": username, "mustChangePassword": False, "setupRequired": False},
                {
                    "Set-Cookie": (
                        f"{SESSION_COOKIE_NAME}={token}; "
                        f"Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL_SECONDS}"
                    )
                },
            )
            return

        if path == "/api/login":
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))

            if not username or not password:
                self._send_json(400, {"message": "Username and password are required."})
                return

            users_payload = get_users_payload()
            if not has_any_users(users_payload):
                self._send_json(
                    409,
                    {
                        "message": "No admin account configured yet. Complete first-time setup.",
                        "setupRequired": True,
                    },
                )
                return

            users = users_payload.get("users", {})
            record = users.get(username)
            if not record or not verify_password(password, record):
                self._send_json(401, {"message": "Invalid username or password."})
                return

            token = create_session(username)
            self._send_json(
                200,
                {
                    "ok": True,
                    "username": username,
                    "mustChangePassword": user_requires_password_change(users_payload, username),
                },
                {
                    "Set-Cookie": (
                        f"{SESSION_COOKIE_NAME}={token}; "
                        f"Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL_SECONDS}"
                    )
                },
            )
            return

        if path == "/api/logout":
            remove_session(self.headers.get("Cookie"))
            self._send_json(
                200,
                {"ok": True},
                {
                    "Set-Cookie": (
                        f"{SESSION_COOKIE_NAME}=deleted; "
                        "Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
                    )
                },
            )
            return

        if path == "/api/config":
            username = self._require_auth(require_password_change_completed=True)
            if not username:
                return

            if "config" not in payload:
                self._send_json(400, {"message": "Missing config payload."})
                return

            saved_config = save_config_payload(payload.get("config"))
            self._send_json(200, {"ok": True, "savedBy": username, "config": saved_config})
            return

        if path == "/api/auth/change-username":
            username = self._require_auth()
            if not username:
                return

            current_password = str(payload.get("currentPassword", ""))
            new_username = str(payload.get("newUsername", "")).strip()

            if not valid_username(new_username):
                self._send_json(
                    400,
                    {"message": "Username must be 3-40 chars and use only letters, numbers, dot, dash or underscore."},
                )
                return

            users_payload = get_users_payload()
            users = users_payload.get("users", {})
            record = users.get(username)
            if not record or not verify_password(current_password, record):
                self._send_json(401, {"message": "Current password is incorrect."})
                return

            if new_username != username and new_username in users:
                self._send_json(409, {"message": "Username already exists."})
                return

            if new_username != username:
                users[new_username] = users.pop(username)
                users_payload["users"] = users
                save_users_payload(users_payload)
                update_session_username(self.headers.get("Cookie"), username, new_username)

            self._send_json(200, {"ok": True, "username": new_username})
            return

        if path == "/api/auth/change-password":
            username = self._require_auth()
            if not username:
                return

            current_password = str(payload.get("currentPassword", ""))
            new_password = str(payload.get("newPassword", ""))

            if len(new_password) < 4:
                self._send_json(400, {"message": "New password must be at least 4 characters."})
                return

            users_payload = get_users_payload()
            users = users_payload.get("users", {})
            record = users.get(username)
            if not record or not verify_password(current_password, record):
                self._send_json(401, {"message": "Current password is incorrect."})
                return

            users[username] = build_password_record(new_password)
            users_payload["users"] = users
            clear_password_change_required(users_payload, username)
            save_users_payload(users_payload)
            self._send_json(200, {"ok": True, "mustChangePassword": False})
            return

        if path == "/api/icons/import-selfhst":
            username = self._require_auth(require_password_change_completed=True)
            if not username:
                return

            reference = str(payload.get("reference", "")).strip()
            prefer_format = str(payload.get("format", "svg")).strip().lower()
            if prefer_format not in {"svg", "png"}:
                prefer_format = "svg"

            if (
                not reference
                or len(reference) > 180
                or reference.startswith("/")
                or "\\" in reference
                or ".." in reference
                or not re.fullmatch(r"[A-Za-z0-9._/-]+", reference)
            ):
                self._send_json(400, {"message": "Invalid icon reference."})
                return

            try:
                imported = fetch_selfhst_icon_data(reference, prefer_format=prefer_format)
            except KeyError:
                self._send_json(404, {"message": "Icon not found."})
                return
            except ValueError as error:
                self._send_json(400, {"message": str(error)})
                return
            except urllib.error.HTTPError as error:
                self._send_json(502, {"message": f"Icon source error ({error.code})."})
                return
            except Exception as error:  # noqa: BLE001
                self._send_json(502, {"message": f"Failed to import icon: {error}"})
                return

            self._send_json(
                200,
                {
                    "ok": True,
                    "source": "selfhst",
                    **imported,
                },
            )
            return

        if path == "/api/icons/import-iconify":
            username = self._require_auth(require_password_change_completed=True)
            if not username:
                return

            icon_name = str(payload.get("name", "")).strip()
            source_hint = str(payload.get("source", "")).strip().lower()
            prefer_format = str(payload.get("format", "svg")).strip().lower()
            if prefer_format not in {"svg", "png"}:
                prefer_format = "svg"

            try:
                imported = fetch_iconify_icon_data(icon_name, prefer_format=prefer_format, source_hint=source_hint)
            except ValueError as error:
                self._send_json(400, {"message": str(error)})
                return
            except urllib.error.HTTPError as error:
                self._send_json(502, {"message": f"Icon source error ({error.code})."})
                return
            except Exception as error:  # noqa: BLE001
                self._send_json(502, {"message": f"Failed to import icon: {error}"})
                return

            self._send_json(
                200,
                {
                    "ok": True,
                    "source": imported.get("source", "iconify-simple"),
                    **imported,
                },
            )
            return

        self._send_json(404, {"message": "Not found."})

    def log_message(self, fmt, *args):
        print(f"[dashboard-api] {self.address_string()} - {fmt % args}")


def main():
    ensure_files_ready()
    server = ThreadingHTTPServer((BIND, PORT), DashboardAPIHandler)
    print(f"Dashboard API listening on http://{BIND}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
