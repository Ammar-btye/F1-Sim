"""FastF1 schedule API for the circuit viewer. No account or API key needed."""

from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
from threading import Lock
from time import monotonic
import unicodedata

import fastf1
from fastapi import FastAPI, HTTPException, Path as PathParam
from fastapi.staticfiles import StaticFiles
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache' / 'fastf1'
CACHE.mkdir(parents=True, exist_ok=True)
fastf1.Cache.configure(cache_dir=str(CACHE))
logger = logging.getLogger(__name__)
app = FastAPI(title='F1 Sim API', version='0.1.0')

with (ROOT / 'backend' / 'data' / 'circuits.geojson').open() as source:
    CIRCUITS = json.load(source)['features']

_schedules = {}
_schedule_lock = Lock()


def timestamp(value):
    if value is None or pd.isna(value):
        return None
    result = pd.Timestamp(value)
    if result.tzinfo is None:
        result = result.tz_localize('UTC')
    return result.to_pydatetime().astimezone(timezone.utc)


def event_record(row, year):
    sessions = []
    for number in range(1, 6):
        name = row.get(f'Session{number}')
        date = timestamp(row.get(f'Session{number}DateUtc'))
        if name and not pd.isna(name) and date:
            sessions.append({'name': str(name), 'date': date.isoformat()})
    race = next((s['date'] for s in sessions if s['name'] == 'Race'), None)
    date = timestamp(row['EventDate'])
    return {
        'year': year,
        'round': int(row['RoundNumber']),
        'name': str(row['EventName']),
        'country': str(row['Country']),
        'location': str(row['Location']),
        'date': date.isoformat(),
        'raceStart': race,
        'sessions': sessions,
    }


def get_events(year):
    # FastF1 performs blocking network I/O; FastAPI runs these sync routes in its
    # thread pool. Serialize cache misses so concurrent visitors share one load.
    with _schedule_lock:
        cached = _schedules.get(year)
        if cached and monotonic() - cached[0] < 3600:
            return cached[1]
        try:
            schedule = fastf1.get_event_schedule(year, include_testing=False)
            events = [event_record(row, year) for _, row in schedule.iterrows()
                      if int(row['RoundNumber']) > 0]
            if not events:
                raise ValueError('Empty event schedule')
        except Exception as error:
            logger.warning('FastF1 schedule unavailable for %s: %s', year, error)
            raise HTTPException(503, 'FastF1 schedule is temporarily unavailable') from error
        _schedules[year] = (monotonic(), events)
        return events


def select_event(events, now):
    """Keep an active weekend through race + 6h, otherwise select the next race."""
    ordered = sorted(events, key=lambda event: event['raceStart'] or event['date'])
    for event in ordered:
        race = datetime.fromisoformat(event['raceStart'] or event['date'])
        end = race + (timedelta(hours=6) if event['raceStart'] else timedelta(days=1))
        if now <= end:
            return event
    return None


def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value).casefold()
                   if c.isalnum() and not unicodedata.combining(c))


LOCATION_ALIASES = {
    'yas island': 'Yas Marina',
    'abu dhabi': 'Yas Marina',
    'monte carlo': 'Monaco',
    'spa-francorchamps': 'Spa Francorchamps',
    'marina bay': 'Singapore',
    'al daayen': 'Lusail',
    'são paulo': 'Sao Paulo',
    'miami gardens': 'Miami',
    'kuala lumpur': 'Sepang',
}


def find_circuit(event):
    location = event['location']
    target = normalize(LOCATION_ALIASES.get(location.casefold(), location))
    for feature in CIRCUITS:
        if normalize(feature['properties']['Location']) == target:
            return feature
    # Deliberately fail instead of displaying another venue with a similar name.
    raise HTTPException(404, f'Circuit outline unavailable for {location}')


@app.get('/api/health')
def health():
    return {'status': 'ok', 'provider': 'fastf1', 'version': fastf1.__version__}


@app.get('/api/events/{year}')
def events(year: int = PathParam(ge=2018, le=2100)):
    return {'source': 'fastf1', 'year': year, 'events': get_events(year)}


@app.get('/api/track/current')
def current_track():
    now = datetime.now(timezone.utc)
    events = get_events(now.year)
    event = select_event(events, now)
    if event is None:
        try:
            event = select_event(get_events(now.year + 1), now)
        except HTTPException:
            pass  # Next season's calendar may not be published yet.
    if event is None:
        event = max(events, key=lambda item: item['raceStart'] or item['date'])
    feature = find_circuit(event)
    return {
        'source': 'fastf1',
        'geometrySource': 'bacinger/f1-circuits',
        'event': event,
        'circuit': {'type': 'FeatureCollection', 'features': [feature]},
    }


# `npm run build` + uvicorn serves frontend and API together in production.
# Mount last so API routes win over the static catch-all.
if (ROOT / 'dist' / 'index.html').exists():
    app.mount('/', StaticFiles(directory=ROOT / 'dist', html=True), name='website')
