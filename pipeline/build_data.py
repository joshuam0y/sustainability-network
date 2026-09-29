"""Combine the original network (from the Tableau dashboard) with recent published research.

Inputs
  data/base/            themes, people and links exported from the Tableau dashboard
  data/openalex/        papers collected by scrape_openalex.py
  data/exclude.csv      people to leave out of the site (one name per row, with a reason)

Outputs (read by the website)
  site/public/data/nodes_keywords.json, faculty_nodes.json, links.json, meta.json
  data/review/new_people.csv   people added from published research, for someone to double-check

Usage: python pipeline/build_data.py
"""

import csv
import datetime
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "data" / "base"
OPENALEX = ROOT / "data" / "openalex"
OUT = ROOT / "site" / "public" / "data"
REVIEW = ROOT / "data" / "review"

# A person is linked to a theme from their publications once they have this many papers in it
MIN_PAPERS_PER_THEME = 2
# People not in the original network need this many sustainability papers to be added
MIN_PAPERS_NEW_PERSON = 4
# Papers shown on each person's card
PAPERS_SHOWN = 5

RESEARCH_SOURCE = "Published research"


def name_key(name):
    """'Jennie C. Stephens' and 'Jennie Stephens' -> 'jennie stephens'."""
    if not name:
        return None
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    tokens = [t for t in re.split(r"[^a-z]+", text) if len(t) > 1]
    return f"{tokens[0]} {tokens[-1]}" if len(tokens) >= 2 else None


def load(name):
    return json.loads((BASE / name).read_text())


def main():
    themes = load("nodes_keywords.json")
    people = {p["id"]: p for p in load("faculty_nodes.json")}
    links = {(l["source"], l["target"]): l for l in load("links.json")}
    theme_ids = {t["name"]: t["id"] for t in themes}

    papers = json.loads((OPENALEX / "papers.json").read_text()) if (OPENALEX / "papers.json").exists() else []
    authors = json.loads((OPENALEX / "authors.json").read_text()) if (OPENALEX / "authors.json").exists() else {}
    excluded = set()
    if (ROOT / "data" / "exclude.csv").exists():
        with open(ROOT / "data" / "exclude.csv") as f:
            excluded = {name_key(row["name"]) for row in csv.DictReader(f)}

    by_key = {}
    for p in people.values():
        by_key.setdefault(name_key(p["name"]), p["id"])

    # Group papers by person: people already in the network by name, everyone else by OpenAlex id
    person_papers = defaultdict(dict)
    new_people = {}
    for paper in papers:
        for a in paper["authors"]:
            names = [a["name"], a.get("rawName")] + authors.get(a["id"], {}).get("alternativeNames", [])
            pid = next((by_key[k] for k in map(name_key, names) if k in by_key), None)
            if pid is None:
                info = authors.get(a["id"])
                key = name_key(a["name"])
                if not info or not info["atNortheastern"] or not key or key in excluded:
                    continue
                # The same person can have several OpenAlex ids; merge them by name
                pid = f"faculty:{info['name']}" if key not in by_key else by_key[key]
                if key not in by_key:
                    by_key[key] = pid
                    new_people[pid] = {"name": info["name"], "orcid": info.get("orcid"), "openalex": a["id"]}
            person_papers[pid][paper["id"]] = paper

    def unique_count(found):
        return len({re.sub(r"[^a-z0-9]", "", p["title"].lower()) for p in found.values()})

    for pid, info in new_people.items():
        if unique_count(person_papers[pid]) < MIN_PAPERS_NEW_PERSON:
            continue
        people[pid] = {
            "id": pid, "name": info["name"], "position": None, "college": None, "location": None,
            "newHire": None, "email": None,
            "profileUrl": info["orcid"] or f"https://openalex.org/authors/{info['openalex']}",
            "themes": [], "topics": [], "sources": [], "addedFromResearch": True,
        }

    # Research evidence and publication-based links
    for pid, found in person_papers.items():
        if pid not in people or name_key(people[pid]["name"]) in excluded:
            continue
        person = people[pid]
        # Preprints and published versions of the same paper count once
        unique = {}
        for paper in sorted(found.values(), key=lambda p: -(p["year"] or 0)):
            unique.setdefault(re.sub(r"[^a-z0-9]", "", paper["title"].lower()), paper)
        found = sorted(unique.values(), key=lambda p: (-(p["year"] or 0), p["title"]))
        per_theme = Counter(t for p in found for t in p["themes"])
        person["paperCount"] = len(found)
        person["papers"] = [{k: p[k] for k in ("title", "year", "url", "themes")} for p in found[:PAPERS_SHOWN]]
        for theme, n in per_theme.items():
            if n < MIN_PAPERS_PER_THEME or theme not in theme_ids:
                continue
            link = links.setdefault((theme_ids[theme], pid),
                                    {"source": theme_ids[theme], "target": pid, "topics": [], "sources": []})
            link["paperCount"] = n
            if RESEARCH_SOURCE not in link["sources"]:
                link["sources"] = sorted(link["sources"] + [RESEARCH_SOURCE])

    for pid in [pid for pid, p in people.items() if name_key(p["name"]) in excluded]:
        del people[pid]
    links = {k: l for k, l in links.items() if l["target"] in people}

    # Recompute each person's themes and sources, and each theme's count, from the final links
    by_person = defaultdict(list)
    for l in links.values():
        by_person[l["target"]].append(l)
    theme_name = {t["id"]: t["name"] for t in themes}
    for pid, p in list(people.items()):
        own = by_person.get(pid, [])
        if not own:
            del people[pid]
            continue
        p["themes"] = sorted(theme_name[l["source"]] for l in own)
        p["sources"] = sorted({s for l in own for s in l["sources"]})
    for t in themes:
        t["facultyCount"] = sum(1 for l in links.values() if l["source"] == t["id"])

    # Sustainability courses each person teaches, from the curriculum map (build_curriculum.py runs first)
    curriculum_courses = OUT / "curriculum" / "courses.json"
    if curriculum_courses.exists():
        for course in json.loads(curriculum_courses.read_text()):
            for teacher in course["instructors"]:
                if teacher["id"] in people:
                    people[teacher["id"]].setdefault("courses", []).append({"code": course["code"], "title": course["title"]})

    OUT.mkdir(parents=True, exist_ok=True)
    ordered_people = sorted(people.values(), key=lambda p: p["name"])
    ordered_links = sorted(links.values(), key=lambda l: (l["source"], l["target"]))
    for name, data in [("nodes_keywords", themes), ("faculty_nodes", ordered_people), ("links", ordered_links)]:
        (OUT / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    updated = (OPENALEX / "last_updated.txt").read_text().strip() if (OPENALEX / "last_updated.txt").exists() \
        else datetime.date.today().isoformat()
    (OUT / "meta.json").write_text(json.dumps({
        "researchUpdated": updated,
        "people": len(ordered_people),
        "links": len(ordered_links),
        "papers": len(papers),
    }))

    REVIEW.mkdir(parents=True, exist_ok=True)
    added = [p for p in ordered_people if p.get("addedFromResearch")]
    with open(REVIEW / "new_people.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name", "sustainability_papers", "themes", "profile"])
        for p in added:
            w.writerow([p["name"], p["paperCount"], "; ".join(p["themes"]), p["profileUrl"]])

    with_research = sum(1 for p in ordered_people if p.get("paperCount"))
    print(f"{len(ordered_people)} people ({len(added)} added from research, {with_research} with papers), "
          f"{len(ordered_links)} links -> {OUT}")


if __name__ == "__main__":
    main()
