import { NeonMark } from "@/components/neon-mark"

// Runs before the first paint, so the page never shows first. Without scripts there is no splash.
// Once per visit. It goes when the page has loaded, after five seconds at most, or at any input.
const SCRIPT = `(function(){
var d=document.documentElement,done=false;
try{if(sessionStorage.getItem("splash"))return;sessionStorage.setItem("splash","1")}catch(e){return}
var least=matchMedia("(prefers-reduced-motion: reduce)").matches?500:1900,start=performance.now();
var on=["pointerdown","keydown","wheel","touchstart"];
function out(){if(done)return;done=true;
on.forEach(function(n){removeEventListener(n,out)});
d.dataset.splash="out";setTimeout(function(){delete d.dataset.splash},600)}
d.dataset.splash="on";
on.forEach(function(n){addEventListener(n,out,{passive:true})});
addEventListener("load",function(){setTimeout(out,Math.max(0,least-(performance.now()-start)))});
setTimeout(out,4000)})()`

/** The sign lights up over a wet street. Drawn in CSS: see the splash section of globals.css. */
export function Splash() {
  return (
    <>
      <div id="splash" aria-hidden="true">
        <div className="splash-sign">
          <NeonMark />
        </div>
        <div className="splash-kerb" />
        <div className="splash-street">
          <NeonMark />
        </div>
      </div>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant, nothing is put into it */}
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  )
}
