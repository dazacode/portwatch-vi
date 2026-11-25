"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { useRef } from "react"

gsap.registerPlugin(useGSAP)

const STARS = [
  [0, 304, 1.2],
  [337, 241, 1.5],
  [527, 248, 1.9],
  [869, 226, 1.7],
  [1307, 80, 1.3],
  [1133, 230, 0.9],
  [1094, 154, 2.1],
  [1292, 41, 1.5],
  [1477, 227, 1.7],
  [924, 301, 2.1],
  [596, 111, 2],
  [532, 50, 1.2],
  [686, 97, 2.1],
  [892, 241, 2],
  [94, 90, 1.6],
  [814, 139, 1.1],
  [1454, 18, 1.3],
  [551, 219, 2.1],
  [824, 55, 1.4],
  [454, 120, 1.4],
  [532, 175, 1.7],
  [373, 299, 1.4],
  [1381, 210, 1.7],
  [826, 167, 1.8],
  [1503, 131, 1.8],
  [402, 194, 1.3],
  [529, 129, 1.9],
  [1404, 37, 1.9],
  [124, 134, 1],
  [125, 329, 1.1],
  [1012, 48, 1.4],
  [949, 45, 2.1],
  [1415, 294, 2],
  [1452, 251, 1.2],
  [17, 82, 0.9],
  [3, 204, 1.1],
  [1186, 161, 1.8],
  [381, 291, 1.1],
  [598, 295, 1],
  [783, 1, 2.1],
  [1019, 304, 0.8],
  [1440, 62, 2.2],
  [904, 224, 1.2],
  [356, 69, 1.6],
  [84, 254, 1.8],
  [1143, 164, 0.8],
]
const WINDOWS = [
  [62, 551],
  [-10, 571],
  [26, 571],
  [152, 480],
  [134, 500],
  [152, 540],
  [170, 540],
  [188, 540],
  [152, 560],
  [170, 560],
  [188, 560],
  [134, 580],
  [263, 556],
  [281, 556],
  [299, 556],
  [263, 576],
  [281, 576],
  [299, 576],
  [334, 543],
  [334, 563],
  [352, 563],
  [370, 583],
  [406, 431],
  [424, 431],
  [442, 431],
  [460, 431],
  [442, 451],
  [406, 471],
  [424, 471],
  [442, 471],
  [460, 471],
  [442, 491],
  [406, 511],
  [442, 511],
  [406, 551],
  [424, 551],
  [460, 551],
  [406, 571],
  [460, 571],
  [530, 548],
  [548, 548],
  [548, 568],
  [608, 495],
  [608, 515],
  [644, 515],
  [626, 535],
  [626, 555],
  [644, 555],
  [644, 575],
  [721, 466],
  [739, 466],
  [757, 506],
  [775, 506],
  [721, 526],
  [757, 526],
  [721, 546],
  [757, 546],
  [775, 546],
  [721, 566],
  [757, 566],
]
const GLINTS = [
  [880, 1200, 628],
  [910, 1170, 652],
  [870, 1190, 678],
  [930, 1140, 706],
  [960, 1120, 736],
  [985, 1090, 768],
]

/**
 * The bay at sunset: original art in the theme's colours. The sun rises with the score, the plane tows
 * the answer, and layers drift with the pointer. Still with reduced motion, idle when out of view.
 */
export function Scene({ level, banner }: { level: number; banner?: string }) {
  const root = useRef<SVGSVGElement>(null)
  const sun = useRef<SVGCircleElement>(null)
  const sunY = 250 - level * 2.6

  useGSAP(
    () => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      gsap.to(sun.current, { y: sunY, duration: still ? 0 : 1.6, ease: "power3.out" })
    },
    { dependencies: [sunY], scope: root }
  )

  useGSAP(
    (_, contextSafe) => {
      const media = gsap.matchMedia()
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const loops = gsap.timeline()
        const loop = (target: string, vars: gsap.TweenVars) =>
          loops.add(gsap.to(target, { repeat: -1, yoyo: true, ease: "sine.inOut", ...vars }), 0)

        loop("[data-palm='a']", { rotation: 1.6, svgOrigin: "1462 900", duration: 3.4 })
        loop("[data-palm='b']", { rotation: -2, svgOrigin: "1330 900", duration: 2.8 })
        loop("[data-palm='c']", { rotation: 1.8, svgOrigin: "90 920", duration: 3.8 })
        loop("[data-glint]", {
          scaleX: "random(0.45, 1.15)",
          x: "random(-24, 24)",
          transformOrigin: "50% 50%",
          duration: "random(1.2, 2.4)",
          stagger: 0.18,
        })
        loop("[data-star]", {
          opacity: 0.15,
          duration: "random(0.8, 2.6)",
          stagger: { each: 0.07, from: "random" },
        })
        loop("[data-window]", {
          opacity: 0.1,
          duration: 0.2,
          repeatDelay: 4,
          stagger: { each: 0.31, from: "random" },
        })
        loop("[data-cloud]", { x: 90, duration: "random(14, 24)" })
        loop("[data-bob]", { y: 5, duration: 1.3 })
        loops.fromTo(
          "[data-plane]",
          { x: 1700 },
          { x: -1000, duration: 30, ease: "none", repeat: -1, repeatDelay: 5 },
          2
        )
        loops.fromTo(
          "[data-boat]",
          { x: -220 },
          { x: 1800, duration: 38, ease: "none", repeat: -1, repeatDelay: 3 },
          0
        )
        loops.fromTo(
          "[data-birds]",
          { x: -200, y: 40 },
          { x: 1800, y: -60, duration: 24, ease: "none", repeat: -1, repeatDelay: 10 },
          6
        )

        const watcher = new IntersectionObserver(([entry]) =>
          entry.isIntersecting ? loops.play() : loops.pause()
        )
        if (root.current) watcher.observe(root.current)

        const layers = gsap.utils.toArray<SVGGElement>("[data-depth]").map((el) => ({
          depth: Number(el.dataset.depth),
          move: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3.out" }),
        }))
        const onMove = contextSafe?.((e: PointerEvent) => {
          const offset = e.clientX / window.innerWidth - 0.5
          for (const l of layers) l.move(-offset * l.depth)
        })
        if (onMove) window.addEventListener("pointermove", onMove)
        return () => {
          watcher.disconnect()
          if (onMove) window.removeEventListener("pointermove", onMove)
        }
      })
    },
    { scope: root }
  )

  return (
    <svg
      ref={root}
      aria-hidden="true"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      className="size-full"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-1)" />
          <stop offset=".6" stopColor="var(--sky-2)" />
          <stop offset="1" stopColor="var(--sky-3)" />
        </linearGradient>
        <linearGradient id="disc" x2="0" y2="1">
          <stop offset=".2" stopColor="var(--sun)" />
          <stop offset="1" stopColor="var(--sun-low)" />
        </linearGradient>
        <clipPath id="slats">
          <path d="M-100-400H1700V376H-100zM-100 390H1700V432H-100zM-100 450H1700V486H-100zM-100 508H1700V536H-100zM-100 562H1700V580H-100zM-100 592H1700V600H-100z" />
        </clipPath>
      </defs>
      <rect x="-60" width="1720" height="604" fill="url(#sky)" />
      <g className="opacity-0 dark:opacity-100">
        {STARS.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} data-star cx={x} cy={y} r={r} fill="white" opacity=".85" />
        ))}
      </g>
      <g fill="white" opacity=".16">
        <path data-cloud d="M190 190h230q8-34-36-38-10-38-60-30-38-30-74 8-52-4-60 60z" />
        <path data-cloud d="M1180 130h190q6-28-30-32-8-32-50-26-32-24-62 6-44-2-48 52z" />
      </g>
      <g data-depth="14">
        <g clipPath="url(#slats)">
          <circle ref={sun} cx="1035" cy="400" r="215" fill="url(#disc)" />
        </g>
      </g>
      <g data-birds fill="none" stroke="var(--shade)" strokeWidth="4" strokeLinecap="round">
        <path d="M0 250q12-14 24 0q12-14 24 0M60 280q10-12 20 0q10-12 20 0M84 232q9-10 18 0q9-10 18 0" />
      </g>
      <g data-depth="22">
        <path
          fill="var(--shade)"
          opacity=".28"
          d="M0 602v-88h41v88zM43 602v-87h77v87zM121 602v-84h89v84zM226 602v-78h93v78zM326 602v-75h49v75zM389 602v-40h59v40zM454 602v-63h89v63zM549 602v-75h73v75zM627 602v-54h79v54zM709 602v-93h53v93zM778 602v-85h73v85zM866 602v-69h46v69zM914 602v-63h65v63zM991 602v-58h93v58zM1087 602v-36h62v36zM1160 602v-63h66v63zM1234 602v-49h81v49zM1327 602v-45h36v45zM1372 602v-75h47v75zM1424 602v-70h49v70zM1480 602v-78h39v78zM1532 602v-88h91v88z"
        />
      </g>
      <g data-depth="38">
        <path
          fill="var(--shade)"
          opacity=".62"
          d="M-20 602v-63h110v63zM124 602v-154h90v154zM253 602v-78h60v78zM324 602v-71h64v71zM396 602v-183h91v183zM502 602v-86h65v86zM598 602v-119h71v119zM711 602v-148h81v148z"
        />
        {WINDOWS.map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            data-window
            x={x}
            y={y}
            width="7"
            height="9"
            fill="var(--sun)"
            opacity=".75"
          />
        ))}
      </g>
      {banner && (
        <g data-plane transform="translate(-2000 0)">
          <g data-bob>
            <path
              fill="var(--shade)"
              d="M0 170q10-14 40-14h44l22-30h14l-8 34q10 4 10 10t-12 10H36q-30 0-36-10zM46 152l20-22h16l-8 26z"
            />
            <path d="M122 172H190" stroke="var(--shade)" strokeWidth="2" />
            <path fill="var(--stripe-1)" d="M190 144h430l-18 28 18 28H190z" />
            <text
              x="212"
              y="184"
              fill="black"
              fontSize="34"
              fontWeight="800"
              textLength={376}
              lengthAdjust="spacingAndGlyphs"
            >
              {banner}
            </text>
          </g>
        </g>
      )}
      <rect x="-60" y="600" width="1720" height="320" fill="var(--sea)" />
      <g stroke="var(--sun-low)" strokeWidth="8" strokeLinecap="round" opacity=".75">
        {GLINTS.map(([x1, x2, y]) => (
          <path key={y} data-glint d={`M${x1} ${y}H${x2}`} />
        ))}
      </g>
      <g data-boat transform="translate(-400 0)">
        <g data-bob>
          <path fill="white" opacity=".9" d="M0 668h150l-22 26H22z" />
          <path fill="var(--stripe-3)" d="M14 676h126l-6 7H19z" />
          <path fill="var(--shade)" d="M58 668l16-26h44l10 26z" />
          <path
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            opacity=".55"
            d="M-110 692H-8M-70 700H6"
          />
        </g>
      </g>
      <g data-depth="70" fill="var(--shade)">
        <path
          data-palm="a"
          d="M1448 920Q1433 625 1396 330L1408 330Q1453 625 1476 920ZM1402 330Q1316 260 1229 351Q1318 280 1402 330ZM1402 330Q1299 302 1196 475Q1301 322 1402 330ZM1402 330Q1341 240 1280 256Q1343 260 1402 330ZM1402 330Q1377 239 1353 216Q1379 259 1402 330ZM1402 330Q1427 239 1451 216Q1429 259 1402 330ZM1402 330Q1464 238 1527 254Q1466 258 1402 330ZM1402 330Q1495 259 1588 353Q1497 279 1402 330ZM1402 330Q1503 303 1604 474Q1505 323 1402 330Z"
        />
        <path
          data-palm="b"
          d="M1320.2 920Q1337 720 1361.8 520L1370.2 520Q1351 720 1339.8 920ZM1366 520Q1305 468 1245 535Q1307 488 1366 520ZM1366 520Q1294 498 1222 621Q1296 518 1366 520ZM1366 520Q1323 454 1281 468Q1325 474 1366 520ZM1366 520Q1349 453 1331 440Q1351 473 1366 520ZM1366 520Q1383 453 1401 440Q1385 473 1366 520ZM1366 520Q1410 453 1453 467Q1412 473 1366 520ZM1366 520Q1431 468 1496 536Q1433 488 1366 520ZM1366 520Q1437 498 1507 621Q1439 518 1366 520Z"
        />
        <path
          data-palm="c"
          className="max-lg:hidden"
          d="M79.5 940Q70 790 45.5 640L54.5 640Q85 790 100.5 940ZM50 640Q-15 585 -80 656Q-13 605 50 640ZM50 640Q-27 617 -104 749Q-25 637 50 640ZM50 640Q4 570 -41 585Q6 590 50 640ZM50 640Q31 569 13 554Q33 589 50 640ZM50 640Q69 569 87 554Q71 589 50 640ZM50 640Q97 569 144 583Q99 589 50 640ZM50 640Q120 585 190 658Q122 605 50 640ZM50 640Q126 617 202 748Q128 637 50 640Z"
        />
      </g>
    </svg>
  )
}
