import fs from "node:fs/promises";
const key=process.env.NAPSPAN_API_KEY;
const countries=["DEU","FRA","NLD","BEL","ESP","SWE","DNK","LUX","HRV","ITA","POL","FIN","EST","LVA","CYP","CZE","IRL","NOR","CHE","GBR","ISL","HUN","SVN","AUT","UKR"];
const out={source:"NAPSPAN",source_url:"https://napspan.com/docs.html",generated_at:new Date().toISOString(),status:key?"partial_unverified":"not_configured",events:[],audit:[],warnings:[]};
if(key){
 for(const country of countries){
  for(const type of ["restriction","closure"]){
   let offset=0;
   for(let page=0;page<5;page++){
    const url=new URL("https://api.napspan.com/api/v1/events");
    url.searchParams.set("jurisdiction",country);url.searchParams.set("type",type);url.searchParams.set("limit","100");url.searchParams.set("offset",String(offset));
    try{
     const response=await fetch(url,{headers:{"X-API-Key":key,Accept:"application/json"}});
     const json=await response.json();
     if(!response.ok){out.warnings.push(country+" "+type+": HTTP "+response.status+" "+String(json.code||json.error||""));break;}
     const rows=Array.isArray(json.data)?json.data:[];
     out.events.push(...rows.map(e=>({...e,source:"NAPSPAN",verification_status:"aggregator_unverified"})));
     out.audit.push({country,type,page,received:rows.length,total:json.total??null});
     if(!json.has_more||rows.length===0)break;
     offset+=rows.length;
     if(page===4)out.warnings.push(country+" "+type+": pagination limit reached");
    }catch(error){out.warnings.push(country+" "+type+": "+error.message);break;}
   }
  }
 }
 out.status=out.warnings.length?"partial_unverified":"aggregator_reported_unverified";
}else out.warnings.push("NAPSPAN_API_KEY not configured: add a repository Actions secret to enable feed.");
await fs.mkdir("data",{recursive:true});
await fs.writeFile("data/road-events.json",JSON.stringify(out,null,2)+"\n");
console.log("NAPSPAN: "+out.events.length+" events; "+out.warnings.length+" warnings; status="+out.status);
