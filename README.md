# Georgia Car Market

An Android app that analyses Georgia's car market from official data it
downloads itself. Sections (bottom bar):

- **Market**: overview of car imports and re-exports (monthly), market mix of
  new registrations (fuel, body, engine size, age, colour, region, new vs used
  imports, vehicle fleet, fuel prices), imports by fuel/engine type, origin and
  destination countries.
- **Brands**: brands and models ranked by first registrations in Georgia,
  growth vs the same period a year earlier, brand history and models, risers,
  fallers and newcomers, searchable model list.
- **Economy**: exchange rates, GDP growth, inflation, salaries, policy rate,
  car affordability and what it means for demand.
- **World**: car exports of the main car-making countries, car imports of
  Georgia's re-export markets, EU registrations by fuel.
- **Advice**: add / hold / reduce signals by fuel type, model and brand,
  excise rules and data sources.

## Data sources (all official, free, no account)

| Source | What |
|---|---|
| Geostat vehicle statistics (automobile.geostat.ge, data service autoapi.geostat.ge) | Registrations by brand, model, fuel, body, engine, age, colour, region (quarterly from 2017); fleet; vehicle imports new vs used; fuel prices |
| UN Comtrade (comtradeapi.un.org) | Georgia's customs data (HS 8703) by fuel/engine type and country, monthly; world exporters and re-export markets, yearly |
| Geostat PxWeb database (pc-axis.geostat.ge) | GDP growth, inflation, average salary |
| National Bank of Georgia (nbg.gov.ge) | Official exchange rates, policy rate decisions |
| World Bank (api.worldbank.org) | Yearly indicators for Georgia |
| Eurostat | EU new-car registrations by fuel |

Geostat allows free reuse of its data with credit to Geostat. The app
refreshes when opened (Geostat and customs data older than 3 days, economy
data older than 1 day) or when you tap the refresh button.

The excise rules and the world carmaker table are fixed values from research
done in November 2026.

## Getting the APK

Every push to `main` builds the app on GitHub Actions and publishes
`GeorgiaCarMarket.apk` under **Releases → latest**. Open that page on your
phone, download the APK and open it. Android asks once to allow installs
from your browser.

## iPhone (home-screen web app)

Every push also publishes the same app as a web app on GitHub Pages:
**https://ffusa1.github.io/georgia-car-app/**. On an iPhone open it in Safari,
tap **Share → Add to Home Screen**. It opens full screen with its own icon and
updates itself.

Brands, Models, Market mix, Economy and EU registrations work there. UN Comtrade
data (Overview, Imports by fuel, Countries, world exports) and the NBG policy
rate block requests from web pages, so they need a relay: put the relay's
address in `RELAY` in `index.html` (for example
`https://<name>.workers.dev/?u=`). Until then those parts say "Android app only".

## Keeping updates installable

Android only installs an update over an existing app if both are signed with
the same key. Without a saved key, every build gets a new one, so you would
have to uninstall the old app first. To keep one key, add a repository secret
named `KEYSTORE_B64` holding a base64-encoded Android debug keystore
(alias `androiddebugkey`, passwords `android`).

## Project layout

- `app/src/main/assets/index.html`: page layout, design, customs data, charts
- `app/src/main/assets/geo.js`: Geostat registrations (brands, models, market mix, model signals)
- `app/src/main/assets/macro.js`: economy data
- `app/src/main/assets/world.js`: international market
- `app/src/main/java/ge/carmarket/app/MainActivity.java`: shows the page and downloads data for it (only from the hosts above)
- `.github/workflows/build.yml`: cloud build
