# Automation

What upstream did by hand, and what runs it here. Limits were checked on 24 November 2026.

| Job                                            | Upstream                              | Here                                            | Runs on                                  |
| ---------------------------------------------- | ------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Who is live                                    | Not tracked                           | Platform APIs, refreshed by visits              | Vercel ISR, every 60 s                   |
| New streams                                    | Not tracked                           | Category and keyword search with a title filter | Vercel ISR                               |
| Which channels to follow                       | Not tracked                           | Links in project READMEs, added and dropped     | GitHub Actions, 3 h                      |
| Repo stats, new projects, takedowns, headlines | Scout                                 | Same scout                                      | GitHub Actions, 3 h                      |
| Scores                                         | Claude editor on a PC, plus the owner | Claude review inside the scout                  | GitHub Actions, with `ANTHROPIC_API_KEY` |
| Publishing data                                | Full deploy each run                  | Read from the repo at runtime, no deploy        | Vercel ISR, 5 min                        |
| Articles                                       | Claude and the owner                  | Off; set `NEWS_DESK=1` to write them            | GitHub Actions                           |
| Pinned message, dashboard, board               | Owner                                 | Removed                                         |                                          |

Without `ANTHROPIC_API_KEY`, everything else still runs, but scores stay as they are and new projects
wait in `candidates`. The review is bounded: a milestone only rises if the model quotes text that is
really in the repo, and each run reviews at most 12 projects.

Two things still need a person: scores for private builds, which have no repo to read, and removing a
channel that turns out to be a problem (delete it from `channels.json`; if a README links it, remove
the project too, or it comes back).

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

`pulse.yml` asks GitHub for every project's last commit in one GraphQL request, with the token Actions
gets for free, and replaces the single commit on the `pulse` branch. GitHub runs it about every 10
minutes, often late. Set `GITHUB_TOKEN` on Vercel and the site asks for itself each minute instead.
GitHub's commit feeds (`.atom`) need no key but its robots.txt disallows them.

`scripts/milestones.mjs` runs after the scout and compares scores with the last commit. Its history was
rebuilt from git, with scores from before 24 November converted to the current scale.

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
