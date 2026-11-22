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
- v4.1: Szövetség–Aliancia / Democrats Wikipedia titles fixed (was resolving to the Serbian party); polls panel folds PS+Demokrati when merged, cache bumped (edPolls2, 1 h); map keeps repainting the live count while panning.
- v4.2: Szövetség lookup no longer falls back to a text search that landed on the Serbian party (explicit page + Slovak title "Magyar Szövetség – Maďarská aliancia"); landing poll window uses the same smoothed numbers as the tracker, shown as party cards; hover no longer redraws the whole map; map modes ordered Kraje › Okresy › Obce › Body › Demografia, and clicking outside the selected okres/kraj selects that area as a whole; new "Mystery night" (random hidden result, revealed after the count) and "President: runoff" head-to-head simulator (illustrative, editable voter-transfer sliders).
- v4.3: emoji removed from buttons; a lone 'Democrats' column in the newest polls is treated as the joint PS–Demokrati list; poll cards/rows all fade the leader photo into the party colour, with party logo beside the name and a tonal logo watermark; logos now also come from Wikidata (P154) so OĽaNO / Szövetség resolve.
- v4.4: party logos back to Wikipedia page images (Wikidata only as fallback when none); Hlas leader is Matúš Šutaj Eštok; watermark logos use white-to-transparent high-contrast filter.
- v4.5: realistic swing geography in the simulator (toggle, default on; build/backtest.py = 2020→2023 backtest), PS+Demokrati folded in all poll views so landing/desk/tracker agree, SaS leader Gröhling, more candidate Wikipedia titles for KDH/Republika/Sme rodina logos on the landing page.
- v4.6: PREZ 2019 rounds 1 and 2 added as elections (real municipal results); 2019 results (Čaputová/Šefčovič/Harabin/Kotleba) added as political-geography predictors for the Voter DNA and swing model (2020→2023 backtest error 2.92→2.88 pp).
- v4.6.1: Čaputová is blue.
- v4.7: the desk results leaderboard uses the landing poll-card style (leader photo fading into the party colour, logo beside the name, tonal watermark; top 3 big, rest compact).
- v4.8: election-night show (live leaderboard FLIP + number tweening, lead-change flash and toast, seat pop, scanning map glow, pulsing LIVE, shimmering progress, 'Election called' band + confetti at the end; reduced-motion respected). UI sweep (tools/ui_sweep.js): fixed page-wide horizontal overflow from the party-map carousel below 1920 px, wrapping header under 1280 px, collapsed legend on phones.

## v4.9
- Projection screen replaces the old 'called' banner when the count finishes (hemicycle, results, possible majorities, re-run / close).
- Live probability panel during the count: who finishes first, bloc/coalition majority odds, seat ranges. Model estimate (bootstrap over counted municipalities by size group); presidential elections show win probability only.
- Live panel has three views: Nights (100-dot waffle of simulated election nights), Needle (lean dial gov vs opposition), Race (runners on a track).
- Mystery night now works in every election (2020 parliamentary, all presidential rounds use that election's own result as the baseline; live polls only for 2023). Count-time sweeping shine animations removed; top-3 leaderboard cards always use white text.
