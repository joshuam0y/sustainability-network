# Handoff guide

For whoever looks after these sites next. No coding is needed for anything in the first two sections.

## What there is

| Site | Address | What it shows |
|---|---|---|
| Faculty map | https://joshuam0y.github.io/sustainability-network/ | Who works on sustainability, by theme |
| Curriculum map | https://joshuam0y.github.io/sustainability-network/curriculum/ | Sustainability in each program, every sustainability course, charts, STARS numbers |
| Review page | https://joshuam0y.github.io/sustainability-network/review/ | For the sustainability team: confirm or correct which courses count |

Both update themselves: research every morning, the course catalog on the 1st of each month.

## Regular jobs

**Review suggested courses (a few times a year, about 30 minutes).**
Open the review page, enter your name, and go through "Suggested by the model, not yet checked". Then press
Download, open the GitHub upload link on the page, and drop the file in. The sites update within minutes.

**Check the review lists (after each monthly catalog update).** In `data/review/` on GitHub:
- `new_people.csv`: people added to the faculty map from their published research. Remove anyone who shouldn't be
  there by adding their name to `data/exclude.csv`.
- `found_emails.csv`: email addresses found each day on people's own public profile pages (or their public ORCID
  record), with the page each came from. Common names can match the wrong person: if an address is wrong, clear
  its email and type `wrong` as the source. The map stops showing it and that person isn't looked up again.
- `possible_departures.csv`: people whose research profile now lists another institution. OpenAlex sometimes mixes
  up people with the same name, so check before removing anyone.
- `program_checks.csv`: programs whose results look unusual. Open the catalog link and compare.
- `model_labeled_courses.csv`: the same courses as the review page, as a spreadsheet.

**Change a setting.** `pipeline/settings.py` has switches for showing emails and the "joined in the last 3 years"
flag, and the email address "Report a problem" links send to. Edit it on GitHub with the pencil icon.

## When something breaks

GitHub emails the repository owner when an update fails. Open the **Actions** tab, click the failed run, and look
for the red step:

| Failed step | Usual cause | What to do |
|---|---|---|
| Check the catalog reader | The catalog's page layout changed | A developer updates `pipeline/curriculum/scrape_catalog.py`. The sites keep showing the last good data meanwhile |
| Read the course catalog | The catalog site was down, or its layout changed a lot | Run it again the next day (Actions, Run workflow). If it keeps failing, same as above |
| Collect new research from OpenAlex | OpenAlex's free daily limit or an outage | Usually fixes itself the next day. For a higher limit, get a free key at openalex.org and add it as the repository secret `OPENALEX_API_KEY` |
| Build the site | A mistake in an edited file | Undo the last edit (the commit history on GitHub shows it) |

GitHub pauses scheduled updates if a repository has no activity for 60 days. If the "last updated" dates stop
changing, open Actions and re-enable the workflow.

## Moving the sites to a Northeastern account

They currently live under a personal GitHub account (joshuam0y). To move them to a Northeastern organization:

1. Someone with rights to create repositories in the Northeastern GitHub organization joins it (for example
   github.com/northeastern or the sustainability office's own organization).
2. In this repository: **Settings → General → Danger Zone → Transfer**, and choose that organization.
3. In the new location: **Settings → Pages**, and set Source to **GitHub Actions**.
4. Update `REPOSITORY` in `pipeline/settings.py`, the `REPO` address in `site/src/review/ReviewApp.jsx`, and the links in
   `README.md` and this file. The site address becomes `https://<organization>.github.io/sustainability-network/`, so
   any embed codes on other websites need the new address too.

The private repository with Charlie's original files (`sustainability-faculty-network`) should move the same way.
It holds Registrar and HR exports and must stay private.

## Decisions still open

- **Public contact details.** Faculty work emails and the new-hire flag (from the HR roster) are public on the
  faculty map. Confirm the team is comfortable with this, or switch them off in `pipeline/settings.py`.
- **Report-a-problem address.** `CONTACT_EMAIL` in `pipeline/settings.py` is empty, so problems go to GitHub issues,
  which most staff can't use. Set it to a team inbox.
- **Completion rates by major.** University Decision Support can provide the share of each major's graduates who took
  a sustainability course. Save it as `data/base/completions.csv` with the columns
  `program,level,graduates,completed_sustainability,year` (program names as in the catalog, like
  "Computer Engineering") and each program's page shows it automatically.
- **Theme descriptions.** The one-line descriptions of the 20 themes were written from the topic lists and should be
  checked by the team (they're listed at the bottom of the review page).

## Where the data comes from

| Data | Source | Refreshed |
|---|---|---|
| People and their themes | Charlie's Tableau faculty network (Faculty Insight, faculty web pages, research records, course listings, HR roster) | Frozen at the 2024 export |
| Recent papers | OpenAlex (openalex.org), a free public index of research | Daily |
| Courses and program requirements | The public academic catalog (catalog.northeastern.edu) | Monthly |
| Which courses count | The sustainability team's reviewed list for 2023–24, plus the review page | Whenever someone reviews |
| Enrollment trends | Registrar course records, 2018–19 to 2022–23, as yearly totals only | Frozen |
