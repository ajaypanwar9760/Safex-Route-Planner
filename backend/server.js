const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Load crime and accident datasets (downsampled) into memory
const crimePoints = [];
const accidentPoints = [];
const locationDict = [];
const locationSet = new Set();
let crimeLoaded = false;
let accidentsLoaded = false;

function loadCrimeData() {
  const crimePath = path.join(__dirname, "../data/Crimes_-_2001_to_Present.csv");
  if (!fs.existsSync(crimePath)) {
    console.log("Crime dataset not found at", crimePath);
    return;
  }
  const MAX_ROWS = 200000;
  fs.createReadStream(crimePath)
    .pipe(csv())
    .on("data", (row) => {
      if (crimePoints.length >= MAX_ROWS) return;
      const lat = parseFloat(row.Latitude || row.latitude || row.lat);
      const lng = parseFloat(row.Longitude || row.longitude || row.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        crimePoints.push({ lat, lng });
        const block = row.Block || row.block;
        if (block) {
          const name = block + ", Chicago, IL";
          if (!locationSet.has(name)) {
            locationSet.add(name);
            locationDict.push({ name, lat, lng });
          }
        }
      }
    })
    .on("end", () => {
      crimeLoaded = true;
      console.log("Crime data loaded points:", crimePoints.length);
    })
    .on("error", (err) => {
      console.error("Error loading crime data:", err.message);
    });
}

function loadAccidentData() {
  const accPath = path.join(__dirname, "../data/US_Accidents_March23.csv");
  if (!fs.existsSync(accPath)) {
    console.log("Accident dataset not found at", accPath);
    return;
  }
  const MAX_ROWS = 200000;
  fs.createReadStream(accPath)
    .pipe(csv())
    .on("data", (row) => {
      if (accidentPoints.length >= MAX_ROWS) return;
      const lat = parseFloat(row.Start_Lat || row.start_lat || row.lat);
      const lng = parseFloat(row.Start_Lng || row.start_lng || row.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        accidentPoints.push({ lat, lng });
        const street = row.Street || row.street;
        const city = row.City || row.city;
        const state = row.State || row.state;
        if (street && city && state) {
          const name = `${street}, ${city}, ${state}`;
          if (!locationSet.has(name)) {
            locationSet.add(name);
            locationDict.push({ name, lat, lng });
          }
        }
      }
    })
    .on("end", () => {
      accidentsLoaded = true;
      console.log("Accident data loaded points:", accidentPoints.length);
    })
    .on("error", (err) => {
      console.error("Error loading accident data:", err.message);
    });
}

function computeSafetyForFeature(feature) {
  if (!feature || !feature.geometry || !Array.isArray(feature.geometry.coordinates)) {
    return { safety: 100, crimeCount: 0, accidentCount: 0 };
  }

  const coords = feature.geometry.coordinates;
  if (!coords.length) {
    return { safety: 100, crimeCount: 0, accidentCount: 0 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  coords.forEach(([lng, lat]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });

  // Add a small buffer (~1km) around the route box
  const margin = 0.015;
  minLat -= margin;
  maxLat += margin;
  minLng -= margin;
  maxLng += margin;

  let crimeCount = 0;
  let accidentCount = 0;

  for (const p of crimePoints) {
    if (p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng) {
      crimeCount++;
    }
  }

  for (const p of accidentPoints) {
    if (p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng) {
      accidentCount++;
    }
  }

  const totalIncidents = crimeCount + accidentCount;
  // Simple safety scaling: more incidents → lower safety
  let safety = 100;
  if (totalIncidents > 0) {
    const scaled = Math.max(0, 100 - Math.log10(1 + totalIncidents) * 25);
    safety = Math.round(scaled);
  }

  return { safety, crimeCount, accidentCount };
}

loadCrimeData();
loadAccidentData();

const ORS_KEY="5b3ce3597851110001cf6248394a589885fe4531a3974bc055973b99";

app.get("/autocomplete", (req, res) => {
  const query = (req.query.q || "").toLowerCase().trim();
  if (!query || query.length < 2) return res.json([]);
  let matches = [];
  for (let i = 0; i < locationDict.length; i++) {
    if (locationDict[i].name.toLowerCase().includes(query)) {
      matches.push(locationDict[i]);
      if (matches.length >= 10) break;
    }
  }
  res.json(matches);
});

app.post("/route", async (req,res)=>{

const {start,end}=req.body;

try{

const payload = {
coordinates:[
[start.lng,start.lat],
[end.lng,end.lat]
],
alternative_routes:{
target_count:3,
share_factor:0.6,
weight_factor:1.4
}
};

let response;
try {
response = await axios.post(
"https://api.openrouteservice.org/v2/directions/driving-car/geojson",
payload,
{
headers:{
Authorization:ORS_KEY,
"Content-Type":"application/json"
}
}
);
} catch (routeErr) {
if(routeErr.response && routeErr.response.data && routeErr.response.data.error && routeErr.response.data.error.code === 2004) {
delete payload.alternative_routes;
payload.preference = "fastest";
let resFast;
try { resFast = await axios.post("https://api.openrouteservice.org/v2/directions/driving-car/geojson", payload, {headers:{Authorization:ORS_KEY,"Content-Type":"application/json"}}); } catch(e){}

payload.preference = "shortest";
let resShort;
try { resShort = await axios.post("https://api.openrouteservice.org/v2/directions/driving-car/geojson", payload, {headers:{Authorization:ORS_KEY,"Content-Type":"application/json"}}); } catch(e){}

response = { data: { type: "FeatureCollection", features: [] } };
let added = false;
if(resFast && resFast.data && Array.isArray(resFast.data.features)) {
  response.data.features.push(resFast.data.features[0]);
  added = true;
}
if(resShort && resShort.data && Array.isArray(resShort.data.features)) {
  const fDist = response.data.features[0]?.properties?.summary?.distance;
  const sDist = resShort.data.features[0]?.properties?.summary?.distance;
  if(fDist !== sDist || !added) {
    response.data.features.push(resShort.data.features[0]);
  }
}
if (response.data.features.length === 0) throw routeErr;

} else {
throw routeErr;
}
}

const routeGeoJson = response.data;

if (Array.isArray(routeGeoJson.features)) {
routeGeoJson.features.forEach((feature, idx) => {
const safetyInfo = computeSafetyForFeature(feature);
feature.properties = feature.properties || {};
feature.properties.safety = safetyInfo.safety;
feature.properties.safetyBreakdown = {
crimeCount: safetyInfo.crimeCount,
accidentCount: safetyInfo.accidentCount,
crimeLoaded,
accidentsLoaded
};
if (idx === 0) {
routeGeoJson.safety = safetyInfo.safety;
routeGeoJson.safetyBreakdown = feature.properties.safetyBreakdown;
}
});
} else if (routeGeoJson.geometry) {
// Fallback if only a single geometry is returned
const fakeFeature = { geometry: routeGeoJson.geometry };
const safetyInfo = computeSafetyForFeature(fakeFeature);
routeGeoJson.safety = safetyInfo.safety;
routeGeoJson.safetyBreakdown = {
crimeCount: safetyInfo.crimeCount,
accidentCount: safetyInfo.accidentCount,
crimeLoaded,
accidentsLoaded
};
}

res.json(routeGeoJson);

}catch(err){
console.log("Route error:", err.message);
if (err.response) {
  console.log("ORS status:", err.response.status);
  console.log("ORS body:", JSON.stringify(err.response.data).slice(0,300));
}
res.status(500).send("Route error");
}

});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/login.html"));
});

app.listen(3000, () => {
  console.log("Server Running at http://localhost:3000");
});