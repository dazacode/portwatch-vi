/** Our score for one project: the total, and the parts it is made of when they are sent. */
export type Ours = {
  rating: number
  parts: { key: string; label: string; claimed: number; counted: number }[]
}
