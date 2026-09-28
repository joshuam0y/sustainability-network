# Who works on sustainability at Northeastern?

An interactive map of Northeastern faculty, staff and researchers whose work connects to
sustainability, organized into 20 themes. It replaces the Tableau "Sustainability Faculty Network"
dashboard.

**See it:** https://joshuam0y.github.io/sustainability-network/

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
  title="Sustainability Faculty Network" width="100%" height="720" style="border:0" loading="lazy"></iframe>
```

## How it stays up to date

On the 1st of every month, GitHub automatically:

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

## For developers

```sh
python3 pipeline/scrape_openalex.py   # about a minute; no packages needed
python3 pipeline/build_data.py
cd site && npm install && npm run dev
```

OpenAlex's free allowance covers a full run several times a day. For more, get a free API key from
openalex.org and add it as a repository secret named `OPENALEX_API_KEY`.
