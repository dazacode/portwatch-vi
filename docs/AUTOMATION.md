# Automation

What upstream did by hand, and what runs it here. Limits were checked on 24 November 2026.

| Job                                            | Upstream                              | Here                                            | Runs on                |
| ---------------------------------------------- | ------------------------------------- | ----------------------------------------------- | ---------------------- |
| Who is live                                    | Not tracked                           | Platform APIs, refreshed by visits              | Vercel ISR, every 60 s |
| New streams                                    | Not tracked                           | Category and keyword search with a title filter | Vercel ISR             |
| Which channels to follow                       | Not tracked                           | Links in project READMEs, added and dropped     | GitHub Actions, 3 h    |
| Repo stats, new projects, takedowns, headlines | Scout                                 | Upstream's scout, read live                     | Vercel ISR, 60 s       |
| News, commits and pull requests                | Not tracked                           | Harvester over feeds, GitHub and communities    | GitHub Actions, 30 min |
| Claims                                         | Claude editor on a PC, plus the owner | Upstream's, read live, plus `overrides.json`    | Vercel ISR, 60 s       |
| Score and ranking                              | The claim                             | Our own, from claims and evidence               | When a page is built   |
| Publishing data                                | Full deploy each run                  | Read from the repo at runtime, no deploy        | Vercel ISR, 5 min      |
| Articles                                       | Claude and the owner                  | Off; set `NEWS_DESK=1` to write them            | GitHub Actions         |
| Pinned message, dashboard, board               | Owner                                 | Removed                                         |                        |

Our own scout is off, because upstream's does the same work. If upstream stops, set the repository
variable `OWN_SCOUT` to 1, disable `upstream-sync.yml` and set `UPSTREAM_DATA=off` on Vercel. With
`ANTHROPIC_API_KEY` it reviews at most 12 projects a run, and a milestone only rises if the model quotes
text that is really in the repo.

Two things still need a person: our own findings (`data/overrides.json`), and removing a
channel that turns out to be a problem (delete it from `channels.json`; if a README links it, remove
the project too, or it comes back).

## News and activity harvesting

`harvest.yml` runs every 30 minutes and has two jobs in one script:

- **News.** Google News and Bing News for ten GTA VI/port queries, then the full feeds of fourteen PC
  and gaming outlets, Hacker News, Reddit, Bluesky, Mastodon, Lemmy and 4chan /g/. Only a story with
  GTA VI **and** port work in its text survives. Social posts need a stronger signal than an outlet
  does, or every "I built a PC for this" gets in. Stories are deduplicated by title and URL, kept 21
  days, capped at 400 and filed under Takedown, Legal, Security, Official, Leak, Port or Community.
- **Activity.** Every board project's last 25 commits and 30 pull requests from the public GitHub
  API, GitHub's pull-request search across all of GitHub, and a repository search that lists new
  public projects in `activity.json` without promoting them onto the board. The board still needs
  the scout's review to score something.

Both write only when something changed, so quiet runs make no commit. The site reads the two data
files from the repo at runtime, so a harvest commit reaches it inside the ISR window without a
deploy. No keys beyond `GITHUB_TOKEN` are required; Reddit's own keys are optional.

Limits: 30 search calls a minute, 1,000 REST calls an hour for the Actions token. A run uses about
90, well inside both. Outlet and RSS feeds are read directly and only when they answer; a blocked
source is logged in the run summary and its stories simply expire.

## The summary, written by a free AI model

`scripts/digest.mjs` runs after each harvest. It reads what the site already publishes and writes
`data/digest.json`: a summary of what matters now, a topic and an importance for each story, a line in
plain words where it adds something, a line for each busy project, and the breakdowns that open the
news show. Pages only read that file. No visitor ever causes a call to a model.

- **Providers.** [Pollinations' Free API Classic](https://pollinations.ai/privacy) first, which needs no
  account and gives one reply of at most 1,500 tokens every 45 seconds. Then named free models on
  [Kilo Gateway](https://kilo.ai/docs/gateway/models-and-providers), 200 requests an hour without a key.
  Kilo's providers may log and train on what they are sent, and its
  [terms](https://kilo.ai/terms) ask for users of 18 and over. `kilo-auto/free` is not used: it says it is not for production and can route to
  NVIDIA's trial-only endpoints. Nothing is used that borrows another company's web chat.
  `FREE_AI_BASE_URL` and `FREE_AI_MODEL` put another keyless endpoint first; `FREE_AI=off` turns it off.
- **Cost of a run.** At most 6 requests and 4.5 minutes, usually 1 to 3. Each item is cached by a hash of its
  text. The summary is rewritten at most every hour, breakdowns every 2, project lines every 3.
- **Without a model** stories are sorted by rules, the summary shows the top headline of each topic as
  written, and lines already written stay until they expire. Older than 36 hours, the summary is hidden.
  Breakdowns go after 24 hours, or when their newest source is over 72 hours old.
- **What it can't do.** Scraped text is sent as data between random markers, without handles or links.
  From an answer only text, a topic and an importance are taken. A line is dropped if it has an id that
  wasn't sent, a link, a lure word, a way to the game's files, a name or number that isn't in its
  source, or no word of who says it. Links are looked up from ids when the page is drawn. The script
  writes `data/digest.json` and nothing else. The rules are in `lib/digest-safety.mjs`.
- It can still be wrong, so every place that shows it says an AI model wrote it. To remove a line, set its
  `summary` or `text` to `null` in `data/digest.json`; to remove a point or breakdown, delete it. To turn it
  all off, set the repository variable `FREE_AI` to `off` and make the file `{}`.

## Live status without a cron job

Vercel's Hobby plan runs cron jobs at most [once a day](https://vercel.com/docs/cron-jobs/usage-and-pricing),
and Pro once a minute. GitHub Actions schedules start late. So nothing is scheduled: `/api/live` is
a static route that regenerates at most every 60 seconds when someone asks for it. One visitor or ten
thousand cause the same number of calls, there is no database, and with no visitors nothing runs.
Upstream's Supabase board was [taken down by traffic](https://github.com/4lwayz/portwatch-vi); this
avoids that shape entirely.

The cost: no history. "Peak viewers" or alerts when someone goes live need something that runs without
visitors. The smallest step there is Twitch EventSub and Kick `livestream.status.updated` webhooks
writing to Upstash Redis.

## Platforms

| Platform | Key      | How                                                          | Limit that matters                                                                                                                                                |
| -------- | -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twitch   | Free app | Get Streams by login (100 per call) and by category          | Not a concern at one check a minute                                                                                                                               |
| YouTube  | Free key | Channel RSS feed to `videos.list`; `search.list` to discover | [100 searches a day](https://developers.google.com/youtube/v3/determine_quota_cost), separate from the 10,000 units for the rest. Searched every 30 min: 48 a day |
| Kick     | Free app | v2 livestreams by category, channels by slug                 | [Spec](https://api.kick.com/swagger/doc.yaml)                                                                                                                     |
| Rumble   | None     | Public channel page                                          | No public API, and no title search. Pages are allowed by its robots.txt, `/api/` isn't. No embeds: the URL id isn't the embed id                                  |

## Commits and milestones

The site asks GitHub for every project's last commit itself, from the public Atom feed of each
repository's default branch. Atom needs no key and no API quota, and a push shows up in seconds.
`/api/pulse` is regenerated at most every ten seconds however many people are watching, and the
front-page list polls it every 15 seconds. That is the whole realtime path: no cron and no branch
in between.

`pulse.yml` still writes the same commit list to the `pulse` branch as a fallback, in case GitHub
blocks Atom reads. It runs every five minutes. If `GITHUB_TOKEN` is set on Vercel, the API falls
back to one GraphQL request instead of the branch. GitHub's robots.txt disallows the `.atom` paths;
browsers and feed readers have always fetched them anyway.

`scripts/milestones.mjs` runs after each sync and compares claims with the last run. Its history was
rebuilt from git, with scores from before 24 November converted to the current scale.

## Following upstream

The list of projects and their claims come from [4lwayz/portwatch-vi](https://github.com/4lwayz/portwatch-vi).
The score and the ranking are ours. Three pieces keep the two apart:

- **Read live.** `lib/upstream.ts` asks their commit feed for the newest commit of `data/tracker.json`
  and reads the file at that commit, which skips the five-minute cache of a branch. Checked at most
  every 60 seconds, and pages are rebuilt every 60, so a change shows within about two minutes of
  visits. If it can't be read, or isn't shaped as the pages expect, the copy in the repo is used.
- **A copy.** `upstream-sync.yml` writes their file to `data/tracker.json`, byte for byte, and records
  milestones. It takes no other file, so it can't conflict or overwrite our work. If their scoring model
  changes, the run fails after saving the data: read `assets/js/scoring.js` of theirs and copy it to
  `lib/scoring.mjs`. Never edit `data/tracker.json`: the next sync replaces it.
- **Our findings.** `data/overrides.json`. A patch has `from` (upstream's values when it was written),
  `to` (ours) and, optionally, the `changes` that announce it. It applies only while every value in
  `from` is still upstream's. Once they change one, the whole patch lapses and the run warns. `added`
  holds projects upstream doesn't list, and gives way when it does; `scripts/added.mjs` refreshes their stars and notices a takedown every 3 h. `pick` places one project first under
  "With private", marked with its reason and without touching its score. Delete it to go by score again.

Milestones compare with `data/scores.json`, the scores of the last run. Comparing with the last commit
missed every change that a sync had already committed.

## Our score

`lib/rating.mjs`. Each stage counts half with no evidence and all of it at 70% sure, in a straight line.
Story, rendering, performance and stability count half, since no report can confirm them yet, which caps
a score at 75. What was never measured earns nothing and says so. `CLAIM_SHARE` is the half.

## Breaking, without a model

The front page's breaking wire is a small rule engine (`lib/wire.ts`) over the same realtime commit
feed and the harvested pull requests. It raises, in order of severity:

- a **burst**: three or more commits from one project inside twenty minutes (cuts straight in);
- a **signal**: a recent commit message mentions a milestone word such as menu, playable, world,
  boot, frame rate, saving or a crash;
- a **return**: a project's first commit after at least twelve hours of silence;
- an opened or merged **pull request**.

An item keeps its id for fifteen minutes, so the same event cannot cut in twice. There is no
writing and no review: the slide quotes the commit subject and links to it. The feed behind it is
the Atom one from the section above, and `/api/broadcast` is rebuilt every fifteen seconds.

Scoring milestones still come from the scout every three hours and can lag. The wire is what
happened just now, and the two are labelled differently ("Milestone" versus "Breaking").

## Verification

`lib/verification.mjs` holds the weights and the arithmetic. Two sources feed `data/evidence.json`:

- `scripts/evidence.mjs` reads projects' issues after each scout run. Cheap checks first (independent
  author, account age, graphics card, commit), then either text rules or, with `ANTHROPIC_API_KEY`,
  Claude, up to 25 reports a run. A reading is dropped unless its quote is in the report, the commit
  is in the repo, and it isn't a copy. Text rules only record successes: they misread failures. People
  are stored as a short hash, to count each once.
- Live challenges. `/verify` issues a code and three in-game actions per project, every ten minutes,
  derived from `CHALLENGE_SECRET`, so nothing is stored. Submissions arrive as issues. **To approve
  one: watch the recording, check the code, the actions and the terminal, then add the `verified`
  label.** `challenge.yml` checks that the code was issued to that project and records it. Only the
  repository owner's label counts. One counts per project per day; two days verify a stage.

To remove bad evidence, delete it from `data/evidence.json` and edit or hide its source, or the next
run finds it again.

## Rate limits

Visitors can't cause any. Their browsers poll this site's cached snapshot, and video goes straight from
the platform to the browser, played by [react-player](https://github.com/cookpete/react-player) (MIT).
Kick isn't covered by it and uses Kick's own player.

Two open-source routes were left out on purpose. Keyless Twitch and Kick tools borrow the platforms'
private web credentials or fake a browser's TLS to get past Cloudflare; the free keys allow far more
than one check a minute. And pulling streams through our own server (Streamlink, yt-dlp, an HLS proxy)
would make this site pay for the bandwidth and be the one rebroadcasting leaked game footage.

youtubei.js is unofficial and its use may be against YouTube's terms. To use only the official API,
make `youtube()` in `lib/live/youtube.ts` return `youtubeOfficial(channels)`.

## What breaks first

Rumble is the fragile one. It may refuse Vercel's addresses, and its markup can change. Either way the
channel shows "not known", never a false "offline". Don't work around a block: ask the streamer for
their own Live Stream API URL instead.

## Filtering

A followed channel is shown when live. Anyone else needs a title with the game and port work in it.
Both are dropped if the title has a lure (download, free, key, giveaway, invite links). See
`lib/live/filter.ts` and its tests.

## Music, later

The show already has a score: `lib/sound.ts` plays an original piece with Tone.js, with no audio files,
once someone turns sound on, and stops while a stream is open. For recorded music instead, react-player
also plays Spotify, YouTube playlists, HLS and plain audio files. Put it in `app/layout.tsx`, outside `<main>`, so it keeps playing between pages, and pause
it when a stream starts. Use music you have the rights to, or a platform's own embed: Twitch and
YouTube licences don't carry over to a website.
