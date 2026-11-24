# Changelog

Changes to the Anti-Backgammon board at https://tommihaa.github.io/anti-backgammon-play/.
The version is shown next to the title. A new feature raises the middle number and a fix the
last one.

## [0.2.1] - 2026-11-24

### Fixed

- Position links are short enough for the DailyGammon forum, which wraps a message at about 72
  characters and broke the old links. A link now looks like
  http://tommihaa.github.io/abg/#E-YngAxVcg-ADA.a36ifnh.1c and stays under 72 characters. It no
  longer carries player names. Links from version 0.2.0 still open.

## [0.2.0] - 2026-11-24

### Added

- Position links. Copy link in the Evaluation panel gives a link to the analysed move: the
  position, the dice and the move played. Copy link under Settings > Position (XGID) gives a link
  to the current position. The link opens the position for review. The Evaluation panel shows the
  network's best moves and how far the played move was from the best. Without dice it shows the
  winning chance and the network's cube decision. Play from here starts a game against the bot
  from the linked position.

## [0.1.1] - 2026-11-24

### Changed

- The rules now say under The idea who loses the match: the player who first reaches the agreed
  penalty point limit.
- The rules on the cube say that passing is resigning: the player who passes loses the game and
  gets penalty points equal to the current cube value.

## [0.1.0] - 2026-11-18

First numbered version. It covers everything published since 1 November 2026 and these
changes from the last days:

### Added

- The title line shows the version. Under it the name of the network you play against is a link
  that opens its description and history: the lineage from the first rule bots to the board's
  network and the networks that did not go on (the rule is number go up).
- Your name in Settings > Playing shows on the score card, in the Evaluation panel and in the HTML and
  analysis file exports. The bot is named after its network and depth, for example g4-jatko 2-ply.
- Settings > Playing shows the network in use and explains how it differs from the bot's
  depth: the network judges positions, and the depth is how far the bot calculates with it.
- On your turn you can mark the position on the board before you move. The mark goes with your
  next decision.
- Cube decisions show the equities of no double, double/take and double/pass for the doubler
  (Janowski model, cube efficiency 0.8), in the Evaluation panel and in the HTML export.

### Fixed

- A cube decision in a played game had the title "undefined" in the HTML export.
- A cube decision is numbered with the doubler's next roll, so it comes right before that roll.
