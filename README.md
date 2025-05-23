# Aeropath Data Management Web Mapping Application

This project is a web-based mapping tool for managing and visualizing VSS (Visual Segment Surface) and DEP OIS (Departure Obstacle Identification Surface) polygons for aerodrome/runway analysis. It provides:

- Interactive map with Leaflet.js for drawing and visualizing polygons and lines.
- Form-driven workflow for VSS and DEP OIS surface creation.
- KML export for both VSS and DEP OIS polygons.
- User-friendly dialogs using SweetAlert2 for feedback and error handling.
- State management for map overlays and form resets.

## Features

- Draw and export VSS and DEP OIS polygons as KML.
- Prevents duplicate or erroneous exports.
- Clear/reset buttons for both VSS and DEP OIS workflows.
- Dynamic loading of aerodrome/runway data from CSV.
- Modern UI with Bootstrap and SweetAlert2 dialogs.

## Project Structure

- `index.html` – Main application UI.
- `main.js` – Core application logic (mapping, forms, KML export, state management).
- `styles.css` – Custom styles.
- `assets/` – Example KML files and icons.
- `data/runways.csv` – Runway data for dynamic form population.
- `static/` – Additional static assets (e.g., ruler plugin).

## Getting Started

1. Clone the repository.
2. Open `index.html` in a web browser (requires internet for CDN dependencies).
3. Use the forms to draw VSS or DEP OIS polygons, then export as KML.

## Development

- All dependencies are loaded via CDN (Leaflet, Bootstrap, SweetAlert2, proj4js).
- No build step required; works as a static site.
- For local development, use a simple HTTP server (e.g., `python3 -m http.server`).

## Version Control

- The project is managed with git. See `.gitignore` for ignored files.

## License

Proprietary – For internal Aeropath use only.
