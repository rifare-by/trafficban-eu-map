import fs from "node:fs/promises";

const key = process.env.NKD_API_KEY;
if (!key) throw new Error("Missing NKD_API_KEY repository secret");

const countries = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","CH"];
const now = new Date();
const date = d => d.toISOString().slice(0,10);
const from = date(now);
const end = new Date(now);
end.setUTCDate(end.getUTCDate()+6);
const to = date(end);
const batches = [];
for (let i=0;i<countries.length;i+=3) batches.push(countries.slice(i,i+3));

const payloads = [];
for (let index = 0; index < batches.length; index++) {
  const batch = batches[index];
  // Nakordoni plan limit: 2 requests per second. Keep a safe 750 ms gap.
  if (index > 0) await new Promise(resolve => setTimeout(resolve, 750));
  const url = new URL("https://nakordoni.eu/api/v2/data/truck-bans");
  url.searchParams.set("country",batch.join(","));
  url.searchParams.set("date_from",from);
  url.searchParams.set("date_to",to);
  url.searchParams.set("lang","en");
  const response = await fetch(url,{headers:{Authorization:"Bearer "+key,Accept:"application/json"}});
  const json = await response.json();
  if (!response.ok || json.ok !== true) {
    throw new Error("Nakordoni API request failed ("+response.status+"): "+(json.error?.code || "unknown_error")+" — "+(json.error?.message || ""));
  }
  if (!json.data || !Array.isArray(json.data.covered_countries) || !Array.isArray(json.data.current_bans) || !Array.isArray(json.data.upcoming_bans)) throw new Error("Nakordoni returned incomplete API response for "+batch.join(","));
  const data=json.data;
  if(data.window?.from!==from||data.window?.to!==to)throw new Error("Nakordoni returned wrong date window for "+batch.join(","));
  const stats=data.returned ?? data.total_bans?.returned;
  const available=data.total_available ?? data.total_bans?.total_available;
  const truncated=data.truncated ?? data.total_bans?.truncated;
  if(truncated===true||(Number.isFinite(Number(stats))&&Number.isFinite(Number(available))&&Number(stats)<Number(available)))throw new Error("Nakordoni response truncated for "+batch.join(",")+"; refuse partial data");
  payloads.push(data);
}
const bans = [];
const covered = new Set();
const notCovered = new Set();
for (const data of payloads) {
  for (const c of data.covered_countries || []) covered.add(c);
  for (const c of data.countries_not_covered || []) notCovered.add(c);
  const grouped=Object.values(data.bans_by_country||{}).flatMap(x=>Array.isArray(x)?x:Array.isArray(x?.bans)?x.bans:[]);
  for (const ban of [...(data.current_bans || []),...(data.upcoming_bans || []),...grouped]) {
    if(!ban||!ban.country_code||!ban.date)continue;
    if(ban.date<from||ban.date>to)continue;
    bans.push(ban);
  }
}
const unique = new Map();
for (const ban of bans) {
  const k = [ban.country_code,ban.date,ban.time_from,ban.time_until,ban.restriction_type,ban.details_url].join("|");
  unique.set(k,ban);
}
// Never silently publish a suspiciously sparse calendar as complete coverage.
// A missing restriction is NOT proof that truck traffic is permitted.
// Zero or few restrictions are valid API results; preserve them without inventing bans.
const output = {
  source:"Nakordoni",
  attribution:"Data by nakordoni.eu",
  source_url:"https://nakordoni.eu/en/developers/docs/truck-bans",
  generated_at:new Date().toISOString(),
  window:{from,to,days:7},
  provider_response_count:payloads.length,
  status_note:"Only Nakordoni API records; missing rows do not prove unrestricted travel.",
  covered_countries:[...covered].sort(),
  countries_not_covered:[...notCovered].sort(),
  bans:[...unique.values()].sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.country_code||"").localeCompare(b.country_code||"")||(a.time_from||"").localeCompare(b.time_from||""))
};
await fs.mkdir("data",{recursive:true});
await fs.writeFile("data/truck-bans.json",JSON.stringify(output,null,2)+"\n");
console.log("Saved "+output.bans.length+" bans. Covered: "+output.covered_countries.join(", ")+"; not covered: "+output.countries_not_covered.join(", "));
