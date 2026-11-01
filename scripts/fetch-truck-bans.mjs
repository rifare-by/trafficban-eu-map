import fs from "node:fs/promises";

const key=process.env.NKD_API_KEY;
if(!key)throw new Error("Missing NKD_API_KEY repository secret");
const countries=["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","CH","LI","NO","IS","GB","AL","AD","BA","ME","MK","RS","MD","UA","BY","TR","SM","MC","VA"];
const iso=d=>d.toISOString().slice(0,10);
const start=new Date();const from=iso(start);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);const to=iso(end);
const dates=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return iso(d)});
const warnings=[],audit=[],covered=new Set(),notCovered=new Set(),unique=new Map(),verifiedDays=new Map();
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
 if(!response.ok||json.ok===false||json.success===false||!json.data)throw new Error("Nakordoni "+country+" "+a+".."+b+" HTTP "+response.status+"; ok="+String(json.ok)+"; data_keys="+Object.keys(json.data||{}).join(",")+"; markets_filtered="+JSON.stringify(json.markets_filtered??null)+"; markets_notice="+JSON.stringify(json.markets_notice??null)+"; error="+JSON.stringify(json.error||null));
 const data=json.data;
 const rows=[...extract(data.current_bans,country),...extract(data.upcoming_bans,country),...extract(data.bans_by_country,country)];
 const stats=data.returned??data.total_bans?.returned;
 const available=data.total_available??data.total_bans?.total_available;
 const truncated=data.truncated===true||data.total_bans?.truncated===true||(stats!=null&&available!=null&&Number(stats)<Number(available));
 const mismatch=stats!=null&&Number(stats)>0&&rows.length===0;
 const entry={country,from:a,to:b,returned:stats??null,total_available:available??null,truncated,extracted:rows.length,window:data.window??null,keys:Object.keys(data)};
 // A successful request is not proof of zero bans unless the provider explicitly lists this country as covered.
 const explicitlyCovered=Array.isArray(data.covered_countries)&&data.covered_countries.includes(country)&&!(data.countries_not_covered||[]).includes(country);
 if(explicitlyCovered&&!truncated&&!mismatch){for(const day of dates){if(day>=a&&day<=b)verifiedDays.set(country+"|"+day,true)}}
 audit.push(entry);console.log("Nakordoni audit "+JSON.stringify(entry));
 for(const c of data.covered_countries||[])covered.add(c);
 for(const c of data.countries_not_covered||[])notCovered.add(c);
 for(const ban of rows){
  if(!ban.country_code||!ban.date||ban.date<from||ban.date>to)continue;
  const k=[ban.country_code,ban.date,ban.time_from,ban.time_until,ban.restriction_type,ban.restriction_details].join("|");
  const previous=unique.get(k);if(!previous||Object.keys(ban).length>Object.keys(previous).length)unique.set(k,ban);
 }
 if(data.window?.from&&data.window.from!==a||data.window?.to&&data.window.to!==b){warnings.push("Window mismatch "+country+" "+a+".."+b);for(const day of dates){if(day>=a&&day<=b)verifiedDays.delete(country+"|"+day)}}
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

// Conservative recurring baseline: published rules, not a claim of live road clearance.
// Holiday, regional, seasonal and route-specific restrictions still require independent verification.
const recurring=[
 {country_code:"DE",day:0,time_from:"00:00",time_until:"22:00",min_weight_tons:7.5,restriction_details:"Sunday restriction; exemptions and regional rules apply",source_url:"https://www.gesetze-im-internet.de/stvo_2013/__30.html"},
 {country_code:"FR",day:0,time_from:"00:00",time_until:"22:00",min_weight_tons:7.5,restriction_details:"Sunday restriction; generally begins Saturday 22:00; exemptions apply",source_url:"https://www.bison-fute.gouv.fr/"},
 {country_code:"FR",day:6,time_from:"22:00",time_until:"24:00",min_weight_tons:7.5,restriction_details:"Saturday evening restriction; exemptions apply",source_url:"https://www.bison-fute.gouv.fr/"},
 {country_code:"AT",day:0,time_from:"00:00",time_until:"22:00",min_weight_tons:7.5,restriction_details:"Sunday restriction; vehicle combinations and exceptions differ",source_url:"https://www.usp.gv.at/en/themen/betrieb-und-umwelt/transport-und-verkehr/lkw-fahrverbote.html"},
 {country_code:"AT",day:6,time_from:"15:00",time_until:"24:00",min_weight_tons:7.5,restriction_details:"Saturday restriction; vehicle combinations and exceptions differ",source_url:"https://www.usp.gv.at/en/themen/betrieb-und-umwelt/transport-und-verkehr/lkw-fahrverbote.html"},
 {country_code:"CZ",day:0,time_from:"13:00",time_until:"22:00",min_weight_tons:7.5,restriction_details:"Sunday restriction on motorways and first-class roads",source_url:"https://www.zakonyprolidi.cz/cs/2000-361#p43"},
 {country_code:"CH",day:0,time_from:"00:00",time_until:"24:00",min_weight_tons:3.5,restriction_details:"Sunday restriction; exemptions apply",source_url:"https://www.fedlex.admin.ch/eli/cc/1962/1364_1409_1420/en"},
 {country_code:"AT",day:-1,time_from:"22:00",time_until:"24:00",min_weight_tons:7.5,restriction_details:"Night restriction; exemptions apply",source_url:"https://www.usp.gv.at/en/themen/betrieb-und-umwelt/transport-und-verkehr/lkw-fahrverbote.html"},
 {country_code:"AT",day:-1,time_from:"00:00",time_until:"05:00",min_weight_tons:7.5,restriction_details:"Night restriction; exemptions apply",source_url:"https://www.usp.gv.at/en/themen/betrieb-und-umwelt/transport-und-verkehr/lkw-fahrverbote.html"},
 {country_code:"CH",day:-1,time_from:"22:00",time_until:"24:00",min_weight_tons:3.5,restriction_details:"Night restriction; exemptions apply",source_url:"https://www.fedlex.admin.ch/eli/cc/1962/1364_1409_1420/en"},
 {country_code:"CH",day:-1,time_from:"00:00",time_until:"05:00",min_weight_tons:3.5,restriction_details:"Night restriction; exemptions apply",source_url:"https://www.fedlex.admin.ch/eli/cc/1962/1364_1409_1420/en"}
];
for(const day of dates){
 const weekday=new Date(day+"T12:00:00Z").getUTCDay();
 for(const rule of recurring){
  if(rule.day!==-1&&rule.day!==weekday)continue;
  const {day:ignored,...details}=rule;
  const row={...details,date:day,restriction_type:rule.day===-1?"Night":"Sunday",source:"official_rule_baseline",verification_status:"rule_based_check_exceptions",details_url:rule.source_url};
  const key=[row.country_code,row.date,row.time_from,row.time_until,row.restriction_type,row.restriction_details].join("|");
  if(!unique.has(key))unique.set(key,row);
 }
}
// France: official nationwide weekend/holiday schedule. Only derive no-ban for
// ordinary weekdays; public holidays and adjacent evenings require separate verification.
function easterSunday(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(Date.UTC(year,month-1,day))}
function frHolidays(year){const e=easterSunday(year);const shift=n=>{const d=new Date(e);d.setUTCDate(d.getUTCDate()+n);return iso(d)};return new Set([year+"-01-01",year+"-05-01",year+"-05-08",year+"-07-14",year+"-08-15",year+"-11-01",year+"-11-11",year+"-12-25",shift(1),shift(39),shift(50)])}
const checkedCountryDays=[];
for(const country of countries)for(const day of dates){
 const dayRows=[...unique.values()].filter(r=>r.country_code===country&&r.date===day);
 const dow=new Date(day+"T12:00:00Z").getUTCDay();
 let status=dayRows.length?"ban":verifiedDays.has(country+"|"+day)?"no-ban":"unknown";
 let method=dayRows.length?"ban_record":verifiedDays.has(country+"|"+day)?"provider_explicit_coverage":"unverified";
 if(country==="FR"&&!dayRows.length){
  const holidays=frHolidays(Number(day.slice(0,4)));
  const next=iso(new Date(Date.parse(day+"T12:00:00Z")+86400000));
  if(dow>=1&&dow<=5&&!holidays.has(day)&&!holidays.has(next)){status="no-ban";method="france_national_calendar_rule"}
 }
 checkedCountryDays.push({country_code:country,date:day,status,method});
}
const bans=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.country_code.localeCompare(b.country_code)||(a.time_from||"").localeCompare(b.time_from||""));
const output={
 source:"Nakordoni + published recurring rules",attribution:"Nakordoni data and cited national rules",source_url:"https://nakordoni.eu/en/developers/docs/truck-bans",
 generated_at:new Date().toISOString(),window:{from,to,days:7},provider_response_count:audit.length,provider_audit:audit,
 completeness_status:"partial_unverified",
 completeness_warnings:warnings,status_note:"Not independently verified against official country authorities or TrafficBan. Missing bans do not prove unrestricted travel.",
 covered_countries:[...covered].sort(),countries_not_covered:[...notCovered].sort(),country_day_statuses:checkedCountryDays,bans
};
await fs.mkdir("data",{recursive:true});await fs.writeFile("data/truck-bans.json",JSON.stringify(output,null,2)+"\n");
console.log("Saved "+bans.length+" unique bans; "+warnings.length+" completeness warnings");
