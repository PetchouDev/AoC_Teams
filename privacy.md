# Privacy Policy – “AoC Team Leaderboard” Extension

Last updated: 27 November 2025

## 1. Who is responsible?

This extension is developed and operated on a non-commercial basis by an Advent of Code private leaderboard administrator, for use by participants of that leaderboard.

## 2. What data is collected?

The extension works with the following data:

* **Advent of Code identifiers** visible on leaderboard pages (numeric member ID, display name, scores, star count).
* **Team assignments** (association between a player’s Advent of Code ID and a team).
* **Local display preferences** (for example: backend URL, display options) stored in `chrome.storage` / browser extension storage on your device.

The extension does **not** read, modify, or transmit your Advent of Code login credentials (such as your password or session cookies).

## 3. Where does the data go?

The extension sends only:

* the player’s Advent of Code numeric ID, and
* the chosen team,

to the **configuration server** used by the extension, for the purpose of building the team leaderboard.

This server does **not** receive:

* your password,
* your Advent of Code session cookie, or
* your browsing data outside of the leaderboard context.

## 4. What is the data used for?

The data is used solely to:

* associate each player with a team,
* calculate scores per team, and
* display a team-based ranking directly on the Advent of Code private leaderboard page.

No data is used for advertising, profiling, or marketing analytics.

## 5. Data sharing

Data is not sold or shared with third parties, except:

* basic technical processing by the hosting provider of the configuration server, and
* other users of the same leaderboard, who can see teams and scores as rendered by the extension.

## 6. Data retention

* Local preferences stored in browser extension storage remain on your device until you uninstall the extension or manually clear the extension’s data.
* Player/team associations are kept on the configuration server as long as the leaderboard remains active or until they are manually removed by the administrator.

## 7. How can you delete your data?

* You can **uninstall the extension** at any time from your browser.
* You can **clear local data** via your browser’s extension settings or by clearing extension storage.
* To request removal of your player/team association from the server, contact the administrator of the instance (contact details are usually shared with the leaderboard participants).

## 8. Extension permissions

The extension uses, in particular:

* read access to `https://adventofcode.com/*/leaderboard/private/view/*` pages in order to read leaderboard data,
* network access to the configuration server to fetch and save team assignments,
* browser extension storage (`chrome.storage` / `browser.storage`) to store local preferences (such as backend URL or UI options).

These permissions are required only to provide team-based ranking functionality.

## 9. Contact

For any questions about this privacy policy or how this extension handles data, you can contact the administrator of the leaderboard or instance that you are using this extension with or raise an issue on this GitHub repo.


