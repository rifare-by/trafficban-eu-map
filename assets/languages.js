/* RIFARE interface localization: source language Russian. */
(()=>{
const languages={ru:"Русский",en:"English",pl:"Polski",de:"Deutsch"};
const phrases={
"Чат водителей":["Driver chat","Czat kierowców","Fahrerchat"],
"🚚 Запреты движения грузовиков в Европе":["🚚 Truck driving bans in Europe","🚚 Zakazy ruchu ciężarówek w Europie","🚚 Lkw-Fahrverbote in Europa"],
"Актуальные ограничения по странам · праздничные, воскресные, ночные и сезонные запреты":["Country-by-country restrictions · holiday, Sunday, night and seasonal bans","Ograniczenia według krajów · świąteczne, niedzielne, nocne i sezonowe","Beschränkungen nach Ländern · Feiertags-, Sonntags-, Nacht- und Saisonfahrverbote"],
"Запрет указан":["Ban listed","Zakaz obowiązuje","Fahrverbot angegeben"],
"Запрета нет":["No ban","Brak zakazu","Kein Fahrverbot"],
"Нет данных":["No data","Brak danych","Keine Daten"],
"Карта: статус на начало периода данных API":["Map: status at start of API data period","Mapa: stan na początek okresu danych API","Karte: Status zu Beginn des API-Datenzeitraums"],
"Европа":["Europe","Europa","Europa"],
"Ограничения на выбранную дату":["Restrictions for selected date","Ograniczenia na wybrany dzień","Beschränkungen am gewählten Datum"],
"Информация по стране":["Country information","Informacje o kraju","Länderinformationen"],
"Выберите страну на карте":["Select a country on the map","Wybierz kraj na mapie","Land auf der Karte auswählen"],
"Нажмите на флажок или контур страны, чтобы посмотреть ограничения.":["Tap a flag or country outline to see restrictions.","Kliknij flagę lub obrys kraju, aby zobaczyć ograniczenia.","Flagge oder Länderumriss anklicken, um Beschränkungen zu sehen."],
"🇪🇺 Ограничения по странам — сегодня и завтра":["🇪🇺 Country restrictions — today and tomorrow","🇪🇺 Ograniczenia według krajów — dziś i jutro","🇪🇺 Fahrverbote nach Ländern — heute und morgen"],
"Нажмите на страну, чтобы открыть подробности. Отсутствие записей Nakordoni не означает отсутствие запрета.":["Select a country for details. Missing Nakordoni records do not prove there is no ban.","Wybierz kraj, aby zobaczyć szczegóły. Brak wpisów Nakordoni nie oznacza braku zakazu.","Land für Details auswählen. Fehlende Nakordoni-Einträge bedeuten nicht, dass kein Fahrverbot gilt."],
"Подробно по странам":["Country details","Szczegóły krajów","Länderdetails"],
"Календарь запретов":["Ban calendar","Kalendarz zakazów","Fahrverbotskalender"],
"Сообщество водителей":["Driver community","Społeczność kierowców","Fahrergemeinschaft"],
"Экспорт KML / KMZ":["Export KML / KMZ","Eksport KML / KMZ","KML-/KMZ-Export"],
"Экспорт карты":["Export map","Eksportuj mapę","Karte exportieren"],
"Скачать карту стран с доступными записями ограничений для навигатора. Проверяйте актуальность перед рейсом.":["Download the map with available restriction records for navigation. Check for updates before departure.","Pobierz mapę z dostępnymi ograniczeniami do nawigacji. Sprawdź aktualność przed wyjazdem.","Karte mit verfügbaren Beschränkungen für die Navigation herunterladen. Vor Fahrtbeginn aktualisieren."],
"↓ Скачать KML":["↓ Download KML","↓ Pobierz KML","↓ KML herunterladen"],
"↓ Скачать KMZ":["↓ Download KMZ","↓ Pobierz KMZ","↓ KMZ herunterladen"],
"Календарь запретов TrafficBan":["TrafficBan restrictions calendar","Kalendarz zakazów TrafficBan","TrafficBan-Fahrverbotskalender"],
"Интерактивный виджет запретов движения грузовиков по Европе. Источник: TrafficBan.com.":["Interactive European truck restrictions widget. Source: TrafficBan.com.","Interaktywny widżet zakazów ruchu ciężarówek w Europie. Źródło: TrafficBan.com.","Interaktives Widget für europäische Lkw-Fahrverbote. Quelle: TrafficBan.com."],
"Если виджет не отображается,":["If the widget does not appear,","Jeśli widżet się nie wyświetla,","Falls das Widget nicht angezeigt wird,"],
"откройте TrafficBan отдельно":["open TrafficBan separately","otwórz TrafficBan osobno","TrafficBan separat öffnen"],
"Загрузка данных…":["Loading data…","Ładowanie danych…","Daten werden geladen…"],
"Загрузка информации…":["Loading information…","Ładowanie informacji…","Informationen werden geladen…"],
"Загружается интерактивная карта…":["Loading interactive map…","Ładowanie mapy interaktywnej…","Interaktive Karte wird geladen…"],
"Сегодня:":["Today:","Dziś:","Heute:"],
"Завтра:":["Tomorrow:","Jutro:","Morgen:"],
"нет данных":["no data","brak danych","keine Daten"],
"запрета нет":["no ban","brak zakazu","kein Fahrverbot"],
"записей":["records","wpisów","Einträge"],
"Ограничения на ближайшие 7 дней":["Restrictions for the next 7 days","Ograniczenia na najbliższe 7 dni","Beschränkungen für die nächsten 7 Tage"],
"На эту дату подтверждённых записей в подключённом календаре нет.":["No confirmed records in the connected calendar for this date.","Brak potwierdzonych wpisów w kalendarzu na ten dzień.","Für dieses Datum gibt es keine bestätigten Einträge im verbundenen Kalender."],
"Это не означает, что движение разрешено.":["This does not mean driving is permitted.","Nie oznacza to, że ruch jest dozwolony.","Dies bedeutet nicht, dass die Fahrt erlaubt ist."]
};
const source=new Map(Object.entries(phrases));const langs=["en","pl","de"];
const reverse=new Map();
for(const [ru,translations] of source)for(const t of translations)reverse.set(t,ru);
let current="ru",busy=false;
function translated(raw){
 const m=raw.match(/^(\s*)([\s\S]*?)(\s*)$/);if(!m)return raw;
 const value=m[2];const canonical=reverse.get(value)||value;
 const t=source.get(canonical);
 if(!t||current==="ru")return m[1]+canonical+m[3];
 return m[1]+t[langs.indexOf(current)]+m[3];
}
function apply(){
 if(busy)return;busy=true;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  if(node.parentElement?.closest("script,style,select,option,iframe"))continue;
  const next=translated(node.nodeValue);
  if(next!==node.nodeValue)node.nodeValue=next;
 }
 document.documentElement.lang=current;
 const widget=document.querySelector('#trafficban iframe');
 if(widget){const url=new URL(widget.src);const language=current==="pl"?"pl":current==="de"?"de":current==="en"?"en":"ru";if(url.searchParams.get("language")!==language){url.searchParams.set("language",language);widget.src=url.toString();}}
 busy=false;
}
const picker=document.getElementById("rifareLanguage");
if(!picker)return;
const saved=localStorage.getItem("rifare-language");
if(saved&&languages[saved])current=saved;
picker.value=current;
picker.addEventListener("change",()=>{current=picker.value;localStorage.setItem("rifare-language",current);apply();});
const observer=new MutationObserver(()=>apply());
observer.observe(document.body,{subtree:true,childList:true,characterData:true});
apply();
})();