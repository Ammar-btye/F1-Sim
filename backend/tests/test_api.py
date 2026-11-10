from datetime import datetime, timezone
from unittest import TestCase
from unittest.mock import patch

from fastapi.testclient import TestClient
import pandas as pd

from backend import app as api


def row(round_number=20, location='São Paulo', date='2026-11-08 17:00:00'):
    return {
        'RoundNumber': round_number, 'EventName': f'{location} Grand Prix',
        'Country': 'Brazil', 'Location': location, 'EventDate': pd.Timestamp(date),
        'Session1': 'Practice 1', 'Session1DateUtc': pd.Timestamp('2026-11-06 15:30:00'),
        'Session5': 'Race', 'Session5DateUtc': pd.Timestamp(date),
    }


class ApiTests(TestCase):
    def setUp(self):
        api._schedules.clear()
        self.client = TestClient(api.app)

    def test_current_weekend_returns_real_geometry_and_metadata(self):
        with patch.object(api.fastf1, 'get_event_schedule', return_value=pd.DataFrame([row()])) as load:
            with patch.object(api, 'datetime', wraps=datetime) as clock:
                clock.now.return_value = datetime(2026, 11, 7, tzinfo=timezone.utc)
                response = self.client.get('/api/track/current')
            self.assertEqual(response.status_code, 200)
            body = response.json()
            self.assertEqual(body['source'], 'fastf1')
            self.assertEqual(body['event']['round'], 20)
            self.assertEqual(body['circuit']['features'][0]['properties']['id'], 'br-1940')
            self.assertGreater(len(body['circuit']['features'][0]['geometry']['coordinates']), 100)
            self.assertTrue(body['event']['sessions'][0]['date'].endswith('+00:00'))
            load.assert_called_once_with(2026, include_testing=False)

    def test_schedule_is_cached_between_requests(self):
        with patch.object(api.fastf1, 'get_event_schedule', return_value=pd.DataFrame([row()])) as load:
            self.client.get('/api/events/2026')
            self.client.get('/api/events/2026')
            self.assertEqual(load.call_count, 1)

    def test_upstream_outage_returns_retryable_error(self):
        with patch.object(api.fastf1, 'get_event_schedule', side_effect=RuntimeError('offline')):
            response = self.client.get('/api/events/2026')
        self.assertEqual(response.status_code, 503)

    def test_empty_schedule_returns_retryable_error(self):
        with patch.object(api.fastf1, 'get_event_schedule', return_value=pd.DataFrame()):
            self.assertEqual(self.client.get('/api/events/2026').status_code, 503)

    def test_invalid_year_is_rejected_before_upstream_request(self):
        with patch.object(api.fastf1, 'get_event_schedule') as load:
            self.assertEqual(self.client.get('/api/events/1900').status_code, 422)
            load.assert_not_called()

    def test_active_weekend_is_retained_then_next_event_is_selected(self):
        brazil = api.event_record(row(), 2026)
        vegas = api.event_record(row(21, 'Las Vegas', '2026-11-22 04:00:00'), 2026)
        self.assertEqual(api.select_event([vegas, brazil], datetime(2026, 11, 8, 20, tzinfo=timezone.utc)), brazil)
        self.assertEqual(api.select_event([brazil, vegas], datetime(2026, 11, 9, tzinfo=timezone.utc)), vegas)

    def test_next_season_is_used_after_final_race(self):
        with patch.object(api.fastf1, 'get_event_schedule', side_effect=[
            pd.DataFrame([row()]), pd.DataFrame([row(1, 'Melbourne', '2027-03-07 05:00:00')]),
        ]):
            with patch.object(api, 'datetime', wraps=datetime) as clock:
                clock.now.return_value = datetime(2026, 12, 31, tzinfo=timezone.utc)
                response = self.client.get('/api/track/current')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['event']['year'], 2027)

    def test_unknown_circuit_does_not_silently_use_a_different_track(self):
        with patch.object(api.fastf1, 'get_event_schedule', return_value=pd.DataFrame([row(location='Unknown')])):
            with patch.object(api, 'datetime', wraps=datetime) as clock:
                clock.now.return_value = datetime(2026, 11, 7, tzinfo=timezone.utc)
                self.assertEqual(self.client.get('/api/track/current').status_code, 404)

    def test_calendar_location_aliases_resolve(self):
        for location in ['São Paulo', 'Spa-Francorchamps', 'Yas Island', 'Marina Bay', 'Lusail', 'Miami Gardens', 'Kuala Lumpur']:
            self.assertEqual(api.find_circuit({'location': location})['geometry']['type'], 'LineString')
