from __future__ import annotations

import concurrent.futures
import json
import subprocess
import sys
from base64 import b64decode
from pathlib import Path
from typing import Iterable
from urllib.parse import quote, urlparse, urlunparse
from urllib.request import Request, urlopen


WORKDIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = WORKDIR / "seed-media"
MANIFEST_PATH = WORKDIR / "scripts" / "legacy-image-manifest.json"
OLD_PREFIX = "https://cdn.julaherb.saversure.com/"


SQL = r"""
WITH urls AS (
  SELECT image_url FROM products WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM rewards WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM news WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM campaigns WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM missions WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM donations WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM lucky_draw_campaigns WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM lucky_draw_prizes WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
  UNION
  SELECT image_url FROM popups WHERE image_url LIKE 'https://cdn.julaherb.saversure.com/%'
)
SELECT encode(convert_to(image_url, 'UTF8'), 'base64')
FROM urls
WHERE image_url IS NOT NULL AND image_url <> ''
ORDER BY image_url;
"""


def query_urls() -> list[str]:
    command = [
        "docker",
        "exec",
        "-e",
        "PGCLIENTENCODING=UTF8",
        "saversure-postgres",
        "psql",
        "-U",
        "saversure_app",
        "-d",
        "saversure",
        "-t",
        "-A",
        "-c",
        SQL,
    ]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    encoded_rows = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return [b64decode(row).decode("utf-8") for row in encoded_rows]


def download_one(url: str) -> dict[str, object]:
    parsed = urlparse(url)
    object_path = parsed.path.lstrip("/")
    if not object_path:
        return {"url": url, "status": "skipped", "reason": "empty_path"}

    target_path = OUTPUT_DIR / object_path
    target_path.parent.mkdir(parents=True, exist_ok=True)

    if target_path.exists() and target_path.stat().st_size > 0:
        return {
            "url": url,
            "status": "cached",
            "object_path": object_path,
            "bytes": target_path.stat().st_size,
        }

    request_url = urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            quote(parsed.path, safe="/()"),
            parsed.params,
            parsed.query,
            parsed.fragment,
        )
    )

    req = Request(request_url, headers={"User-Agent": "saversure-v2-mirror/1.0"})
    with urlopen(req, timeout=60) as resp:
        data = resp.read()
        target_path.write_bytes(data)

    return {
        "url": url,
        "status": "downloaded",
        "object_path": object_path,
        "bytes": target_path.stat().st_size,
    }


def chunked(items: Iterable[str], size: int) -> Iterable[list[str]]:
    batch: list[str] = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    urls = query_urls()
    print(f"found {len(urls)} unique legacy image urls")

    results: list[dict[str, object]] = []
    completed = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(download_one, url): url for url in urls}
        for future in concurrent.futures.as_completed(futures):
            url = futures[future]
            try:
                result = future.result()
            except Exception as exc:  # noqa: BLE001
                result = {"url": url, "status": "error", "error": str(exc)}
            results.append(result)
            completed += 1
            if completed % 25 == 0 or completed == len(urls):
                ok = sum(1 for item in results if item["status"] in {"downloaded", "cached"})
                err = sum(1 for item in results if item["status"] == "error")
                print(f"progress {completed}/{len(urls)} ok={ok} err={err}")

    MANIFEST_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = sum(1 for item in results if item["status"] in {"downloaded", "cached"})
    err = sum(1 for item in results if item["status"] == "error")
    print(f"done ok={ok} err={err} manifest={MANIFEST_PATH}")
    return 1 if err else 0


if __name__ == "__main__":
    sys.exit(main())
