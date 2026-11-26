// Starts the repository's scheduled workflows, because GitHub doesn't run the schedules of this fork.
// A Cloudflare Worker with one cron trigger and no address of its own. See docs/AUTOMATION.md.

const API = "https://api.github.com/repos"
const MINUTE = 60_000

/**
 * Minutes between runs, and how far past the hour the first one is. The last four share a queue on GitHub
 * that only holds one waiting run, so they start apart. Harvest takes about six minutes.
 */
export const JOBS = [
  { workflow: "pulse.yml", every: 5, at: 0 },
  { workflow: "harvest.yml", every: 30, at: 0 },
  { workflow: "intel.yml", every: 15, at: 3 },
  { workflow: "intel-audit.yml", every: 360, at: 1 },
  { workflow: "upstream-sync.yml", every: 15, at: 10 },
  { workflow: "scout.yml", every: 180, at: 20 },
  { workflow: "editor.yml", every: 60, at: 35 },
]

/** What is due in the five minutes that start at this time. */
export function due(time) {
  const slot = Math.floor(time / (5 * MINUTE)) * 5
  return JOBS.filter((job) => slot % job.every === job.at)
}

async function github(env, path, init) {
  const res = await fetch(`${API}/${env.REPO}/actions/workflows/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GH_TOKEN}`,
      "User-Agent": "viportlive-timer",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`)
  return res
}

/** Starts a job, unless it has just run: GitHub's own schedule may wake up, or someone may have pressed it. */
async function start(env, job, now) {
  const res = await github(env, `${job.workflow}/runs?per_page=1`)
  const [last] = (await res.json()).workflow_runs ?? []
  if (last && now - Date.parse(last.created_at) < job.every * MINUTE * 0.6) return "ran already"
  await github(env, `${job.workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main" }),
  })
  return "started"
}

export async function run(env, time) {
  if (!env.GH_TOKEN) throw new Error("GH_TOKEN is not set")
  const jobs = due(time)
  const results = await Promise.allSettled(jobs.map((job) => start(env, job, time)))
  const failed = []
  results.forEach((result, i) => {
    const { workflow } = jobs[i]
    if (result.status === "fulfilled") console.log(`${workflow}: ${result.value}`)
    else failed.push(`${workflow}: ${result.reason.message}`)
  })
  // Marks the run as failed in Cloudflare's list.
  if (failed.length) throw new Error(failed.join("; "))
}

export default {
  scheduled: (event, env) => run(env, event.scheduledTime),
}
