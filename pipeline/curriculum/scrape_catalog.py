"""Collect Northeastern's public academic catalog (catalog.northeastern.edu).

Saves:
  data/catalog/courses.json    every course: code, title, credit hours, description
  data/catalog/programs.json   every program (majors, minors, graduate degrees, certificates) with the
                               courses its requirements list, each marked "required" or "option"

Usage: python pipeline/curriculum/scrape_catalog.py
The catalog changes about once a year, so this runs monthly rather than daily.
"""

import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "catalog"
BASE = "https://catalog.northeastern.edu"
HEADERS = {"User-Agent": "Northeastern sustainability curriculum map (sustainability-network on GitHub)"}

# Catalog sections that aren't colleges
SKIP_SECTIONS = {"academic-policies-procedures", "admission", "expenses", "information-entering-students",
                 "university-academics", "tuition-fees", "graduate-education", "financial-information"}

CODE = r"[A-Z]{2,5}\s?\d{4}"


def fetch(path):
    url = path if path.startswith("http") else BASE + path
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as res:
                return res.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ""
            time.sleep(2 ** attempt * 3)
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2 ** attempt * 3)
    print(f"  gave up on {url}")
    return ""


def text(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def norm_code(code):
    return re.sub(r"([A-Z]+)\s*(\d+)", r"\1 \2", code.replace("\xa0", " ")).strip()


# ---------- Courses ----------

def scrape_subject(path):
    page = fetch(path)
    courses = []
    for block in re.findall(r'<div class="courseblock">(.*?)</div>\s*(?=<div class="courseblock">|</div>)', page, re.S):
        title = re.search(r'<p class="courseblocktitle[^"]*">(.*?)</p>', block, re.S)
        if not title:
            continue
        t = text(title.group(1))
        m = re.match(rf"({CODE})\.\s*(.*?)\.\s*\(([^)]*)\)", t)
        if not m:
            continue
        desc = re.search(r'<p class="cb_desc">(.*?)</p>', block, re.S) or re.search(r'<p class="courseblockdesc[^"]*">(.*?)</p>', block, re.S)
        courses.append({
            "code": norm_code(m.group(1)),
            "title": m.group(2).strip(),
            "hours": m.group(3).replace("Hours", "").replace("Hour", "").strip(),
            "description": text(desc.group(1)) if desc else "",
        })
    return courses


# ---------- Programs ----------

DEGREE_TYPES = [
    (r"\bminor\b", "Minor"),
    (r"\b(graduate )?certificate\b", "Certificate"),
    (r"\b(phd|doctor|dnp|edd|dpt|otd|pharmd|jd|dlp|dba)\b", "Doctorate"),
    (r"\b(m[a-z]{0,6}|mba|llm|mpa|mph|mps|msn|mfa)\b", "Master's"),
    (r"\b(b[a-z]{0,6})\b", "Bachelor's"),
]


def program_type(name):
    degree = name.split(",")[-1].split("(")[0].strip().lower() if "," in name else name.lower()
    for pattern, label in DEGREE_TYPES:
        if re.search(pattern, degree):
            return label
    return "Other"


# "Complete two of the following", "Choose one course", "Complete 8 semester hours from..." are choices;
# "Complete the following course" is not
CHOICE = re.compile(r"\b(complete|choose|select|take|pass)\b.*\b(of the following|from the following|from among)\b"
                    r"|\bone of the following\b|\bfollowing (options|list)\b"
                    r"|\b(complete|choose|select|take)\s+(one|two|three|four|five|six|seven|eight|\d+|a minimum of|"
                    r"at least|any|an additional|additional)\b", re.I)


def parse_requirements(page):
    """Return [{code, role, section}] from every requirements table on a program page."""
    found = {}
    last_end, carry_choice = 0, False
    for match in re.finditer(r'<table class="sc_courselist.*?</table>', page, re.S):
        table = match.group(0)
        # The text between the previous table and this one often says how to use it ("Complete two of the
        # following"). An instruction there, or above the table's first heading, covers the whole table.
        lead_in = text(page[max(last_end, match.start() - 1500):match.start()])[-250:]
        last_end = match.end()
        # Some pages end one table with "Complete one of the following:" and list the courses in the next
        table_choice = bool(CHOICE.search(lead_in)) or carry_choice
        section, choosing, seen_header = "", table_choice, False
        # A choice instruction with no courses after it in its own table applies to the next table
        unused_choice = False
        prev_codes = []
        for row in re.findall(r"<tr[^>]*>.*?</tr>", table, re.S):
            cls = (re.search(r'<tr class="([^"]*)"', row) or [None, ""])[1]
            row_text = text(row)
            if "areaheader" in cls:
                section, choosing, seen_header = row_text, table_choice, True
                continue
            if CHOICE.search(row_text):
                choosing = True
                unused_choice = True
                if not seen_header:
                    table_choice = True
            # Codes come only from the course-code column; notes mention codes too ("X is not an approved option")
            codecol = re.search(r'<td class="codecol[^"]*"[^>]*>(.*?)</td>', row, re.S)
            code_text = text(codecol.group(1)).replace("\xa0", " ") if codecol else ""
            # Ranges ("EECE 3324 to EECE 4698") are written as comment rows that contain only the range
            if not codecol and re.fullmatch(rf"{CODE}\s+to\s+{CODE}", row_text.replace("\xa0", " ")):
                code_text = row_text.replace("\xa0", " ")
            codes = [norm_code(c) for c in re.findall(CODE, code_text)]
            if not codes:
                continue
            is_range = bool(re.search(rf"{CODE}\s+to\s+{CODE}", code_text))
            is_or = "orclass" in cls or row_text.lower().startswith("or ")
            optional = choosing or is_range or is_or or "elective" in section.lower()
            if is_or:
                for c in prev_codes:  # "X or Y": neither is strictly required
                    if found.get(c, {}).get("role") == "required":
                        found[c]["role"] = "option"
            if is_range:
                start, end = codes[0], codes[-1]
                found.setdefault(f"{start} to {end}", {"code": f"{start} to {end}", "role": "option",
                                                       "section": section, "range": [start, end]})
                prev_codes = []
                continue
            for c in codes:
                role = "option" if optional else "required"
                entry = found.setdefault(c, {"code": c, "role": role, "section": section})
                if role == "required":
                    entry["role"] = "required"
            prev_codes = codes
            if codes:
                unused_choice = False
        carry_choice = unused_choice
    return list(found.values())


# A program page has a requirements tab: "programrequirementstexttab" on majors and graduate programs,
# "minorrequirementstexttab" on minors (and similar names elsewhere)
REQUIREMENTS_TAB = re.compile(r'id="[a-z]*requirementstexttab"')


# Short notices at the top of some overviews ("Admissions to this program will open for 2027-2028")
NOTICE = re.compile(r"\badmission|\bwill (open|begin|close)\b|not (currently )?accepting|no longer (admit|accept|offer)|"
                    r"^please note|^note:|\beffective (fall|spring|summer)\b", re.I)


def plain(words):
    """Catalog text, with em and en dashes written as commas and hyphens."""
    return re.sub(r"\s*[\u2014]\s*", ", ", words).replace("\u2013", "-")


def overview(page):
    """(description, notice): the first real paragraph of the catalog page's overview tab, and any short notice
    above it (for example when admissions open)."""
    box = re.search(r'<div id="textcontainer"[^>]*>(.*?)</div>', page, re.S)
    notice = ""
    for para in re.findall(r"<p[^>]*>(.*?)</p>", box.group(1) if box else "", re.S):
        words = plain(text(para))
        if NOTICE.search(words) and len(words) < 200:
            notice = notice or words
            continue
        if len(words) > 40:
            return words, notice
    return "", notice


def links_under(page, prefix):
    return {h for h in re.findall(r'href="(' + re.escape(prefix) + r'[a-z0-9-]+/(?:[a-z0-9-]+/)*)"', page)}


def crawl_level(level):
    """Walk /undergraduate/ or /graduate/: colleges -> departments -> program pages."""
    index = fetch(f"/{level}/")
    colleges = sorted(p for p in links_under(index, f"/{level}/")
                      if p.count("/") == 3 and p.split("/")[2] not in SKIP_SECTIONS)
    programs, seen = [], set()
    frontier = [(c, c) for c in colleges]
    while frontier:
        batch, frontier = frontier, []
        with ThreadPoolExecutor(max_workers=4) as pool:
            pages = list(pool.map(lambda item: fetch(item[0]), batch))
        for (path, college), page in zip(batch, pages):
            if path in seen or not page:
                continue
            seen.add(path)
            title = re.search(r"<title>(.*?)</title>", page, re.S)
            name = html.unescape(title.group(1)).split("<")[0].strip() if title else path
            if "sc_courselist" in page and REQUIREMENTS_TAB.search(page):
                college_name = " ".join(html.unescape((re.search(r'<a href="' + re.escape(college) + r'">([^<]+)</a>', page)
                                                       or [None, college.split("/")[2]])[1]).split())
                programs.append({
                    "name": name,
                    "type": program_type(name),
                    "level": "Undergraduate" if level == "undergraduate" else "Graduate",
                    "college": college_name,
                    "url": BASE + path,
                    "description": overview(page)[0],
                    "notice": overview(page)[1],
                    "courses": parse_requirements(page),
                })
            if path.count("/") < 6:
                frontier += [(p, college) for p in links_under(page, path) if p not in seen and not p.endswith(".pdf")]
        print(f"  {level}: {len(seen)} pages visited, {len(programs)} programs found")
    return programs


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    print("Collecting course descriptions...")
    index = fetch("/course-descriptions/")
    subjects = sorted(set(re.findall(r'href="(/course-descriptions/[a-z]+/)"', index)))
    with ThreadPoolExecutor(max_workers=4) as pool:
        courses = [c for batch in pool.map(scrape_subject, subjects) for c in batch]
    if len(courses) < 1000:
        sys.exit(f"Only found {len(courses)} courses; the catalog layout may have changed. Nothing saved.")
    courses = sorted({c["code"]: c for c in courses}.values(), key=lambda c: c["code"])
    print(f"{len(courses)} courses in {len(subjects)} subjects")

    print("Collecting program requirements...")
    programs = crawl_level("undergraduate") + crawl_level("graduate")
    if len(programs) < 100:
        sys.exit(f"Only found {len(programs)} programs; the catalog layout may have changed. Nothing saved.")
    programs.sort(key=lambda p: (p["level"], p["name"]))

    (OUT / "courses.json").write_text(json.dumps(courses, indent=1, ensure_ascii=False))
    (OUT / "programs.json").write_text(json.dumps(programs, indent=1, ensure_ascii=False))
    print(f"Saved {len(courses)} courses and {len(programs)} programs to {OUT}")


if __name__ == "__main__":
    main()
