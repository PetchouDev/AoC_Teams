# AoC Teams

Chrome extension + Node.js backend to add team rankings on Advent of Code private leaderboards.

## How it works
- Backend (`backend/`): Express API backed by `data.json`. It serves a list of leaderboards from `config.json`, stores team definitions and assignments, and exposes endpoints to fetch config or join/leave a team.
- Extension (`extension/`): Replaces the AoC leaderboard display with a team ranking plus the original player ranking. It scrapes the rendered page for scores/stars and colors players and teams according to the backend config.
- The backend URL is stored in `chrome.storage.sync` under the key `${year}-${leaderboardId}`. The popup lets you add/remove backends; it fetches `/config` to register all leaderboards exposed by that backend.

## Setup
**0.** Dependencies: 
  - Install `Docker` or any container runtime you prefer (but this readme assumes Docker).
  - Install `Nginx` or any reverse proxy of your choice to expose the backend on the internet.
  - Clone the repo `git clone https://github.com/PetchouDev/AoC_Teams.git`
**1.** Go to the backend directory: `cd backend`
**2.** Change the `config.json` file to define your leaderboards and teams.
Here is an example:
```json
{
    "Leaderboard name" : {
        "year": 2025,
        "id": 20251225,
        "teams": {
            "Team 1": "#00ccff",
            "Team 2": "#33FF57"
        }
    }
}
```
**3.** Build adn run the backend as a detached container:
```bash
docker compose up -d
```
At this point, the backend should be running on `http://localhost:3001` inside your machine.
**4.** Configure your reverse proxy (e.g. Nginx) to forward requests from the external URL to the backend container.
```bash
# Debian/Ubuntu example:
cp aos_team.conf /etc/nginx/sites-available/aos_team.conf
ln -s /etc/nginx/sites-available/aos_team.conf /etc/nginx/sites-enabled/aos_team.conf
systemctl reload nginx

# RHEL/Rocky Linux example:
cp aos_team.conf /etc/nginx/conf.d/aos_team.conf
systemctl reload nginx
```
**5.** Enable HTTPS using Certbot (optional but recommended):
  - Install Certbot: 
  ```bash
  # Debian/Ubuntu
  apt install certbot python3-certbot-nginx
  
  # RHEL/Rocky Linux
  dnf install certbot python3-certbot-nginx
  ```
  (RHEL/Rocky Linux).
  - Run Certbot: 
  ```bash
  certbot --nginx -d your-domain.com
  ```

**Notes:**
- Data is persisted in `backend/data.json`. Static leaderboard definitions live in `backend/config.json`.
- To udpate the backend, edit `config.json` and restart the container:  
```bash
# From the backend directory (preferred)
docker compose restart

# From anywhere
docker restart aoc-teams-backend
```

### API endpoints (per slug)
- `GET /:slug/config` → `{ leaderboardName, teams, id, year, ... }`  
  Returns the config for the given leaderboard slug.
- `POST /:slug/assign` body `{ memberId, team }` → `{ ok: true, leaderboard: slug }`  
  Assigns a member to a team or removes them when `team` is falsy.
- `GET /all` → list of leaderboards with full URLs for discovery.


## Extension
- Load unpacked from `extension/` in `chrome://extensions`.
- Popup (icon): shows saved backends (key `year-id` → `{ backend, name }`), lets you delete or open, and add a backend by URL (fetches `/config` and registers all leaderboards).
- Content script: on a private leaderboard page, fetches the JSON leaderboard and backend config, computes team scores, injects a “Team ranking” block after `#event_info`, and keeps the original player ranking. Buttons let you join/leave a team (calls `POST /:slug/assign`).

## Manual backend registration (if needed)
In DevTools on the target leaderboard page:
```js
chrome.storage.sync.set({ "2024-123456": "http://localhost:3000/leaderboard_1" });
```
Replace year/id and URL accordingly.

## Notes
- Team colors are applied to team names and to the current player’s name when they belong to a team.
- Join/Leave requires a known member id/name present in the leaderboard JSON; if the user isn’t listed yet, they’ll be added with score 0 when joining.***
