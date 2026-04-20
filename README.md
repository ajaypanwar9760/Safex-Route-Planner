safex-route-planner
A full-stack, data-driven mapping application that dynamically computes the safest and shortest driving routes using real-world criminal and traffic accident datasets.

# SafeX Route Planner 

A modern, full-stack route planning application that prioritizes **user safety** by injecting real-world crime and traffic accident datasets into its pathfinding algorithm. Utilizing OpenRouteService and a stunning dark-themed glassmorphism interface, SafeX ranks and visualizes alternative routes so users can actively avoid high-risk geographical zones.

## Key Features

*   **Dynamic Safety Scoring:** The backend caches and parses millions of rows of CSV data (Chicago Crimes and US Accidents). It traces a geospatial bounding box around every generated route step and calculates localized safety deductions based on historical incident density.
*   **Visual Risk Ranking:** The mapping engine renders up to three alternative driving routes. The codebase dynamically ranks them:
    *   🟢 **Green:** Safest optimized route.
    *   🟡 **Yellow:** Moderate risk alternative.
    *   🔴 **Red:** Highest risk route.
*   **Interactive Analytics:** Hovering over any generated route line pops up a real-time data tooltip, displaying the calculated Safety Score percentage alongside the raw historical crime and accident counts for that specific street bounds.
*   **Dual-Layer Autocomplete:** Features a custom search bar that natively queries the backend dataset memory sequentially as you type (preventing API lag), while seamlessly supplementing local dataset addresses with global landmark queries via Nominatim OpenStreetMap.
*   **Premium UI Design:** Built with pure CSS, the interface boasts a responsive, dark glassmorphism aesthetic complete with full-screen car animation loading overlays during API fetches.

##  Technology Stack

*   **Frontend:** Vanilla JavaScript, HTML5, CSS3 *(No heavy frameworks!)*
*   **Mapping:** Leaflet.js
*   **Backend:** Node.js, Express
*   **Routing API:** OpenRouteService (ORS) v2
*   **Data Parsing:** High-performance `csv-parser` memory stream chunking

