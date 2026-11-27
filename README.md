# Georgia Car Market

A one-screen Android app that shows Georgia's passenger car market:
imports, re-exports, fuel and engine types, origin and destination countries,
and add / hold / reduce stock signals.

The app downloads its own data every time you open it (if the saved data is
more than 3 days old) or tap **Refresh**. The data comes from the free
[UN Comtrade](https://comtradeapi.un.org/) service, which holds Georgia's
customs figures as reported by Geostat (HS code 8703, passenger cars).
New months appear about two months after they end.

Brand and model figures, and the excise table, are fixed values from research
done in November 2026: no free live source publishes them.

## Getting the APK

Every push to `main` builds the app on GitHub Actions and publishes
`GeorgiaCarMarket.apk` under **Releases → latest**. Open that page on your
phone, download the APK and open it. Android asks once to allow installs
from your browser.

## Keeping updates installable

Android only installs an update over an existing app if both are signed with
the same key. Without a saved key, every build gets a new one, so you would
have to uninstall the old app first. To keep one key, add a repository secret
named `KEYSTORE_B64` holding a base64-encoded Android debug keystore
(alias `androiddebugkey`, passwords `android`).

## Project layout

- `app/src/main/assets/index.html` — the whole dashboard (HTML, CSS, JavaScript)
- `app/src/main/java/ge/carmarket/app/MainActivity.java` — shows the page and downloads data for it
- `.github/workflows/build.yml` — cloud build
