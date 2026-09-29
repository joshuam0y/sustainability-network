"""Build the data for the curriculum site from the catalog and Charlie's course labels.

Inputs
  data/catalog/courses.json, programs.json   from scrape_catalog.py
  data/base/course_labels.csv                 Charlie's reviewed labels (2023-24 catalog)
  data/base/course_instructors.csv            course -> people on the faculty map
  data/base/faculty_nodes.json                faculty map people, for names
  data/base/course_reviews.csv                decisions from the review page (override everything else)
  data/base/enrollment_trends.csv             yearly totals from the Registrar export (2018-19 to 2022-23)

Outputs (read by the site)
  site/public/data/curriculum/courses.json    sustainability courses
  site/public/data/curriculum/programs.json   every program with its sustainability courses
  site/public/data/curriculum/meta.json
  site/public/data/curriculum/overview.json   totals for the Overview charts
  site/public/data/curriculum/stars.json      numbers for the AASHE STARS report
  site/public/data/curriculum/history.json    each program's counts at every monthly catalog read
  data/review/model_labeled_courses.csv       courses the model labeled, for someone to check
  data/review/program_checks.csv              programs whose results look unusual, for someone to check

Usage: python pipeline/curriculum/build_curriculum.py
"""

import csv
import datetime
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
from themes import THEME_PATTERNS  # noqa: E402  (same themes as the faculty map)
import settings  # noqa: E402

CATALOG = ROOT / "data" / "catalog"
BASE = ROOT / "data" / "base"
OUT = ROOT / "site" / "public" / "data" / "curriculum"
REVIEW = ROOT / "data" / "review"

# Courses without a reviewed label count as sustainability when the model is at least this sure.
# On Charlie's labels, 0.7 is right about 90% of the time and finds about two-thirds of them.
MODEL_THRESHOLD = 0.7

# STARS splits sustainability courses into "focused" (sustainability is the main subject) and "inclusive" (it is
# one part of the course). Until someone reviews a course, a title that is about sustainability counts as focused.
FOCUSED_TITLE = re.compile(r"sustainab|climate|environment|ecolog|energy|conservation|biodiversity|green|carbon|"
                           r"pollution|waste|water|justice|resilien|renewable|ocean|marine|food|earth|planet|"
                           r"natural resource|urban (ecology|systems)|ecosystem", re.I)

# Charlie's sheets abbreviate colleges; the catalog spells them out
COLLEGE_NAMES = {
    "COS": "College of Science", "CSSH": "College of Social Sciences and Humanities", "COE": "College of Engineering",
    "DMSB": "D'Amore-McKim School of Business", "CAMD": "College of Arts, Media and Design",
    "CPS": "College of Professional Studies", "Law": "School of Law", "Bouve": "Bouvé College of Health Sciences",
    "Khoury": "Khoury College of Computer Sciences",
}

# Generic courses whose listing says nothing about their content
GENERIC = re.compile(r"^(elective|directed study|independent study|thesis|dissertation|research|co-?op|internship|"
                     r"special topics|topics|seminar|practicum|readings|capstone|continuing|exam preparation)\b", re.I)


def load_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def course_text(title, description):
    return f"{title}. {title}. {description}"


def train_model(labels):
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline

    rows = [r for r in labels if r["label"] in ("yes", "no")]
    model = make_pipeline(
        TfidfVectorizer(ngram_range=(1, 2), min_df=2, stop_words="english", sublinear_tf=True),
        LogisticRegression(C=4, class_weight="balanced", max_iter=2000),
    )
    model.fit([course_text(r["title"], r["description"]) for r in rows], [r["label"] == "yes" for r in rows])
    return model


def course_number(code):
    subject, _, number = code.partition(" ")
    return subject, int(number) if number.isdigit() else -1


def write_checks(program_rows, programs):
    """Flag programs whose results look unusual, so a person can check the catalog page."""
    raw = {p["url"]: p for p in programs}
    rows = []
    for p in program_rows:
        required_total = sum(1 for c in raw[p["url"]]["courses"] if c["role"] == "required")
        reasons = []
        if len(p["required"]) >= 15:
            reasons.append(f"{len(p['required'])} required sustainability courses")
        if required_total >= 60:
            reasons.append(f"{required_total} required courses in total")
        if p["listedCount"] < 3:
            reasons.append(f"only {p['listedCount']} courses read from the page")
        if reasons:
            rows.append([p["name"], "; ".join(reasons), p["url"]])
    REVIEW.mkdir(parents=True, exist_ok=True)
    with open(REVIEW / "program_checks.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["program", "why it looks unusual", "catalog page"])
        w.writerows(rows)
    print(f"{len(rows)} programs flagged for a check in data/review/program_checks.csv")


def write_history(program_rows, updated):
    """Keep each program's counts from every monthly catalog read, to show change over time."""
    month = updated[:7]
    snapshot_dir = ROOT / "data" / "history"
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    (snapshot_dir / f"{month}.json").write_text(json.dumps(
        {p["id"]: [len(p["required"]), len(p["options"])] for p in program_rows}, separators=(",", ":")))
    history = defaultdict(list)
    for path in sorted(snapshot_dir.glob("*.json")):
        for pid, (req, opt) in json.loads(path.read_text()).items():
            history[pid].append({"month": path.stem, "required": req, "options": opt})
    # Only programs that changed are worth sending to the site
    changed = {pid: h for pid, h in history.items() if len({(x["required"], x["options"]) for x in h}) > 1}
    (OUT / "history.json").write_text(json.dumps({"months": sorted(p.stem for p in snapshot_dir.glob("*.json")),
                                                  "programs": changed}, separators=(",", ":")))


def write_overview_and_stars(labels, reviews, course_rows, program_rows):
    """Totals for the Overview charts and the STARS report.

    Courses offered in 2023-24 come from the sustainability team's reviewed list (every course taught that year);
    trends come from the Registrar export.
    """
    offered = [r for r in labels.values() if r["label"] in ("yes", "no", "maybe")]
    for r in offered:
        decision = reviews.get(r["code"], {}).get("decision")
        r["sustainable"] = decision in ("focused", "inclusive", "yes") if decision else r["label"] == "yes"
        r["level"] = "Graduate" if course_number(r["code"])[1] >= 5000 else "Undergraduate"
        r["college_name"] = COLLEGE_NAMES.get(r["college"], r["college"])
    focus = {c["code"]: c["focus"] for c in course_rows}
    for r in offered:
        r["focus"] = focus.get(r["code"]) or ("focused" if FOCUSED_TITLE.search(r["title"]) else "inclusive")

    def summarize(rows):
        sust = [r for r in rows if r["sustainable"]]
        return {"courses": len(rows), "sustainability": len(sust),
                "focused": sum(1 for r in sust if r["focus"] == "focused"),
                "inclusive": sum(1 for r in sust if r["focus"] != "focused")}

    colleges = defaultdict(list)
    departments = defaultdict(list)
    for r in offered:
        colleges[r["college_name"]].append(r)
        departments[(r["college_name"], r["department"])].append(r)

    trends = load_csv(BASE / "enrollment_trends.csv") if (BASE / "enrollment_trends.csv").exists() else []
    for t in trends:
        for key in ("courses", "sustainability_courses", "seats", "sustainability_seats"):
            t[key] = int(float(t[key]))

    overview = {
        "year": "2023-24",
        "university": summarize(offered),
        "byLevel": {level: summarize([r for r in offered if r["level"] == level]) for level in ("Undergraduate", "Graduate")},
        "colleges": sorted(({"college": c, **summarize(rows)} for c, rows in colleges.items() if len(rows) >= 20),
                           key=lambda x: -x["sustainability"] / x["courses"]),
        "departments": sorted(({"college": c, "department": d, **summarize(rows)}
                               for (c, d), rows in departments.items() if len(rows) >= 5),
                              key=lambda x: (-x["sustainability"] / x["courses"], x["department"])),
        "trends": trends,
    }
    (OUT / "overview.json").write_text(json.dumps(overview, ensure_ascii=False, separators=(",", ":")))

    # AASHE STARS, Academics: sustainability course offerings (AC-1) and the share of departments offering them
    dept_rows = [d for d in departments.values()]
    stars = {
        "year": "2023-24",
        "undergraduate": summarize([r for r in offered if r["level"] == "Undergraduate"]),
        "graduate": summarize([r for r in offered if r["level"] == "Graduate"]),
        "departments": len(dept_rows),
        "departmentsWithSustainability": sum(1 for rows in dept_rows if any(r["sustainable"] for r in rows)),
        "focusReviewed": sum(1 for r in reviews.values() if r["decision"] in ("focused", "inclusive")),
        "programs": {
            level: {"total": sum(1 for p in program_rows if p["level"] == level and p["type"] in ("Bachelor's", "Master's", "Doctorate")),
                    "requiring": sum(1 for p in program_rows if p["level"] == level and p["required"]
                                     and p["type"] in ("Bachelor's", "Master's", "Doctorate"))}
            for level in ("Undergraduate", "Graduate")
        },
    }
    (OUT / "stars.json").write_text(json.dumps(stars, separators=(",", ":")))


def main():
    courses = json.loads((CATALOG / "courses.json").read_text())
    programs = json.loads((CATALOG / "programs.json").read_text())
    labels = {r["code"]: r for r in load_csv(BASE / "course_labels.csv")}
    instructors = defaultdict(list)
    for r in load_csv(BASE / "course_instructors.csv"):
        instructors[r["code"]].append(r["faculty_id"])
    people = {p["id"]: p["name"] for p in json.loads((BASE / "faculty_nodes.json").read_text())}

    # ---- Label every course in the current catalog
    unlabeled = [c for c in courses if c["code"] not in labels and not GENERIC.match(c["title"])]
    probabilities = {}
    if unlabeled:
        model = train_model(labels.values())
        scores = model.predict_proba([course_text(c["title"], c["description"]) for c in unlabeled])[:, 1]
        probabilities = {c["code"]: float(p) for c, p in zip(unlabeled, scores)}

    reviews = {}
    if (BASE / "course_reviews.csv").exists():
        reviews = {r["code"]: r for r in load_csv(BASE / "course_reviews.csv") if r.get("decision")}

    status = {}
    for c in courses:
        if c["code"] in reviews:
            # A decision made on the review page wins over Charlie's label and the model
            status[c["code"]] = None if reviews[c["code"]]["decision"] == "no" else "reviewed"
            continue
        if c["code"] in labels:
            # Charlie's "maybe" courses were never confirmed, so only "yes" counts
            status[c["code"]] = "reviewed" if labels[c["code"]]["label"] == "yes" else None
        elif probabilities.get(c["code"], 0) >= MODEL_THRESHOLD:
            status[c["code"]] = "model"
    sustainable = {code for code, s in status.items() if s}

    catalog_by_subject = defaultdict(list)
    for c in courses:
        subject, number = course_number(c["code"])
        catalog_by_subject[subject].append((number, c["code"]))

    def expand(entry):
        if "range" not in entry:
            return [entry["code"]]
        (s1, n1), (s2, n2) = course_number(entry["range"][0]), course_number(entry["range"][1])
        if s1 != s2:
            return [entry["range"][0], entry["range"][1]]
        return [code for number, code in catalog_by_subject[s1] if n1 <= number <= n2]

    # ---- Programs: which of their listed courses are sustainability courses
    program_rows, used_in = [], defaultdict(list)
    for p in programs:
        required, options, in_ranges, listed = set(), set(), set(), set()
        for entry in p["courses"]:
            for code in expand(entry):
                listed.add(code)
                if code not in sustainable:
                    continue
                if "range" in entry:
                    # "Any EEMB course 2000-5999": allowed, but not something the program points students to
                    in_ranges.add(code)
                else:
                    (required if entry["role"] == "required" else options).add(code)
        options -= required
        in_ranges -= required | options
        if not listed:
            continue
        campus = re.search(r"\(([^)]+)\)\s*$", p["name"])
        pid = re.sub(r"[^a-z0-9]+", "-", p["url"].split("catalog.northeastern.edu/")[-1].lower()).strip("-")
        program_rows.append({
            "id": pid,
            "name": p["name"],
            "baseName": re.sub(r"\s*\([^)]*\)\s*$", "", p["name"]),
            "campus": campus.group(1) if campus else None,
            "type": p["type"],
            "level": p["level"],
            "college": " ".join(p["college"].split()),
            "url": p["url"],
            "listedCount": len(listed),
            "required": sorted(required),
            "options": sorted(options),
            "inRanges": sorted(in_ranges),
        })
        for code in required | options:
            used_in[code].append(pid)

    # ---- Completion rates, when University Decision Support provides them (data/base/completions.csv with
    # columns: program, level, graduates, completed_sustainability, year). Matched by program name.
    if (BASE / "completions.csv").exists():
        rates = {(r["program"].strip().lower(), r.get("level", "").strip()): r for r in load_csv(BASE / "completions.csv")}
        for p in program_rows:
            r = rates.get((p["baseName"].split(",")[0].strip().lower(), p["level"])) or rates.get((p["baseName"].lower(), p["level"]))
            if r and int(r["graduates"] or 0) > 0:
                p["completion"] = {"rate": int(r["completed_sustainability"]) / int(r["graduates"]),
                                   "graduates": int(r["graduates"]), "year": r.get("year", "")}

    # ---- Sustainability courses with their details
    by_code = {c["code"]: c for c in courses}
    # Courses the model labeled have no department; use the most common one for their subject in Charlie's list
    subject_home = defaultdict(lambda: defaultdict(int))
    for r in labels.values():
        subject_home[r["code"].split(" ")[0]][(r["college"], r["department"])] += 1
    home = {subject: max(counts, key=counts.get) for subject, counts in subject_home.items()}
    course_rows = []
    for code in sorted(sustainable):
        c = by_code[code]
        text = f"{c['title']}. {c['description']}".lower()
        course_rows.append({
            "code": code,
            "subject": code.split(" ")[0],
            "title": c["title"],
            "hours": c["hours"],
            "description": c["description"],
            "label": status[code],
            "focus": (reviews[code]["decision"] if code in reviews and reviews[code]["decision"] in ("focused", "inclusive")
                      else "focused" if FOCUSED_TITLE.search(c["title"]) else "inclusive"),
            "focusReviewed": code in reviews and reviews[code]["decision"] in ("focused", "inclusive"),
            "confidence": round(probabilities[code], 2) if status[code] == "model" else None,
            "department": labels.get(code, {}).get("department") or home.get(code.split(" ")[0], (None, None))[1],
            "college": COLLEGE_NAMES.get(labels.get(code, {}).get("college") or home.get(code.split(" ")[0], (None, None))[0],
                                         "Other"),
            "themes": sorted(t for t, pattern in THEME_PATTERNS.items() if pattern.search(text)),
            "instructors": [{"id": i, "name": people[i]} for i in sorted(set(instructors.get(code, []))) if i in people],
            "programs": sorted(used_in.get(code, [])),
        })

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "courses.json").write_text(json.dumps(course_rows, ensure_ascii=False, separators=(",", ":")))
    (OUT / "programs.json").write_text(json.dumps(program_rows, ensure_ascii=False, separators=(",", ":")))
    updated = datetime.date.fromtimestamp((CATALOG / "programs.json").stat().st_mtime).isoformat()
    (OUT / "meta.json").write_text(json.dumps({
        "catalogUpdated": updated,
        "catalogCourses": len(courses),
        "sustainabilityCourses": len(course_rows),
        "reviewed": sum(1 for c in course_rows if c["label"] == "reviewed"),
        "model": sum(1 for c in course_rows if c["label"] == "model"),
        "programs": len(program_rows),
        "contact": settings.CONTACT_EMAIL and f"mailto:{settings.CONTACT_EMAIL}"
        or f"https://github.com/{settings.REPOSITORY}/issues/new",
    }))

    # Decisions already made, so the review page can show them and include them in its download
    (OUT / "reviews.json").write_text(json.dumps(list(reviews.values()), ensure_ascii=False, separators=(",", ":")))

    write_checks(program_rows, programs)
    write_history(program_rows, updated)
    write_overview_and_stars(labels, reviews, course_rows, program_rows)

    REVIEW.mkdir(parents=True, exist_ok=True)
    with open(REVIEW / "model_labeled_courses.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["code", "title", "confidence", "description"])
        for c in sorted((c for c in course_rows if c["label"] == "model"), key=lambda c: -c["confidence"]):
            w.writerow([c["code"], c["title"], c["confidence"], c["description"]])

    missing = sum(1 for c in courses if c["code"] not in labels)
    print(f"{len(courses)} catalog courses ({missing} not in Charlie's labels), {len(course_rows)} sustainability "
          f"courses ({sum(1 for c in course_rows if c['label'] == 'model')} labeled by the model), "
          f"{len(program_rows)} programs -> {OUT}")


if __name__ == "__main__":
    main()
