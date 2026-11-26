"use client"

/** A GET form that applies itself when a choice changes. The button is for browsers without script. */
export function AutoForm({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <form action="/news" className={className} onChange={(e) => e.currentTarget.requestSubmit()}>
      {children}
      <noscript>
        <button type="submit" className="h-9 rounded-full border px-4 hover:bg-muted">
          Apply
        </button>
      </noscript>
    </form>
  )
}
