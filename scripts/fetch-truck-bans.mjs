import fs from "node:fs/promises";

const key=process.env.NKD_API_KEY;
if(!key)throw new Error("Missing NKD_API_KEY repository secret");
const countries=["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","CH"];
const iso=d=>d.toISOString().slice(0,10);
const start=new Date();const from=iso(start);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);const to=iso(end);
const dates=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return iso(d)});
const warnings=[],audit=[],covered=new Set(),notCovered=new Set(),unique=new Map();
let lastCall=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function extract(value,code,depth=0){
 if(depth>9||value==null)return [];
 if(Array.isArray(value))return value.flatMap(v=>extract(v,code,depth+1));
 if(typeof value!=="object")return [];
 if(typeof value.date==="string"&&(value.country_code||value.country||code))return [{...value,country_code:value.country_code||value.country||code}];
 return Object.entries(value).flatMap(([k,v])=>extract(v,/^[A-Z]{2}$/.test(k)?k:code,depth+1));
}
async function request(country,a,b){
 const delay=750-(Date.now()-lastCall);if(delay>0)await sleep(delay);lastCall=Date.now();
 const url=new URL("https://nakordoni.eu/api/v2/data/truck-bans");
 url.searchParams.set("country",country);url.searchParams.set("date_from",a);url.searchParams.set("date_to",b);url.searchParams.set("lang","en");
 let response,json;
 for(let attempt=0;attempt<3;attempt++){
  response=await fetch(url,{headers:{Authorization:"Bearer "+key,Accept:"application/json"}});
  try{json=await response.json()}catch{json={}};
  if(response.status!==429&&response.status<500)break;
  await sleep(1500*(attempt+1));lastCall=Date.now();
 }
 if(!response.ok||json.ok===false||json.success===false||!json.data)throw new Error("Nakordoni "+country+" "+a+".."+b+" HTTP "+response.status+" "+JSON.stringify(json.error||{}));
 const data=json.data;
 const rows=[...extract(data.current_bans,country),...extract(data.upcoming_bans,country),...extract(data.bans_by_country,country)];
 const stats=data.returned??data.total_bans?.returned;
 const available=data.total_available??data.total_bans?.total_available;
 const truncated=data.truncated===true||data.total_bans?.truncated===true||(stats!=null&&available!=null&&Number(stats)<Number(available));
 const mismatch=stats!=null&&Number(stats)>0&&rows.length===0;
 const entry={country,from:a,to:b,returned:stats??null,total_available:available??null,truncated,extracted:rows.length,window:data.window??null,keys:Object.keys(data)};
 audit.push(entry);console.log("Nakordoni audit "+JSON.stringify(entry));
 for(const c of data.covered_countries||[])covered.add(c);
 for(const c of data.countries_not_covered||[])notCovered.add(c);
 for(const ban of rows){
  if(!ban.country_code||!ban.date||ban.date<from||ban.date>to)continue;
  const k=[ban.country_code,ban.date,ban.time_from,ban.time_until].join("|");
  const previous=unique.get(k);if(!previous||Object.keys(ban).length>Object.keys(previous).length)unique.set(k,ban);
 }
 if(data.window?.from&&data.window.from!==a||data.window?.to&&data.window.to!==b)warnings.push("Window mismatch "+country+" "+a+".."+b);
 return {truncated,mismatch};
}
for(const country of countries){
 try{
  const result=await request(country,from,to);
  if(result.truncated||result.mismatch){
   warnings.push("Full-week response incomplete or inconsistent: "+country+"; checking individual days");
   for(const day of dates){
    try{const r=await request(country,day,day);if(r.truncated||r.mismatch)warnings.push("Unverified day "+country+" "+day)}catch(e){warnings.push("Failed "+country+" "+day+": "+e.message)}
   }
  }
 }catch(e){warnings.push("Failed "+country+": "+e.message)}
}
const bans=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.country_code.localeCompare(b.country_code)||(a.time_from||"").localeCompare(b.time_from||""));
const output={
 source:"Nakordoni",attribution:"Data by nakordoni.eu",source_url:"https://nakordoni.eu/en/developers/docs/truck-bans",
 generated_at:new Date().toISOString(),window:{from,to,days:7},provider_response_count:audit.length,provider_audit:audit,
 completeness_status:warnings.length?"partial_unverified":"provider_reported_complete_unverified",
 completeness_warnings:warnings,status_note:"Not independently verified against official country authorities or TrafficBan. Missing bans do not prove unrestricted travel.",
 covered_countries:[...covered].sort(),countries_not_covered:[...notCovered].sort(),bans
};
await fs.mkdir("data",{recursive:true});await fs.writeFile("data/truck-bans.json",JSON.stringify(output,null,2)+"\n");
console.log("Saved "+bans.length+" unique bans; "+warnings.length+" completeness warnings");
