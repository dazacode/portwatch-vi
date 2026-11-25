import { AT_I, AT_L, BOX, I, L, V } from "@/components/neon-mark"

// Runs before the first paint, so the page never shows first. Without scripts there is no splash.
// Once per visit. It goes when the page has loaded, after four seconds at most, or at any input.
const SCRIPT = `(function(){
var d=document.documentElement,done=false;
try{if(sessionStorage.getItem("splash"))return;sessionStorage.setItem("splash","1")}catch(e){return}
var least=matchMedia("(prefers-reduced-motion: reduce)").matches?700:2200,start=performance.now();
var on=["pointerdown","keydown","wheel","touchstart"];
function out(){if(done)return;done=true;
on.forEach(function(n){removeEventListener(n,out)});
d.dataset.splash="out";setTimeout(function(){delete d.dataset.splash},1050)}
d.dataset.splash="on";
on.forEach(function(n){addEventListener(n,out,{passive:true})});
addEventListener("load",function(){setTimeout(out,Math.max(0,least-(performance.now()-start)))});
setTimeout(out,4000)})()`

const Vi = () => (
  <>
    <path d={V} />
    <path d={I} transform={AT_I} />
  </>
)

/** The sign lights up on black, catches the light, and is flown through into the page. */
export function Splash() {
  return (
    <>
      <div id="splash" aria-hidden="true">
        <div className="splash-zoom">
          <svg viewBox={BOX} aria-hidden="true" className="splash-mark">
            <defs>
              <linearGradient id="splash-vi" x2="0" y2="1">
                <stop stopColor="#ffffff" />
                <stop offset="0.46" stopColor="#f3fbff" />
                <stop offset="0.52" stopColor="#b9d9ec" />
                <stop offset="1" stopColor="#ffffff" />
              </linearGradient>
              <linearGradient id="splash-l" x2="0.35" y2="1">
                <stop stopColor="#ffd0ea" />
                <stop offset="0.4" stopColor="#ff5cb6" />
                <stop offset="1" stopColor="#ff1f93" />
              </linearGradient>
              <linearGradient id="splash-sheen">
                <stop stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <filter id="splash-near" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="20" />
              </filter>
              <filter id="splash-far" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="95" />
              </filter>
              <clipPath id="splash-letters">
                <path d={V} />
                <path d={I} transform={AT_I} />
                <path d={L} transform={AT_L} />
              </clipPath>
            </defs>
            <g className="splash-vi">
              <g fill="#35c8ff" opacity="0.5" filter="url(#splash-far)">
                <Vi />
              </g>
              <g fill="#7fdcff" opacity="0.75" filter="url(#splash-near)">
                <Vi />
              </g>
              <g fill="url(#splash-vi)">
                <Vi />
              </g>
            </g>
            <g className="splash-l">
              <g fill="#ff1f93" opacity="0.8" filter="url(#splash-far)">
                <path d={L} transform={AT_L} />
              </g>
              <g fill="#ff3fa6" filter="url(#splash-near)">
                <path d={L} transform={AT_L} />
              </g>
              <path d={L} transform={AT_L} fill="url(#splash-l)" />
            </g>
            <g clipPath="url(#splash-letters)">
              <g transform="skewX(-18)">
                <rect
                  className="splash-sheen"
                  x="-900"
                  y="-760"
                  width="520"
                  height="1260"
                  fill="url(#splash-sheen)"
                />
              </g>
            </g>
          </svg>
        </div>
      </div>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant, nothing is put into it */}
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  )
}
