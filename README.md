# Election Desk NRSR

Static web project – no build step, no server needed. Open `index.html` (landing page) or `desk/index.html` (the app) straight from disk, or host the folder anywhere.

```
index.html            landing page (countdown, live polls, features, party-map carousel)
desk/index.html       the Election Desk app (map, simulator, demographics, path-to-victory, party carousel)
assets/polls.js       shared live-poll loader/parser (Wikipedia)
assets/landing.*      landing page styles, script, data
assets/maps, shots    generated party maps and screenshots used on the landing page
screenshots/          review screenshots (desktop, mobile, offline fallback)
```

## v3 changes
- Desk layout is horizontal: map + results rail on top, a tool dock below (simulator controls in four columns, parliament, live polls + tracker, demographic profile). Home button top-left.
- Polls: weighted (recency x sample size), tricube-kernel smoothed trend; PS–Demokrati joint list is kept as one entry (counted under PS in the simulator); tracker window with hover, replay and "apply this date".
- Map: only the 30 largest labels are drawn; the land rim no longer rebuilds on every pan/zoom frame.
- Census: education, urban/rural and nationality added as map layers, profile bars and simulator shift groups.
- Roads: area-scoped Overpass queries across four mirrors (POST then GET), motorways shown first, visible status/error toast, retry on re-click.
- Slovak UI now pulls Slovak Wikipedia text/descriptions (falls back to English marked "(EN)").

## What is live
- **Polls**: read at runtime from Wikipedia's "Opinion polling for the next Slovak parliamentary election" table (cached 3 h). `desk/index.html?polls=live` auto-applies them to the simulator.
- **Roads**: motorways/expressways from OpenStreetMap (Overpass) at runtime, with a schematic fallback labelled approximate.
- **Logos / photos**: Wikipedia API at runtime; initials when no image is found.
Without internet the app falls back to the 2023 result and says so.

## Notes
- The election date is not yet called; the countdown targets the last possible day (28 Sep 2027).
- Simulator and path-to-victory are illustrative models, not forecasts.
- Screenshots were produced with mocked poll data (illustrative numbers), not real polls.

## v4 notes
- Loader: CSS-only animated Slovakia dot map, theme-aware from first paint (early `<head>` script reads `electionDeskTheme` / system theme).
- Demography now works per municipality, district (okres) and region (kraj) with a level switch and rankings.
- PS + Demokrati merged in the simulator (toggle, default on); "Path to victory" apply is targeted (demographic top-3 predictors).
- Roads: multi-class progressive load with IndexedDB cache; check the browser console for `[roads]` if none appear.
- Grid backdrop from the landing page is used on the desk map; "Sčítané" banner fixed for light mode.
- Screenshots in `screenshots/v4_*` use mocked road/poll data.
