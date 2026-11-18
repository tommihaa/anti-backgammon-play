# Changelog

Changes to the Anti-Backgammon board at https://tommihaa.github.io/anti-backgammon-play/.
The version is shown next to the title. A new feature raises the middle number and a fix the
last one.

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
