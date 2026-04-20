var map=L.map('map').setView([37.0902,-95.7129],4);

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
).addTo(map);

// Map click capability removed by request.