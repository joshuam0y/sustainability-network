# Who works on sustainability at Northeastern?

An interactive map of Northeastern faculty, staff and researchers whose work connects to
sustainability, organized into 20 themes. It replaces the Tableau "Sustainability Faculty Network"
dashboard.

**See it:** https://joshuam0y.github.io/sustainability-network/

**Also:** [How much sustainability is in each major?](https://joshuam0y.github.io/sustainability-network/curriculum/)
checks every program in the course catalog for sustainability courses, with charts and STARS numbers (see below).

**Looking after the sites?** Start with [HANDOFF.md](HANDOFF.md).

## Using the map

- **Themes** shows every theme as a circle; the bigger the circle, the more people. Click one to see
  who works on it and what other themes those people also work on.
- **Everyone** shows the whole network at once.
- **List** is a table you can download as a spreadsheet (CSV).
- Click any person for their role, college, email, research profile and recent papers.
- The filters on the left narrow everything down by college, role, campus and more.

## Putting the map on another website

Set up the view you want (for example, the Waste theme with only the College of Engineering), press
**Share or embed**, and copy the embed code into the other site. It looks like this:

```html
<iframe src="https://joshuam0y.github.io/sustainability-network/?theme=Waste&college=College+of+Engineering&embed=1"
  title="Sustainability Faculty Network" width="100%" height="560" style="border:0" loading="lazy"></iframe>
```

## How it stays up to date

Every morning, GitHub automatically:

1. collects recent Northeastern papers from [OpenAlex](https://openalex.org), a free public index of research,
2. keeps the ones about sustainability and sorts them into themes,
3. adds those papers to people already on the map, and adds Northeastern researchers with at least
   4 recent sustainability papers,
4. rebuilds and republishes the site.

To update right away: open the **Actions** tab, choose **Update and publish the map**, and press
**Run workflow**. It takes about two minutes.

People added from published research show up as hollow circles, and are listed in
`data/review/new_people.csv` after each update so someone can check them.

### Removing someone or fixing a mistake

- **Remove a person:** add their name to `data/exclude.csv` (you can edit it on GitHub with the pencil
  icon). The site republishes on its own a few minutes later.
- **A paper is in the wrong theme:** the phrases that decide themes are in `pipeline/themes.py`, in plain
  lists per theme.

## Where the data comes from

| Folder | What's in it |
|---|---|
| `data/base/` | The original network from the Tableau dashboard: people found through Faculty Insight, faculty web pages, research records and course listings, with their HR role, college and campus |
| `data/openalex/` | Sustainability papers by Northeastern authors from the last 5 years |
| `site/public/data/` | The combined data the site reads (built automatically, don't edit by hand) |

## The curriculum map

Four views: **Programs** (each major's sustainability report card), **Courses** (every sustainability course, with a
"counts toward this program" finder), **Overview** (charts by college and department, and trends since 2018, rebuilt
from Charlie's Tableau overview) and **STARS report** (numbers and draft text for the AASHE STARS Academics section).

The sustainability team confirms or corrects course labels on the [review page](https://joshuam0y.github.io/sustainability-network/review/).


`/curriculum/` shows, for every Northeastern program, which sustainability courses it **requires** and which it
lists as **options**, plus a searchable list of every sustainability course and who teaches it.

- **Courses and requirements** come from the public academic catalog (catalog.northeastern.edu), reread on the
  1st of each month by `pipeline/curriculum/scrape_catalog.py`.
- **Focused or inclusive:** STARS separates courses focused on sustainability from courses that include it. Until
  someone confirms a course on the review page, a course whose title is about sustainability counts as focused.
- **Which courses count as sustainability courses** comes from the sustainability team's reviewed list for the
  2023–24 catalog (`data/base/course_labels.csv`). Newer courses are sorted by a model trained on that list and
  shown as "suggested"; they're listed in `data/review/model_labeled_courses.csv` for someone to check. To confirm or
  reject one, add it to `course_labels.csv` with `yes` or `no`.
- A course named in a "choose from this list" group counts as an option. Open electives (any course a student
  likes) aren't counted.

## For developers

```sh
pip install -r pipeline/requirements.txt
python3 pipeline/curriculum/scrape_catalog.py   # about 2 minutes
python3 pipeline/curriculum/build_curriculum.py
python3 pipeline/scrape_openalex.py             # about a minute
python3 pipeline/build_data.py
cd site && npm install && npm run dev           # faculty map at /, curriculum map at /curriculum/
```

OpenAlex's free allowance covers a full run several times a day. For more, get a free API key from
openalex.org and add it as a repository secret named `OPENALEX_API_KEY`.
