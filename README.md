# Islamabad Café Navigator – WebGIS Lab 03

Interactive WebGIS navigation dashboard built with **Leaflet.js**, **OpenStreetMap**, the browser **Geolocation API** and the **OSRM routing API**.

**Student:** Rameen Naeem  
**ARID No:** 24-ARID-2433  
**Course:** WebGIS Development (Lecturer: Jaffar Waqas)  
**Study area:** Islamabad · **Category:** Café

## Features
- Left sidebar with five Islamabad cafés; click one to show its marker and route
- Route from the user's live location with distance, travel time, estimated arrival and turn-by-turn directions
- Drive, cycle and walk modes
- "Pick on map" to set a custom start point, plus a night-view base map
- Right sidebar with student name and ARID number

## Cafés
| # | Café | Area |
|---|------|------|
| 1 | Chaaye Khana | F-6 Markaz |
| 2 | Street 1 Cafe | F-6/3 |
| 3 | Butler's Chocolate Café | F-6 Super Market |
| 4 | Burning Brownie | Beverly Center, Blue Area |
| 5 | Loafology | Jinnah Avenue, Blue Area |

Travel times are estimates from OSRM using fixed road speeds and do not include live traffic. In a test at about 8:50 AM, driving time was ~40% lower than Google Maps.


## Run locally
Open the folder in VS Code and start `index.html` with the Live Server extension. Allow location access when the browser asks.

## Files
`index.html` (structure) · `style.css` (design) · `script.js` (map, geolocation, routing)
