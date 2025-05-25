// Initialize Leaflet map
var map = L.map("map").setView([-43.47498889, 172.54828611], 13);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 19,
}).addTo(map);

// Assign map to window.map for global access
window.map = map;

// Remove CDN ruler, use local static/ruler/leaflet-ruler.js
// Add after map initialization
var options = {
  position: "topleft",
  lengthUnit: {
    factor: 1000, // from km to m
    display: "m.",
    decimal: 2,
    label: "Distance:",
  },
};
if (typeof L.control.ruler === "function") {
  L.control.ruler(options).addTo(map);
}
