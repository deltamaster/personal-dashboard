"""Download Douban movie posters and upload to OSS (shared helpers)."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from tablestore import OTSClient, Row

DOUBAN_API = "https://m.douban.com/rexxar/api/v2/movie/{subject_id}?for_mobile=1"
USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
)

DEFAULT_OTS_ENDPOINT = "https://pd-dash-sg.ap-southeast-1.ots.aliyuncs.com"
DEFAULT_OTS_INSTANCE = "pd-dash-sg"
DEFAULT_OSS_BUCKET = "pd-web-sg"
DEFAULT_OSS_ENDPOINT = "oss-ap-southeast-1.aliyuncs.com"
DEFAULT_PUBLIC_BASE = "https://pd.huhansen.com"
OTS_TABLE = "pd_movies"


def load_dotenv_local() -> None:
    """Load repo-root .env.local into os.environ (does not override existing vars)."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(root, ".env.local")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_aliyun_credentials() -> tuple[str | None, str | None, str | None]:
    ak = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_ID")
    sk = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_SECRET")
    token = os.environ.get("ALIBABA_CLOUD_SECURITY_TOKEN")
    if ak and sk:
        return ak, sk, token

    config_path = os.path.expanduser("~/.aliyun/config.json")
    if not os.path.isfile(config_path):
        return None, None, None

    with open(config_path, encoding="utf-8") as f:
        config = json.load(f)

    profile = next(
        (p for p in config.get("profiles", []) if p.get("name") == "default"),
        None,
    )
    if not profile:
        return None, None, None

    return (
        profile.get("access_key_id"),
        profile.get("access_key_secret"),
        profile.get("sts_token"),
    )


def _assume_role(
    ak: str, sk: str, role_arn: str, session_name: str = "poster-local"
) -> tuple[str, str, str]:
    from aliyunsdkcore.client import AcsClient
    from aliyunsdksts.request.v20150401 import AssumeRoleRequest

    region = os.environ.get("ALIBABA_CLOUD_REGION", "ap-southeast-1")
    client = AcsClient(ak, sk, region)
    req = AssumeRoleRequest.AssumeRoleRequest()
    req.set_RoleArn(role_arn)
    req.set_RoleSessionName(session_name)
    req.set_DurationSeconds(3600)
    data = json.loads(client.do_action_with_exception(req))
    creds = data["Credentials"]
    return creds["AccessKeyId"], creds["AccessKeySecret"], creds["SecurityToken"]


def _role_arn_from_name(role_name: str) -> str | None:
    ak, sk, token = get_aliyun_credentials()
    if not ak or not sk or token:
        return None
    try:
        from aliyunsdkcore.client import AcsClient
        from aliyunsdkram.request.v20150501 import GetRoleRequest

        region = os.environ.get("ALIBABA_CLOUD_REGION", "cn-shanghai")
        client = AcsClient(ak, sk, region)
        req = GetRoleRequest.GetRoleRequest()
        req.set_RoleName(role_name)
        data = json.loads(client.do_action_with_exception(req))
        return data.get("Role", {}).get("Arn")
    except Exception:
        return None


def resolve_credentials(*, assume_role: bool = True) -> tuple[str, str, str | None]:
    """
    Return (access_key_id, secret, sts_token).

    When assume_role is True (default), uses STS if ALIBABA_CLOUD_ROLE_ARN is set,
    or assumes ALIBABA_CLOUD_ASSUME_ROLE_NAME (default ResourceAdmin) when no token yet.
    """
    ak, sk, token = get_aliyun_credentials()
    if not ak or not sk:
        raise RuntimeError("Missing Alibaba credentials (env or ~/.aliyun/config.json)")
    if token or not assume_role:
        return ak, sk, token

    role_arn = os.environ.get("ALIBABA_CLOUD_ROLE_ARN")
    if not role_arn:
        role_name = os.environ.get("ALIBABA_CLOUD_ASSUME_ROLE_NAME", "ResourceAdmin")
        role_arn = _role_arn_from_name(role_name)

    if role_arn:
        return _assume_role(ak, sk, role_arn)

    return ak, sk, None


def fetch_douban_movie(subject_id: str) -> dict[str, Any]:
    url = DOUBAN_API.format(subject_id=subject_id)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": f"https://m.douban.com/movie/subject/{subject_id}/",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def extract_poster_url(data: dict[str, Any]) -> str | None:
    pic = data.get("pic") or {}
    for key in ("large", "normal"):
        url = pic.get(key)
        if isinstance(url, str) and url.startswith("http"):
            return url
    cover = data.get("cover_url")
    if isinstance(cover, str) and cover.startswith("http"):
        return cover
    return None


def download_poster_bytes(subject_id: str, poster_url: str) -> tuple[bytes, str]:
    try:
        return _download_poster_urllib(subject_id, poster_url)
    except ValueError:
        if shutil.which("curl"):
            return _download_poster_curl(subject_id, poster_url)
        raise


def _download_poster_urllib(subject_id: str, poster_url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        poster_url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": f"https://movie.douban.com/subject/{subject_id}/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
        content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
    if not _looks_like_image(data, content_type):
        raise ValueError(
            f"Expected image bytes, got {content_type} ({len(data)} bytes)"
        )
    return data, content_type


def _download_poster_curl(subject_id: str, poster_url: str) -> tuple[bytes, str]:
    result = subprocess.run(
        [
            "curl",
            "-sL",
            "-A",
            USER_AGENT,
            "-H",
            f"Referer: https://movie.douban.com/subject/{subject_id}/",
            "-H",
            "Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "-w",
            "\n%{content_type}",
            poster_url,
        ],
        capture_output=True,
        check=False,
        timeout=60,
    )
    if result.returncode != 0:
        raise ValueError(f"curl failed (exit {result.returncode})")
    out = result.stdout
    if b"\n" not in out:
        raise ValueError("curl response missing content-type trailer")
    data, content_type_line = out.rsplit(b"\n", 1)
    content_type = content_type_line.decode("utf-8", errors="replace").strip() or "image/jpeg"
    if not _looks_like_image(data, content_type):
        raise ValueError(
            f"Expected image bytes, got {content_type} ({len(data)} bytes)"
        )
    return data, content_type.split(";")[0].strip()


def _looks_like_image(data: bytes, content_type: str) -> bool:
    if len(data) < 12:
        return False
    if data.startswith(b"\xff\xd8"):
        return True
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return True
    if content_type.startswith("image/"):
        return b"<html" not in data[:256].lower() and b"<script" not in data[:256].lower()
    return False


def poster_oss_key(douban_subject_id: str, content_type: str = "image/jpeg") -> str:
    ext = "jpg"
    if "png" in content_type:
        ext = "png"
    elif "webp" in content_type:
        ext = "webp"
    return f"movies/posters/{douban_subject_id}.{ext}"


def poster_public_url(public_base: str, douban_subject_id: str, content_type: str) -> str:
    key = poster_oss_key(douban_subject_id, content_type)
    return f"{public_base.rstrip('/')}/{key}"


def is_douban_poster_url(url: str | None) -> bool:
    return bool(url and "doubanio.com" in url)


def is_self_hosted_poster_url(url: str | None, public_base: str = DEFAULT_PUBLIC_BASE) -> bool:
    if not url:
        return False
    prefix = f"{public_base.rstrip('/')}/movies/posters/"
    return url.startswith(prefix)


def oss_poster_exists(
    *,
    bucket_name: str,
    endpoint: str,
    douban_subject_id: str,
    ak: str,
    sk: str,
    token: str | None = None,
) -> tuple[bool, str | None, str]:
    """Return (exists, object_key, content_type)."""
    import oss2

    auth = oss2.StsAuth(ak, sk, token) if token else oss2.Auth(ak, sk)
    bucket = oss2.Bucket(auth, f"https://{endpoint}", bucket_name)
    for ext, content_type in (("jpg", "image/jpeg"), ("png", "image/png"), ("webp", "image/webp")):
        key = f"movies/posters/{douban_subject_id}.{ext}"
        if bucket.object_exists(key):
            return True, key, content_type
    return False, None, "image/jpeg"


def upload_to_oss(
    *,
    bucket_name: str,
    endpoint: str,
    object_key: str,
    data: bytes,
    content_type: str,
    ak: str,
    sk: str,
    token: str | None = None,
) -> None:
    import oss2

    auth = oss2.StsAuth(ak, sk, token) if token else oss2.Auth(ak, sk)
    bucket = oss2.Bucket(auth, f"https://{endpoint}", bucket_name)
    bucket.put_object(object_key, data, headers={"Content-Type": content_type})


def ots_client(
    *,
    endpoint: str | None = None,
    instance: str | None = None,
    assume_role: bool = True,
) -> OTSClient:
    ak, sk, token = resolve_credentials(assume_role=assume_role)
    endpoint = endpoint or os.environ.get("OTS_ENDPOINT", DEFAULT_OTS_ENDPOINT)
    instance = instance or os.environ.get("OTS_INSTANCE_NAME", DEFAULT_OTS_INSTANCE)
    return OTSClient(endpoint, ak, sk, instance, sts_token=token)


def apply_stack_preset(stack: str) -> tuple[str, str, str, str]:
    """Return (ots_endpoint, ots_instance, oss_bucket, oss_endpoint)."""
    if stack == "sg":
        return (
            DEFAULT_OTS_ENDPOINT,
            DEFAULT_OTS_INSTANCE,
            DEFAULT_OSS_BUCKET,
            DEFAULT_OSS_ENDPOINT,
        )
    if stack == "cn-shanghai":
        return (
            "https://pd-dashboard.cn-shanghai.ots.aliyuncs.com",
            "pd-dashboard",
            os.environ.get("OSS_WEB_BUCKET", "huhansen-web"),
            os.environ.get("OSS_WEB_REGION", "oss-cn-shanghai") + ".aliyuncs.com"
            if os.environ.get("OSS_WEB_REGION", "").startswith("oss-")
            else "oss-cn-shanghai.aliyuncs.com",
        )
    raise ValueError(f"Unknown stack: {stack}")


def get_movie_row(client: OTSClient, douban_subject_id: str) -> dict[str, Any] | None:
    consumed, row, _next = client.get_row(
        OTS_TABLE,
        [("douban_subject_id", str(douban_subject_id))],
    )
    if row is None:
        return None
    data: dict[str, Any] = {}
    for name, value in row.primary_key:
        data[name] = value
    for item in row.attribute_columns:
        if len(item) >= 2:
            data[item[0]] = item[1]
    return data


def put_movie_row(client: OTSClient, row_dict: dict[str, Any]) -> None:
    douban_id = str(row_dict["douban_subject_id"])
    primary_key = [("douban_subject_id", douban_id)]
    attribute_columns: list[tuple[str, Any]] = []
    for name, value in row_dict.items():
        if name in ("douban_subject_id", "id"):
            continue
        if value is None:
            continue
        attribute_columns.append((name, value))
    client.put_row(OTS_TABLE, Row(primary_key, attribute_columns))
