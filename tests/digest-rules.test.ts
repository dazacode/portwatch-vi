import { describe, expect, it } from "vitest"
import { ungrounded } from "@/lib/digest-safety.mjs"

describe("order and cause", () => {
  const source = "Hardware Busters Project Leonida goes dark as fake builds start spreading"

  it("drops an order the source does not give", () => {
    const text = "Hardware Busters says fake builds spread before Project Leonida went dark."
    expect(ungrounded(text, source)).toBe("a claim not in the source")
  })

  it("drops a cause the source does not give", () => {
    const text = "Hardware Busters says Project Leonida went dark because of fake builds."
    expect(ungrounded(text, source)).toBe("a claim not in the source")
  })

  it("keeps what the source says", () => {
    const text = "Hardware Busters says Project Leonida went dark as fake builds start spreading."
    expect(ungrounded(text, source)).toBeNull()
  })
})
