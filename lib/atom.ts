/** The newest commit in a feed of commits. */
export const newestCommit = (atom: string) => atom.match(/Commit\/([0-9a-f]{40})\b/)?.[1] ?? null
