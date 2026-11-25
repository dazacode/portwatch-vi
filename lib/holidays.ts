/**
 * Themes for a few days a year. Dates are the visitor's own, first and last day included. Set `on` to
 * false to leave one out for everybody; a visitor can turn it off for themselves with the leaf button.
 */
export const HOLIDAYS = [
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    greeting: "Happy Thanksgiving",
    from: "2026-11-24",
    to: "2026-11-29",
    on: true,
  },
] as const

export type Holiday = {
  id: string
  name: string
  greeting: string
  from: string
  to: string
  on: boolean
}

/** Where a visitor's choice is kept. */
export const HOLIDAY_KEY = "holiday"

/** Finds today's holiday in a script that runs before the first paint. The page itself is the same for everyone. */
export const holidayScript = (holidays: readonly Holiday[] = HOLIDAYS) => `(function(){
var n=new Date(),p=function(x){return(x<10?"0":"")+x},t=n.getFullYear()+"-"+p(n.getMonth()+1)+"-"+p(n.getDate()),d=document.documentElement;
var h=${JSON.stringify(holidays.filter((x) => x.on).map(({ id, from, to }) => [id, from, to]))}.filter(function(x){return x[1]<=t&&t<=x[2]})[0];
if(!h)return;d.dataset.season=h[0];
try{if(localStorage.getItem("${HOLIDAY_KEY}")==="off")return}catch(e){}
d.dataset.holiday=h[0]})()`
