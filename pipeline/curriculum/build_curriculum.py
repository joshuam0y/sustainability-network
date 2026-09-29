"""Build the data for the curriculum site from the catalog and Charlie's course labels.

Inputs
  data/catalog/courses.json, programs.json   from scrape_catalog.py
  data/base/course_labels.csv                 Charlie's reviewed labels (2023-24 catalog)
  data/base/course_instructors.csv            course -> people on the faculty map
  data/base/faculty_nodes.json                faculty map people, for names

Outputs (read by the site)
  site/public/data/curriculum/courses.json    sustainability courses
  site/public/data/curriculum/programs.json   every program with its sustainability courses
  site/public/data/curriculum/meta.json
  data/review/model_labeled_courses.csv       courses the model labeled, for someone to check

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

CATALOG = ROOT / "data" / "catalog"
BASE = ROOT / "data" / "base"
OUT = ROOT / "site" / "public" / "data" / "curriculum"
REVIEW = ROOT / "data" / "review"

# Courses without a reviewed label count as sustainability when the model is at least this sure.
# On Charlie's labels, 0.7 is right about 90% of the time and finds about two-thirds of them.
MODEL_THRESHOLD = 0.7

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

    status = {}
    for c in courses:
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
    }))

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
