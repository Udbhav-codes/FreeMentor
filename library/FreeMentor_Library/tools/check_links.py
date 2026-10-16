#!/usr/bin/env python3
"""
FreeMentor library link checker (run on your server / admin machine, NOT in the app).

What it does
  1. YouTube videos: calls the YouTube Data API v3 (videos.list, 50 IDs per call, 1 quota unit each)
     -> fills duration_seconds, real channel name, title, and marks private/deleted videos as "broken".
     -> sets duration_source = "youtube_api". The app shows duration × 1.15, rounded up to 5 min.
  2. Every other URL: HTTP HEAD (falls back to GET) -> status "active" or "broken".
  3. Writes the updated goal file + a CSV report of broken links for the admin panel.

YouTube API Services policy: stored API data (e.g. duration) must be refreshed or deleted within 30 days,
so schedule this script at least every 30 days (e.g. a weekly cron job).

Usage
  export YOUTUBE_API_KEY=...        # keep the key on the server only, never inside the app
  python3 check_links.py goals/jee-main.json [--out goals/jee-main.json] [--report broken.csv]
"""
import csv, json, os, sys, time, re, urllib.request, urllib.parse, urllib.error, datetime, argparse

API = "https://www.googleapis.com/youtube/v3/videos"

def iso8601_to_seconds(d):
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", d or "")
    if not m: return None
    days, h, mi, s = (int(x) if x else 0 for x in m.groups())
    return days * 86400 + h * 3600 + mi * 60 + s

def yt_lookup(ids, key):
    out = {}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        q = urllib.parse.urlencode({"part": "contentDetails,snippet,status", "id": ",".join(chunk), "key": key, "maxResults": 50})
        with urllib.request.urlopen(f"{API}?{q}", timeout=30) as r:
            data = json.load(r)
        for it in data.get("items", []):
            out[it["id"]] = {
                "duration_seconds": iso8601_to_seconds(it["contentDetails"].get("duration")),
                "channel": it["snippet"].get("channelTitle"),
                "title": it["snippet"].get("title"),
                "privacy": it["status"].get("privacyStatus"),
                "language": it["snippet"].get("defaultAudioLanguage"),
            }
        time.sleep(0.2)
    return out

def http_ok(url):
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": "FreeMentor-LinkChecker/1.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return 200 <= r.status < 400, r.status
        except urllib.error.HTTPError as e:
            if method == "GET": return False, e.code
        except Exception as e:
            if method == "GET": return False, str(e)[:60]
    return False, None

def bump_version(version):
    """"2027.3" -> "2027.4". Increments the trailing number, whatever precedes it.

    Why this exists: `publish_library` builds versions.json from
    goal.version, and the app re-downloads a cached goal ONLY when that
    version differs. This script used to rewrite durations and set
    last_link_check without touching version — so a full run, a republish and
    a restart left every phone on the old estimates. The work happened and no
    learner ever saw it.
    """
    m = re.fullmatch(r"(.*?)(\d+)", version or "")
    if m:
        return f"{m.group(1)}{int(m.group(2)) + 1}"
    return f"{version}.2" if version else "1"


def check_one(path, key, skip_web, out_path, now):
    """Checks one goal file in place. Returns (resource_count, broken rows)."""
    doc = json.load(open(path, encoding="utf-8"))
    resources = [r for t in doc["topics"] for b in t["blocks"] for r in b["resources"]] + \
                [r for m in doc.get("milestones", []) for r in m["resources"]]
    broken = []
    vids = sorted({r["youtube_id"] for r in resources if r.get("youtube_id")})
    info = yt_lookup(vids, key) if (key and vids) else {}
    if vids and not key:
        print("YOUTUBE_API_KEY not set - skipping YouTube checks")
    web_cache = {}
    # Tracks whether anything a learner would actually notice changed, so the
    # version is bumped on a real update and not on a no-op re-run.
    before = json.dumps(doc, sort_keys=True, ensure_ascii=False)
    for t in doc["topics"]:
        for b in t["blocks"]:
            for r in b["resources"]:
                if r.get("youtube_id") and key:
                    v = info.get(r["youtube_id"])
                    if not v or v["privacy"] not in ("public", "unlisted"):
                        r["status"] = "broken"; broken.append((t["id"], b["id"], r["url"], "video missing/private"))
                    else:
                        r.update({"status": "active", "duration_seconds": v["duration_seconds"], "duration_source": "youtube_api",
                                  "channel": v["channel"], "title": v["title"]})
                        r["est_minutes"] = int(-(-v["duration_seconds"] * 1.15 // 300) * 5)  # +15%, round up to 5 min
                    r["last_checked"] = now
                elif not r.get("youtube_id") and not skip_web:
                    if r["url"] not in web_cache: web_cache[r["url"]] = http_ok(r["url"])
                    ok, code = web_cache[r["url"]]
                    r["status"] = "active" if ok else "broken"; r["last_checked"] = now
                    if not ok: broken.append((t["id"], b["id"], r["url"], f"HTTP {code}"))
            vids_in_block = [r for r in b["resources"] if r.get("type") == "video" and r.get("role") == "main"]
            if vids_in_block and vids_in_block[0].get("duration_source") == "youtube_api":
                b["est_minutes"] = vids_in_block[0]["est_minutes"]
        t["est_minutes_total"] = sum(b["est_minutes"] for b in t["blocks"])

    # last_link_check is excluded from the comparison on purpose: it changes
    # on every run by definition, so including it would bump the version daily
    # and make all 73 goals re-download for nothing.
    doc["goal"]["last_link_check"] = now
    after = json.dumps({**doc, "goal": {k: v for k, v in doc["goal"].items() if k != "last_link_check"}},
                       sort_keys=True, ensure_ascii=False)
    before_cmp = json.dumps({**json.loads(before), "goal": {k: v for k, v in json.loads(before)["goal"].items() if k != "last_link_check"}},
                            sort_keys=True, ensure_ascii=False)
    changed = after != before_cmp
    old_version = doc["goal"].get("version")
    if changed:
        doc["goal"]["version"] = bump_version(old_version)

    json.dump(doc, open(out_path or path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    note = f"{old_version} -> {doc['goal']['version']}" if changed else f"{old_version} (unchanged)"
    print(f"  {os.path.basename(path):<24} {len(resources):>5} resources  {len(broken):>4} broken  {note}")
    return len(resources), broken


def main():
    ap = argparse.ArgumentParser(
        description="Fill real YouTube durations and flag dead links. Accepts several goal files."
    )
    ap.add_argument("goal_file", nargs="+", help="one or more goals/<id>.json")
    ap.add_argument("--out", help="only valid with a single goal_file")
    ap.add_argument("--report", default="broken_links.csv")
    ap.add_argument("--skip-web", action="store_true",
                    help="only check YouTube; skips ~2950 serial HTTP checks")
    a = ap.parse_args()

    if a.out and len(a.goal_file) > 1:
        sys.exit("--out takes a single file; with several files each is updated in place.")

    key = os.environ.get("YOUTUBE_API_KEY")
    now = datetime.date.today().isoformat()
    total_resources = 0
    all_broken = []

    for path in a.goal_file:
        count, broken = check_one(path, key, a.skip_web, a.out, now)
        total_resources += count
        all_broken.extend((os.path.basename(path), *row) for row in broken)

    with open(a.report, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["goal_file", "topic", "block", "url", "problem"])
        w.writerows(all_broken)
    print(f"\n{len(a.goal_file)} file(s), {total_resources} resources, {len(all_broken)} broken -> {a.report}")
    if all_broken:
        print("Review the CSV before republishing: a broken link is marked, not removed.")


if __name__ == "__main__":
    main()
