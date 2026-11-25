/**
 * Decorative and original: the sun over the bay, drawn in the theme's own colours. It rises with the
 * score, from mostly set at 0 to clear of the water at 100.
 */
export function Sunset({ className, level = 50 }: { className?: string; level?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 960 540"
      preserveAspectRatio="xMidYMax slice"
      className={className}
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
          <path d="M0 0H960V228H0zM0 236H960V262H0zM0 273H960V294H0zM0 308H960V324H0zM0 341H960V352H0z" />
        </clipPath>
      </defs>
      <rect width="960" height="372" fill="url(#sky)" />
      <g clipPath="url(#slats)">
        <circle
          cx="640"
          cy="262"
          r="140"
          fill="url(#disc)"
          className="transition-transform duration-1000 ease-out motion-reduce:transition-none"
          style={{ transform: `translateY(${Math.round(70 - level * 1.4)}px)` }}
        />
      </g>
      <path
        fill="var(--shade)"
        opacity=".45"
        d="M0 372V330h46v-22h30v22h28v-52h18v-14h22v14h16v62h34v-34h52v34h26v-78h12v-12h10v12h12v78h44v-24h60v24h38v-46h30v46h540V372z"
      />
      <rect y="368" width="960" height="172" fill="var(--sea)" />
      <path
        stroke="var(--sun-low)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity=".75"
        d="M530 388H750M562 406H718M546 426H700M594 446H690M610 468H668"
      />
      <path
        fill="var(--shade)"
        d="M863.25 540Q855.1 363 834.25 186L841.75 186Q867.6 363 880.75 540ZM838 186Q784 139 730 199Q786 159 838 186ZM838 186Q774 165 709 277Q776 185 838 186ZM838 186Q800 126 762 140Q802 146 838 186ZM838 186Q823 126 807 115Q825 146 838 186ZM838 186Q853 126 869 115Q855 146 838 186ZM838 186Q877 125 916 138Q879 145 838 186ZM838 186Q896 138 955 201Q898 158 838 186ZM838 186Q901 165 964 276Q903 185 838 186ZM799.7 540Q810.1 418 825.3 296L830.7 296Q819.1 418 812.3 540ZM828 296Q789 260 750 305Q791 280 828 296ZM828 296Q782 279 735 361Q784 299 828 296ZM828 296Q801 251 773 263Q803 271 828 296ZM828 296Q817 250 806 245Q819 270 828 296ZM828 296Q839 250 850 245Q841 270 828 296ZM828 296Q856 250 884 262Q858 270 828 296ZM828 296Q870 259 912 307Q872 279 828 296ZM828 296Q873 279 919 361Q875 299 828 296Z"
      />
    </svg>
  )
}
