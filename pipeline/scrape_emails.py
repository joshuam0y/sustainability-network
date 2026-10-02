"""Look up email addresses for people on the map who don't have one yet.

Only addresses printed on the person's own public Northeastern profile page, or listed publicly on
their ORCID record, are used. Nothing is guessed from name patterns. Each address is saved with the
page it came from in data/review/found_emails.csv so someone can check it, and people already
looked up recently are skipped so the daily run stays light.

    python3 pipeline/scrape_emails.py
"""
import csv
import concurrent.futures as cf
import datetime as dt
import json
import re
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODES = ROOT / "site" / "public" / "data" / "faculty_nodes.json"
FOUND = ROOT / "data" / "review" / "found_emails.csv"
RETRY_AFTER_DAYS = 14
FIELDS = ["name", "email", "source", "checked"]

# Public profile pages, by college. {} is the name as a URL slug (both name orders are tried).
PROFILE_PAGES = [
    "https://coe.northeastern.edu/people/{}/",
    "https://cos.northeastern.edu/people/{}/",
    "https://cssh.northeastern.edu/faculty/{}/",
    "https://camd.northeastern.edu/faculty/{}/",
    "https://www.khoury.northeastern.edu/people/{}/",
    "https://bouve.northeastern.edu/directory/{}/",
    "https://damore-mckim.northeastern.edu/people/{}/",
    "https://law.northeastern.edu/faculty/{}/",
]
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@northeastern\.edu")


def name_parts(name):
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return [p for p in re.split(r"[^a-z]+", ascii_name) if len(p) > 1]


def fetch(url, accept=None):
    headers = {"User-Agent": "Mozilla/5.0 (sustainability-network email lookup)"}
    if accept:
        headers["Accept"] = accept
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=12) as r:
            return r.read().decode("utf8", "ignore")
    except Exception:
        return ""


def belongs_to(email, parts):
    """The address has to look like this person's: their last name, or first initial plus most of it."""
    local = email.split("@")[0].lower()
    first, last = parts[0], parts[-1]
    return last in local or (first[0] in local and last[:4] in local)


def look_up(person):
    parts = name_parts(person["name"])
    if len(parts) < 2:
        return None, None
    slugs = dict.fromkeys(["-".join(parts[-1:] + parts[:-1]), f"{parts[-1]}-{parts[0]}", "-".join(parts), f"{parts[0]}-{parts[-1]}"])
    for slug in slugs:
        for page in PROFILE_PAGES:
            url = page.format(slug)
            for email in sorted(set(EMAIL.findall(fetch(url)))):
                if belongs_to(email, parts):
                    return email.lower(), url
    profile = person.get("profileUrl") or ""
    if "orcid.org/" in profile:
        text = fetch(f"https://pub.orcid.org/v3.0/{profile.rsplit('/', 1)[1]}/email", accept="application/json")
        try:
            for entry in json.loads(text).get("email", []):
                if entry["email"].lower().endswith("northeastern.edu"):
                    return entry["email"].lower(), profile
        except ValueError:
            pass
    return None, None


def main():
    people = json.loads(NODES.read_text())
    found = {}
    if FOUND.exists():
        found = {r["name"]: r for r in csv.DictReader(FOUND.open())}
    today = dt.date.today()

    def due(p):
        row = found.get(p["name"])
        if row is None:
            return True
        if row["email"]:
            return False
        return (today - dt.date.fromisoformat(row["checked"])).days >= RETRY_AFTER_DAYS

    todo = [p for p in people if not p.get("email") and due(p)]
    with cf.ThreadPoolExecutor(8) as pool:
        for person, (email, source) in zip(todo, pool.map(look_up, todo)):
            found[person["name"]] = {"name": person["name"], "email": email or "", "source": source or "", "checked": today.isoformat()}

    FOUND.parent.mkdir(parents=True, exist_ok=True)
    with FOUND.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(sorted(found.values(), key=lambda r: r["name"]))
    new = sum(1 for p in todo if found[p["name"]]["email"])
    print(f"Looked up {len(todo)} people without an email, found {new}; "
          f"{sum(1 for r in found.values() if r['email'])} found in total -> {FOUND.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
