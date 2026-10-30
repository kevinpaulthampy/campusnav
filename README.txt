Run (Command Prompt, inside this folder):  python -m http.server
Open:  http://localhost:8000          viewer, nodes hidden, only the requested route is drawn
       http://localhost:8000/?edit    editor, all nodes and links visible
Editor changes autosave in the browser. Use Export JSON, then replace data/graph.json to make them permanent.

LIVE MODE (Android Chrome)
1. Host over https (GitHub Pages is fine). Open the page, pick start and end, press Show route, then Live.
2. Stand at the door of the start room, keep the screen on, walk along the corridor. Direction auto-calibrates after 5 steps.
3. At stairs tap "I am on the next floor". If the app says you are off route, pick where you are and it re-routes.
4. "Download log" saves the raw sensor data as a CSV. Send it back to tune step detection. "Sensitivity" changes the step threshold.
5. +1 step button (or Space on a laptop) simulates a step for testing without sensors.
