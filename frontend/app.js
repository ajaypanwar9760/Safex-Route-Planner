let selectedStartGeo = null;
let selectedEndGeo = null;

function setupAutocomplete(inputId, listId, setSelected) {
  let timeout;
  const inputEl = document.getElementById(inputId);
  const listEl = document.getElementById(listId);
  if(!inputEl || !listEl) return;

  inputEl.addEventListener('input', () => {
    clearTimeout(timeout);
    setSelected(null);
    timeout = setTimeout(async () => {
      const q = inputEl.value;
      if(q.trim().length < 2) {
        listEl.innerHTML = '';
        listEl.classList.add('hidden');
        return;
      }
      try {
        const res = await fetch(`http://localhost:3000/autocomplete?q=${encodeURIComponent(q)}`);
        let matches = await res.json();
        
        try {
          const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=3`);
          const nomData = await nomRes.json();
          matches = [...matches, ...nomData.map(n => ({ name: n.display_name, lat: parseFloat(n.lat), lng: parseFloat(n.lon) }))];
        } catch(e) {}

        listEl.innerHTML = '';
        if(matches.length === 0) {
          listEl.classList.add('hidden');
          return;
        }
        matches.forEach(m => {
          const d = document.createElement('div');
          d.className = 'autocomplete-item';
          d.innerText = m.name;
          d.onclick = () => {
            inputEl.value = m.name;
            setSelected({ lat: m.lat, lng: m.lng });
            listEl.classList.add('hidden');
          };
          listEl.appendChild(d);
        });
        listEl.classList.remove('hidden');
      } catch(e) {}
    }, 300);
  });

  document.addEventListener('click', e => {
     if(!inputEl.contains(e.target) && !listEl.contains(e.target)) {
         listEl.classList.add('hidden');
     }
  });
}

document.addEventListener('DOMContentLoaded', () => {
    setupAutocomplete('start', 'start-list', val => selectedStartGeo = val);
    setupAutocomplete('end', 'end-list', val => selectedEndGeo = val);
});

async function geocode(place){
const res=await fetch(
`https://nominatim.openstreetmap.org/search?format=json&q=${place}`);
const data=await res.json();
return {
 lat:parseFloat(data[0].lat),
 lng:parseFloat(data[0].lon)
};
}

async function searchRoute(){
const loader = document.getElementById("loader-overlay");
if(loader) loader.classList.remove("hidden");

try {
startCoords = selectedStartGeo ? selectedStartGeo : await geocode(document.getElementById("start").value);
endCoords = selectedEndGeo ? selectedEndGeo : await geocode(document.getElementById("end").value);

const response=await fetch(
"http://localhost:3000/route",
{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
start:startCoords,
end:endCoords
})
});

if (!response.ok) {
alert("Failed to fetch route. The locations might be unreachable or the server encountered an error.");
return;
}

const data=await response.json();
drawRoute(data);
} catch (err) {
console.error("Route fetch error:", err);
alert("An error occurred while fetching the route. Please try again.");
} finally {
if(loader) loader.classList.add("hidden");
}
}

function drawRoute(data){
// Clear previous routes
if(window.routeLayers&&Array.isArray(window.routeLayers)){
window.routeLayers.forEach(l=>map.removeLayer(l));
}
window.routeLayers=[];

const features=Array.isArray(data.features)?data.features:[];
let allLatLngs=[];

// Score routes by safety and distance
const scored=features.map((feature,idx)=>{
const safety=feature.properties&&typeof feature.properties.safety==="number"
?feature.properties.safety
: (typeof data.safety==="number"?data.safety:0);
const distance=feature.properties&&feature.properties.summary&&typeof feature.properties.summary.distance==="number"
?feature.properties.summary.distance
: Infinity;
return {idx,feature,safety,distance};
});

// Rank routes: highest safety, then shortest distance
let sortedRanked = [...scored].sort((a,b) => {
if(b.safety !== a.safety) return b.safety - a.safety;
return a.distance - b.distance;
});

const bestEntry=sortedRanked.length>0 ? sortedRanked[0] : null;
const bestIdx=bestEntry ? bestEntry.idx : 0;

scored.forEach(({feature,idx,safety})=>{
if(!feature.geometry||!Array.isArray(feature.geometry.coordinates)) return;

let color="red";
const rank = sortedRanked.findIndex(r => r.idx === idx);
if(rank===0){
color="green";
}else if(rank===sortedRanked.length - 1 && sortedRanked.length > 1){
color="red";
}else{
color="yellow";
}

const coords=feature.geometry.coordinates;
const path=coords.map(c=>[c[1],c[0]]);
if(path.length===0) return;

const layer=L.polyline(path,{
color:color,
weight:idx===bestIdx?5:4,
opacity:idx===bestIdx?0.9:0.6
}).addTo(map);

if (feature.properties && feature.properties.safetyBreakdown) {
const { crimeCount, accidentCount } = feature.properties.safetyBreakdown;
let title = "High Risk Route";
let titleColor = "#ff5252";

if (color === "green") {
    title = "Safest Route";
    titleColor = "#00c853";
} else if (color === "yellow") {
    title = "Moderate Risk Route";
    titleColor = "#fbc02d";
}

const tooltipContent = `<div style="font-family: 'Inter', sans-serif; text-align: center;">
<strong style="color: ${titleColor}; font-size: 14px;">${title}</strong><br/>
<span style="font-size: 13px; color: #ccc;">Safety Score: <b style="color: #fff;">${feature.properties.safety}%</b></span><br/>
<span style="font-size: 12px; color: #555;">Crimes nearby: <b>${crimeCount}</b></span><br/>
<span style="font-size: 12px; color: #555;">Accidents nearby: <b>${accidentCount}</b></span>
</div>`;
layer.bindTooltip(tooltipContent, { sticky: true });
}

window.routeLayers.push(layer);
allLatLngs=allLatLngs.concat(path);
});

if(allLatLngs.length>0){
map.fitBounds(L.latLngBounds(allLatLngs));
}

// Show info for the best route
const primaryFeature=bestEntry?bestEntry.feature:features[0];
const summary=primaryFeature?.properties?.summary||{};
const dist=summary.distance?((summary.distance/1000).toFixed(1)+" km"):"-";
const dur=summary.duration?((summary.duration/60).toFixed(0)+" min"):"-";
document.getElementById("dist").innerText=dist;
document.getElementById("time").innerText=dur;

const mainSafety=(primaryFeature&&typeof primaryFeature.properties?.safety==="number")
?primaryFeature.properties.safety
: data.safety;
document.getElementById("safe").innerText=mainSafety!=null?mainSafety:"N/A";

const infoCard = document.getElementById("info");
if(infoCard) infoCard.classList.remove("hidden");
}
