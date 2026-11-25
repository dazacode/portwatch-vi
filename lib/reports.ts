/** Why a project stands where it does in the official ranking, in a few words. */
export const reportsText = (people: number) =>
  people === 0
    ? "Not tested by others"
    : `Reports from ${people === 1 ? "1 person" : `${people} people`}`
