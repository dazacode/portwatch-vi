"use client"

import { Check, Copy, Download, Image as ImageIcon, MessageSquareText, Share2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useCallback, useEffect, useState } from "react"
import {
  BlueskyIcon,
  BlueskyShareButton,
  canNativeShare,
  EmailIcon,
  EmailShareButton,
  FacebookIcon,
  FacebookShareButton,
  RedditIcon,
  RedditShareButton,
  shareNative,
  TelegramIcon,
  TelegramShareButton,
  ThreadsIcon,
  ThreadsShareButton,
  WhatsappIcon,
  WhatsappShareButton,
  XIcon,
  XShareButton,
} from "react-share"
import { OPEN_SHARE, trackShare } from "@/components/share/bus"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { SITE } from "@/lib/site"
import { cn } from "@/lib/utils"

const TITLE = `${SITE.name}: GTA VI on PC, live`
const TEXT = "Is GTA 6 on PC yet? Watch the fan projects race to run it, live:"
/** Made from the board, so it is never out of date. */
const IMAGE = "/top-20/image"

/** The board as a file, for share sheets that take one. Fetched when the sheet opens: a share has to start in the click. */
function useImage(open: boolean) {
  const [file, setFile] = useState<File | null>(null)
  useEffect(() => {
    if (!open || file) return
    let gone = false
    fetch(IMAGE)
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (gone || !blob) return
        const next = new File([blob], "viportlive-top-20.png", { type: "image/png" })
        if (canNativeShare({ files: [next] })) setFile(next)
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [open, file])
  return file
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      trackShare(`copy-${what}`)
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000)
    } catch {
      // No clipboard (an old browser, or not allowed): the link is on screen to copy by hand.
    }
  }, [])
  return { copied, copy }
}

const tile =
  "group flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-xs outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring"
const icon = "size-12 rounded-full transition-transform group-hover:scale-105 group-active:scale-95"

/** Every way to pass the site on, in one sheet: the phone's own sheet, the apps people use, a code to scan, the link. */
export function ShareSheet({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  const [native, setNative] = useState(false)
  const file = useImage(open)
  const { copied, copy } = useCopy()

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_SHARE, show)
    setNative(canNativeShare({ url }))
    return () => window.removeEventListener(OPEN_SHARE, show)
  }, [url])

  const message = `${TEXT} ${url}`
  const sent = (method: string) => () => trackShare(method)

  const NETWORKS = [
    {
      name: "WhatsApp",
      node: (
        <WhatsappShareButton
          url={url}
          message={TEXT}
          separator=" "
          className={tile}
          onClick={sent("whatsapp")}
        >
          <WhatsappIcon className={icon} />
          WhatsApp
        </WhatsappShareButton>
      ),
    },
    {
      name: "X",
      node: (
        <XShareButton
          url={url}
          text={TEXT}
          hashtags={["GTA6"]}
          className={tile}
          onClick={sent("x")}
        >
          <XIcon className={icon} />X
        </XShareButton>
      ),
    },
    {
      name: "Reddit",
      node: (
        <RedditShareButton url={url} shareTitle={TITLE} className={tile} onClick={sent("reddit")}>
          <RedditIcon className={icon} />
          Reddit
        </RedditShareButton>
      ),
    },
    {
      name: "Telegram",
      node: (
        <TelegramShareButton url={url} text={TEXT} className={tile} onClick={sent("telegram")}>
          <TelegramIcon className={icon} />
          Telegram
        </TelegramShareButton>
      ),
    },
    {
      name: "Bluesky",
      node: (
        <BlueskyShareButton
          url={url}
          text={TEXT}
          separator=" "
          className={tile}
          onClick={sent("bluesky")}
        >
          <BlueskyIcon className={icon} />
          Bluesky
        </BlueskyShareButton>
      ),
    },
    {
      name: "Threads",
      node: (
        <ThreadsShareButton url={url} text={TEXT} className={tile} onClick={sent("threads")}>
          <ThreadsIcon className={icon} />
          Threads
        </ThreadsShareButton>
      ),
    },
    {
      name: "Facebook",
      node: (
        <FacebookShareButton url={url} hashtag="#GTA6" className={tile} onClick={sent("facebook")}>
          <FacebookIcon className={icon} />
          Facebook
        </FacebookShareButton>
      ),
    },
    {
      name: "Email",
      node: (
        <EmailShareButton
          url={url}
          subject={TITLE}
          body={TEXT}
          separator=" "
          className={tile}
          beforeOnClick={sent("email")}
        >
          <EmailIcon className={icon} />
          Email
        </EmailShareButton>
      ),
    },
  ]

  async function shareSheet(withImage: boolean) {
    try {
      await shareNative({
        title: TITLE,
        text: TEXT,
        url,
        ...(withImage && file ? { files: [file] } : {}),
      })
      trackShare(withImage ? "native-image" : "native")
    } catch {
      // A closed share sheet needs no message.
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="bottom"
        className="max-h-[92svh] overflow-y-auto rounded-t-4xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto grid w-full max-w-xl grid-cols-[minmax(0,1fr)] gap-5 px-5 pt-2">
          <SheetHeader className="p-0 pt-3 pr-10">
            <SheetTitle className="text-xl font-extrabold tracking-tight">
              Share {SITE.name}
            </SheetTitle>
            <SheetDescription>
              Know someone waiting for GTA VI on PC? Send them the race, live.
            </SheetDescription>
          </SheetHeader>

          {native && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" onClick={() => shareSheet(false)}>
                <Share2 /> Share…
              </Button>
              {file && (
                <Button size="lg" variant="outline" onClick={() => shareSheet(true)}>
                  <ImageIcon /> Share with the top 20 image
                </Button>
              )}
            </div>
          )}

          <ul aria-label="Share on" className="grid grid-cols-4 gap-1 sm:grid-cols-8">
            {NETWORKS.map((n) => (
              <li key={n.name} className="flex justify-center">
                {n.node}
              </li>
            ))}
          </ul>

          <div className="grid gap-2">
            <div className="flex items-center gap-2 rounded-full border bg-(--pane) py-1 pr-1 pl-4">
              <span className="min-w-0 flex-1 truncate font-medium select-all">
                {url.replace(/^https?:\/\//, "")}
              </span>
              <Button onClick={() => copy("link", url)} aria-live="polite">
                {copied === "link" ? <Check /> : <Copy />}
                {copied === "link" ? "Copied" : "Copy link"}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="h-auto min-h-9 justify-self-start py-2 text-left whitespace-normal"
              onClick={() => copy("message", message)}
            >
              {copied === "message" ? <Check /> : <MessageSquareText />}
              {copied === "message"
                ? "Copied, paste it anywhere"
                : "Copy a ready-made message for Discord or a group chat"}
            </Button>
          </div>

          <div className="flex items-center gap-4 rounded-3xl border bg-(--pane) p-3">
            <div className="shrink-0 rounded-2xl bg-white p-2">
              <QRCodeSVG value={url} size={96} marginSize={0} title={`QR code for ${url}`} />
            </div>
            <div className="grid min-w-0 gap-2">
              <p className="text-sm">
                <span className="font-semibold">Scan to open it on a phone,</span>{" "}
                <span className="text-muted-foreground">or post the top 20 as a picture.</span>
              </p>
              <a
                href={IMAGE}
                download="viportlive-top-20.png"
                onClick={sent("download-image")}
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                )}
              >
                <Download className="size-4" /> Download the image
              </a>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
