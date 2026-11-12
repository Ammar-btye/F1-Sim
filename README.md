# F1 Sim

F1 Sim is an intermediate-level Formula 1 race strategy simulator designed to optimize pit stops and tire choices. By processing real-time variables such as tire degradation and simulated weather changes, the tool aims to help teams identify optimal racing strategies under pressure.

The simulator will focus on evaluating pit-stop timing and tire compound selection as race conditions evolve, allowing users to compare strategies and adapt their decisions during a simulated race.

The website opens with “Everyone”, followed by an interactive 3D circuit and a driver championship standings table with positions, drivers, teams, wins, and points.

Requires Node.js 20.19+ or 22.12+, and Python 3.10+.

```sh
npm install
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run dev
```

`npm run dev` starts both the website at http://127.0.0.1:5173 and the Python API at http://127.0.0.1:8000. Vite proxies `/api` to Python, including in `npm run preview`. To run either service separately, use `npm run dev:frontend` or `npm run dev:api`.

For production, run `npm run build` before `npm run dev:api`; Python then serves the built website and API together on port 8000. A static-only host will show the bundled preview but cannot run FastF1. No API key is required. The first schedule request requires internet access; cached schedules refresh hourly. FastF1's own HTTP cache is stored in ignored `.cache/fastf1/`.

Drag the circuit to rotate it. Click the viewer before using the mouse wheel to zoom; touch devices support pinch zoom. Keyboard users can focus the viewer and use the arrow keys to rotate, `+` and `-` to zoom, and `Home` to reset. The circular icon also resets the view.

The viewer requests `/api/track/current` on load and every five minutes while the tab is visible. [FastF1](https://github.com/theOehrly/Fast-F1) supplies the current season's schedule. An active weekend remains selected until six hours after the scheduled race start; between races, the next event is selected. At season end the next calendar is used when available, otherwise the last race remains selected. Dates are handled in UTC. Preseason testing is excluded.

FastF1 chooses the event; the 3D outline comes from the bundled geographic circuit dataset, rather than car telemetry or surveyed elevation data. On startup or API failure, the viewer retains its last valid model (initially Interlagos), and its accessible label identifies an unavailable schedule. No extra visible text is added. Unknown circuits return 404 rather than being matched to a different venue.

API endpoints:

- `GET /api/health` — backend status and installed FastF1 version.
- `GET /api/events/{year}` — race weekends and session timestamps, from 2018 onwards.
- `GET /api/track/current` — selected event and its GeoJSON circuit outline.
- `GET /api/standings/drivers` — latest current-season driver standings via FastF1's Jolpica client, cached hourly.
- `/docs` — interactive API documentation.

Run `npm run test:api` for API integration and calendar-selection tests, and `npm run build` to check the frontend.

Driver standings refresh every five minutes while the page is visible. The table labels its season and completed round, supports fractional points, and shows an empty state before standings are published. On a failed refresh it retains the last loaded results and offers a retry button. Standings require the Python API and internet access to Jolpica F1.

Circuit geometry: [Tomislav Bacinger / f1-circuits](https://github.com/bacinger/f1-circuits), distributed under the MIT license; see `licenses/f1-circuits.txt`.
