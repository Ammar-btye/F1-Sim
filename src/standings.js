const status = document.querySelector('#standings-status');
const retry = document.querySelector('#standings-retry');
const table = document.querySelector('#standings-table-wrap');
const body = document.querySelector('#standings-body');
const season = document.querySelector('#standings-season');
let loading = false;

async function refreshStandings() {
  if (loading) return;
  loading = true;
  retry.hidden = true;
  status.hidden = false;
  status.textContent = 'Loading standings…';
  try {
    const response = await fetch('/api/standings/drivers', {
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Standings API returned ${response.status}`);
    const data = await response.json();
    if (!Number.isInteger(data.year) || !Array.isArray(data.drivers)
      || !data.drivers.every(driver => Number.isInteger(driver.position)
        && typeof driver.name === 'string' && typeof driver.team === 'string'
        && Number.isFinite(driver.points) && Number.isInteger(driver.wins))) {
      throw new Error('Invalid standings response');
    }
    const rows = data.drivers.map(driver => {
      const row = document.createElement('tr');
      [driver.position, driver.name, driver.team, driver.wins, driver.points].forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (index >= 3) cell.className = 'numeric';
        row.append(cell);
      });
      return row;
    });
    body.replaceChildren(...rows);
    season.textContent = `${data.year} season${data.round ? ` · Round ${data.round}` : ''}`;
    table.hidden = rows.length === 0;
    status.hidden = rows.length > 0;
    status.textContent = rows.length ? '' : 'Standings will appear after the first results of the season are published.';
  } catch {
    status.textContent = body.children.length
      ? 'Could not refresh standings. Showing the last loaded results.'
      : 'Driver standings are temporarily unavailable. Please try again.';
    retry.hidden = false;
  } finally {
    loading = false;
  }
}

retry.addEventListener('click', refreshStandings);
void refreshStandings();
setInterval(() => { if (!document.hidden) void refreshStandings(); }, 300000);
