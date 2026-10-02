# Games

Simple, big-print games for Android phones. The app opens to a home screen listing every game. The first game is **Word Garden**, a 5-letter word guessing game.

## What's in this folder

| Folder | What it is | How often you'll touch it |
|---|---|---|
| `web/` | **The home screen and all the games.** All the code you'll normally change. Published as the games website. | Often |
| `android/` | The Android app "shell" that shows the games full-screen. Open this folder in Android Studio to build a new app file. | Rarely |
| `signing/` | The app's signing key. **Back this up and never share it or upload it.** Every update must be signed with this exact key, or the phone will refuse it. | Never edit |

### Inside `web/`

```
web/
  index.html      the home screen (the first thing the app shows)
  sw.js           offline helper: saved copy on the phone + updates (no need to edit)
  home.css        how the home screen looks
  home.js         builds the game cards (no need to edit)
  games.js        THE LIST OF GAMES - add new games here
  shared/
    theme.css     colors and fonts used by every screen
    ui.css        parts every game shares: top bar, buttons, pop-up panels
    offline.js    turns on the offline helper on every screen
    fonts/        font files, so it all works without internet
  games/
    word-garden/
      index.html  what's on the game screen
      style.css   how the game looks
      words.js    the secret word list
      game.js     the rules: guesses, hints, streak, give up
      icon.png    picture on the home screen card
    word-builder/
      index.html  what's on the game screen
      style.css   how the game looks
      puzzles.js  the puzzles (one line each) - add more here
      game.js     the rules: spelling words, hints, give up
      icon.png    picture on the home screen card
```

## Adding a new game

1. Make a new folder in `web/games/` (for example `web/games/number-puzzle/`).
   Copying the `word-garden` folder is an easy starting point.
2. In the new game's `index.html`, keep the three style lines at the top
   (`../../shared/theme.css`, `../../shared/ui.css`, then `style.css`) and the
   house button, so it looks like the rest and can get back home.
3. Put an `icon.png` in the folder (a square picture, about 192 x 192).
4. Add an entry for it in `web/games.js`.

The home screen picks it up automatically.

## Trying changes on your computer

1. In VS Code, install the **Live Server** extension (VS Code will suggest it).
2. Open `web/index.html` (the home screen), right-click inside it, and choose **Open with Live Server**.
3. It opens in your browser and refreshes every time you save a file.
4. To see it at phone size: press **F12**, then click the phone/tablet icon at the top of the panel that opens.

## How updates reach the phones

The app loads the games from the games website (GitHub Pages), which is
made from the `web` folder. Each phone keeps a saved copy, so the games
work offline, and picks up changes whenever it's online.

To send out a change to anything in `web`:

1. Save your changes in VS Code and try them with Live Server.
2. Open **Source Control** (the branch icon on the left), type a short
   note about what you changed, click **Commit**, then **Sync Changes**.
3. GitHub publishes it in about a minute (watch the **Actions** tab on
   github.com). Phones get it the next time the app opens with internet.

No new app file is needed for game changes. `.github/workflows/publish.yml`
does the publishing, and `web/sw.js` is the offline helper on the phone.

## Making a new app file (only for changes in the `android` folder)

Only needed if you change the app itself: its name, icon, or the website
address in `MainActivity.java`.

1. Open the `android` folder in **Android Studio** (File → Open).
2. In `android/app/build.gradle`, raise `versionCode` by 1.
3. Choose **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. The new file appears in `android/app/build/outputs/apk/`. Send it to the phone and tap **Update**. Stats and progress are kept.

## Rules that keep updates working

- Keep the `signing` folder safe. Losing the key means anyone with the app has to uninstall (and lose their stats) before a new version can be installed.
- Never change `applicationId` in `android/app/build.gradle`.
- Always raise `versionCode` for each new version.
- Turn on two-step sign-in for your GitHub account: whatever is published there is what the app shows.
