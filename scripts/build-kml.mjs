import fs from "node:fs/promises";
import JSZip from "jszip";

const EU = {
  AUT:"Австрия", BEL:"Бельгия", BGR:"Болгария", HRV:"Хорватия",
  CYP:"Кипр", CZE:"Чехия", DNK:"Дания", EST:"Эстония", FIN:"Финляндия",
  FRA:"Франция", DEU:"Германия", GRC:"Греция", HUN:"Венгрия", IRL:"Ирландия",
  ITA:"Италия", LVA:"Латвия", LTU:"Литва", LUX:"Люксембург", MLT:"Мальта",
  NLD:"Нидерланды", POL:"Польша", PRT:"Португалия", ROU:"Румыния",
  SVK:"Словакия", SVN:"Словения", ESP:"Испания", SWE:"Швеция", CHE:"Швейцария", LIE:"Лихтенштейн", NOR:"Норвегия", ISL:"Исландия", GBR:"Великобритания", ALB:"Албания", AND:"Андорра", BIH:"Босния и Герцеговина", MNE:"Черногория", MKD:"Северная Македония", SRB:"Сербия", MDA:"Молдова", UKR:"Украина", BLR:"Беларусь", TUR:"Турция", SMR:"Сан-Марино", MCO:"Монако", VAT:"Ватикан"
};
const ISO2 = {AUT:"AT",BEL:"BE",BGR:"BG",HRV:"HR",CYP:"CY",CZE:"CZ",DNK:"DK",EST:"EE",FIN:"FI",FRA:"FR",DEU:"DE",GRC:"GR",HUN:"HU",IRL:"IE",ITA:"IT",LVA:"LV",LTU:"LT",LUX:"LU",MLT:"MT",NLD:"NL",POL:"PL",PRT:"PT",ROU:"RO",SVK:"SK",SVN:"SI",ESP:"ES",SWE:"SE", CHE:"CH", LIE:"LI", NOR:"NO", ISL:"IS", GBR:"GB", ALB:"AL", AND:"AD", BIH:"BA", MNE:"ME", MKD:"MK", SRB:"RS", MDA:"MD", UKR:"UA", BLR:"BY", TUR:"TR", SMR:"SM", MCO:"MC", VAT:"VA"};
const covered = new Set(["AT","BE","BG","HR","CZ","DE","GR","ES","FR","HU","IT","LU","PL","PT","RO","SE","SI","SK"]);
// Preserve every API restriction type, including local, seasonal, road-specific and ADR.
const mainBans = list => Array.isArray(list) ? list : [];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
const coordsXml = ring => ring.map(p => p[0]+","+p[1]+",0").join(" ");
const ringXml = ring => "<LinearRing><coordinates>"+coordsXml(ring)+"</coordinates></LinearRing>";
const polyXml = poly => "<Polygon><outerBoundaryIs>"+ringXml(poly[0])+"</outerBoundaryIs>"+poly.slice(1).map(r=>"<innerBoundaryIs>"+ringXml(r)+"</innerBoundaryIs>").join("")+"</Polygon>";
const geomXml = g => g.type==="Polygon" ? polyXml(g.coordinates) : "<MultiGeometry>"+g.coordinates.map(polyXml).join("")+"</MultiGeometry>";
function centerOf(g) {
  const pts = [];
  const collect = x => { if (Array.isArray(x) && typeof x[0] === "number") pts.push(x); else if (Array.isArray(x)) x.forEach(collect); };
  collect(g.coordinates);
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
}
const [geoResp, bans] = await Promise.all([
  fetch("https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson"),
  fs.readFile("data/truck-bans.json","utf8").then(JSON.parse)
]);
if (!geoResp.ok) throw new Error("GeoJSON fetch failed: "+geoResp.status);
const geo = await geoResp.json();
// This map covers Europe only: remove France's overseas polygons (e.g. French Guiana).
// Retain metropolitan France and Corsica, and keep geometry valid for GeoJSON and KML.
function keepEuropeanPart(feature) {
  const code=feature.properties?.["ISO3166-1-Alpha-3"];
  // Exclude the circled outlying territories, including Iceland, from this mainland-focused map.
  if(code==="ISL")return null;
  const geometry=feature.geometry;
  if(!geometry||!["Polygon","MultiPolygon"].includes(geometry.type))return feature;
  const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
  const keep=poly=>{
    const ring=poly[0]||[];
    if(!ring.length)return false;
    const lon=(Math.min(...ring.map(p=>p[0]))+Math.max(...ring.map(p=>p[0])))/2;
    const lat=(Math.min(...ring.map(p=>p[1]))+Math.max(...ring.map(p=>p[1])))/2;
    if(lon < -12||lon > 45||lat < 34||lat > 72)return false;
    if(code==="DNK"&&lat>59)return false; // Faroe Islands
    if(code==="NOR"&&lat>72)return false; // Svalbard
    if(code==="FRA"&&(lon < -6||lon > 10||lat < 41||lat > 52))return false;
    if(code==="PRT"&&(lon < -10||lon > -6||lat < 36||lat > 43))return false; // Azores/Madeira
    if(code==="ESP"&&(lon < -10||lat < 35))return false; // Canary Islands
    return true;
  };
  const selected=polygons.filter(keep);
  if(!selected.length)return null;
  return {...feature,geometry:selected.length===1?{type:"Polygon",coordinates:selected[0]}:{type:"MultiPolygon",coordinates:selected}};
}
const features = geo.features.filter(f=>EU[f.properties["ISO3166-1-Alpha-3"]]).map(keepEuropeanPart).filter(Boolean);
await fs.mkdir("data", { recursive: true });
await fs.writeFile("data/eu-countries.geojson", JSON.stringify({type:"FeatureCollection",features}));
if (features.length < 27) throw new Error("Expected at least 27 EU countries, got "+features.length);
const from=bans.window?.from||"", to=bans.window?.to||"";
const generated=bans.generated_at||"";
const placemarks = features.map(f => {
  const code=f.properties["ISO3166-1-Alpha-3"], iso=ISO2[code], name=EU[code];
  const hasData=covered.has(iso);
  const rows=hasData?mainBans(bans.bans).filter(b=>b.country_code===iso):[];
  const style=!hasData?"noData":rows.length?"hasBans":"noData";
  let desc="<h2>"+esc(name)+"</h2><p><b>Период:</b> "+esc(from)+" — "+esc(to)+"</p>";
  desc+="<p><b>Источник календаря:</b> Nakordoni. Обновлено: "+esc(generated)+"</p>";
  if(!hasData) desc+="<p><b>Нет данных по этой стране.</b> Это не означает, что запретов нет.</p>";
  else if(!rows.length) desc+="<p>Нет подтверждённых записей в API. Это не означает отсутствие ограничений.</p>";
  else {
    desc+="<p><b>Записей о запретах: "+rows.length+"</b></p><ol>";
    for(const b of rows) {
      desc+="<li><b>"+esc(b.date)+"</b><br>"+esc(b.time_from||"Весь день")+(b.time_until?"–"+esc(b.time_until):"")+"<br><b>"+esc(({Sunday:"Воскресный запрет",Holiday:"Праздничный запрет","Regional Holiday":"Региональный запрет"})[b.restriction_type]||"Запрет")+"</b>";
      if(b.restriction_details) desc+="<br>"+esc(b.restriction_details);
      if(b.min_weight_tons) desc+="<br>Минимальный вес: "+esc(b.min_weight_tons)+" т";
      if(/^https:\/\//i.test(b.details_url||"")) desc+='<br><a href="'+esc(b.details_url)+'">Подробнее на Nakordoni</a>';
      desc+="</li>";
    }
    desc+="</ol>";
  }
  desc+="<p>Виджет TrafficBan: https://trafficban.com/plugins/box.html?language=ru</p>";
  const cdata=desc.replace(/]]>/g,"]]]]><![CDATA[>");
  const center=centerOf(f.geometry);
  const label='<Placemark><name>'+esc(name)+'</name><styleUrl>#label</styleUrl><Point><coordinates>'+center[0]+','+center[1]+',0</coordinates></Point></Placemark>';
  return '<Placemark><name>'+esc(name)+'</name><description><![CDATA['+cdata+']]></description><styleUrl>#'+style+'</styleUrl>'+geomXml(f.geometry)+'</Placemark>'+label;
}).join("");
const kml='<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Запреты движения грузовиков — ЕС</name><description>Период '+esc(from)+' — '+esc(to)+'. Календарь: Nakordoni. Виджет TrafficBan — отдельный источник.</description>'+
'<Style id="hasBans"><LineStyle><color>ff174f70</color><width>1.5</width></LineStyle><PolyStyle><color>4d5555dc</color></PolyStyle></Style>'+
'<Style id="noBans"><LineStyle><color>ff174f70</color><width>1.5</width></LineStyle><PolyStyle><color>4dd58531</color></PolyStyle></Style>'+
'<Style id="noData"><LineStyle><color>ff687789</color><width>1.5</width></LineStyle><PolyStyle><color>4dc0b4aa</color></PolyStyle></Style>'+
'<Style id="label"><IconStyle><scale>0</scale></IconStyle><LabelStyle><scale>0.9</scale><color>ff172033</color></LabelStyle></Style>'+
placemarks+'</Document></kml>';
await fs.mkdir("downloads",{recursive:true});
await fs.writeFile("downloads/trafficban-eu-map.kml",kml);
const zip=new JSZip();
zip.file("doc.kml",kml);
const kmz=await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE",compressionOptions:{level:8}});
await fs.writeFile("downloads/trafficban-eu-map.kmz",kmz);
console.log("Generated KML and KMZ for 27 EU countries; calendar "+from+" to "+to);
