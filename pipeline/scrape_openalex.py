"""Collect recent sustainability research by Northeastern authors from OpenAlex (openalex.org).

OpenAlex is a free, public index of research papers. This script downloads recent Northeastern
papers that are likely about sustainability, sorts them into themes (see themes.py), and saves:

  data/openalex/papers.json   sustainability papers with their Northeastern authors and themes
  data/openalex/authors.json  current affiliation for frequent authors, used to add new people

Usage: python pipeline/scrape_openalex.py [--years 5]
Set OPENALEX_API_KEY to use a free OpenAlex API key (raises the daily limit). Without one the
script still fits in the free daily allowance.
"""

import argparse
import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

from themes import RELEVANCE_SDGS, classify

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "openalex"
API = "https://api.openalex.org"
NORTHEASTERN = "I12912129"
CONTACT = "sustainability-network@northeastern.edu"

# Words for OpenAlex's own search (it has no wildcards). Results are checked against themes.py afterwards.
SEARCH_TERMS = ["sustainability", "sustainable", "climate change", "global warming", "greenhouse gas",
                "carbon emissions", "decarbonization", "renewable energy", "net zero", "biodiversity",
                "environmental justice", "climate justice", "circular economy", "life cycle assessment",
                "climate adaptation", "climate resilience", "clean energy", "carbon capture", "microplastics",
                "food security"]


def get(path, params):
    params = dict(params, mailto=CONTACT)
    if os.environ.get("OPENALEX_API_KEY"):
        params["api_key"] = os.environ["OPENALEX_API_KEY"]
    url = f"{API}/{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=60) as res:
                return json.load(res)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                wait = int(e.headers.get("Retry-After") or 2 ** attempt * 5)
                if e.code == 429 and wait > 600:
                    sys.exit("OpenAlex daily limit reached. Try again tomorrow or set OPENALEX_API_KEY.")
                print(f"  OpenAlex returned {e.code}, retrying in {wait}s")
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            print(f"  Network error ({getattr(e, 'reason', e)}), retrying")
            time.sleep(2 ** attempt * 5)
    sys.exit(f"OpenAlex request kept failing: {url}")


def works(filter_str):
    """Yield every work matching the filter, 200 per request."""
    cursor = "*"
    fields = "id,doi,title,publication_year,authorships,sustainable_development_goals,abstract_inverted_index"
    while cursor:
        page = get("works", {"filter": filter_str, "per_page": 200, "cursor": cursor, "select": fields})
        yield from page["results"]
        cursor = page["meta"].get("next_cursor")


def abstract_text(inverted):
    if not inverted:
        return ""
    words = {}
    for word, positions in inverted.items():
        for p in positions:
            words[p] = word
    return " ".join(words[i] for i in sorted(words))


def northeastern_authors(work):
    authors = []
    for a in work.get("authorships") or []:
        if any((i.get("id") or "").endswith(NORTHEASTERN) for i in a.get("institutions") or []):
            author = a.get("author") or {}
            if author.get("id"):
                authors.append({"id": author["id"].rsplit("/", 1)[-1], "name": author.get("display_name"),
                                "rawName": a.get("raw_author_name"), "orcid": author.get("orcid")})
    return authors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", type=int, default=5, help="How many years of papers to collect")
    args = parser.parse_args()

    this_year = datetime.date.today().year
    base = f"authorships.institutions.id:{NORTHEASTERN},publication_year:{this_year - args.years + 1}-{this_year}"
    sdgs = "|".join(f"https://metadata.un.org/sdg/{n}" for n in sorted(RELEVANCE_SDGS))
    terms = " OR ".join(f'"{t}"' if " " in t else t for t in SEARCH_TERMS)

    # Two searches: papers OpenAlex tags with environmental SDGs, and papers that use sustainability terms
    queries = [f"{base},sustainable_development_goals.id:{sdgs}", f"{base},title_and_abstract.search:({terms})"]

    papers, seen = [], set()
    for q in queries:
        print(f"Searching OpenAlex: {q[:110]}...")
        for n, w in enumerate(works(q), 1):
            if w["id"] in seen:
                continue
            seen.add(w["id"])
            title = w.get("title") or ""
            themes = classify(title + ". " + abstract_text(w.get("abstract_inverted_index")),
                              w.get("sustainable_development_goals") or [])
            authors = northeastern_authors(w)
            if themes and authors:
                papers.append({
                    "id": w["id"].rsplit("/", 1)[-1],
                    "title": title,
                    "year": w.get("publication_year"),
                    "url": w.get("doi") or w["id"],
                    "themes": themes,
                    "authors": authors,
                })
            if n % 1000 == 0:
                print(f"  {n} papers checked")
    print(f"{len(seen)} papers checked, {len(papers)} are sustainability research by Northeastern authors")

    # Look up where every author is now: people who have left aren't added, and people on the map who seem to
    # have moved elsewhere are flagged for review
    counts = Counter(a["id"] for p in papers for a in p["authors"])
    everyone = sorted(counts)
    authors = {}
    for i in range(0, len(everyone), 50):
        batch = everyone[i:i + 50]
        res = get("authors", {"filter": "openalex:" + "|".join(batch), "per_page": 50,
                              "select": "id,display_name,display_name_alternatives,orcid,last_known_institutions"})
        for a in res["results"]:
            authors[a["id"].rsplit("/", 1)[-1]] = {
                "name": a["display_name"],
                "alternativeNames": a.get("display_name_alternatives") or [],
                "orcid": a.get("orcid"),
                "atNortheastern": any((i.get("id") or "").endswith(NORTHEASTERN)
                                      for i in a.get("last_known_institutions") or []),
                "currentInstitutions": [i.get("display_name") for i in a.get("last_known_institutions") or []
                                        if i.get("display_name")],
                "papers": counts[a["id"].rsplit("/", 1)[-1]],
            }
    print(f"Checked current affiliation for {len(authors)} authors")

    OUT.mkdir(parents=True, exist_ok=True)
    papers.sort(key=lambda p: (-(p["year"] or 0), p["title"]))
    new_papers = json.dumps(papers, indent=1, ensure_ascii=False)
    new_authors = json.dumps(authors, indent=1, ensure_ascii=False, sort_keys=True)
    old = [(OUT / f).read_text() if (OUT / f).exists() else None for f in ("papers.json", "authors.json")]
    if old == [new_papers, new_authors]:
        # Keep the old date so daily runs with nothing new don't create a commit
        print("No new research since the last update")
        return
    (OUT / "papers.json").write_text(new_papers)
    (OUT / "authors.json").write_text(new_authors)
    (OUT / "last_updated.txt").write_text(datetime.date.today().isoformat() + "\n")
    print(f"Saved to {OUT}")


if __name__ == "__main__":
    main()
