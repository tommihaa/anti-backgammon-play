# Changelog

Changes to the Anti-Backgammon board at https://tommihaa.github.io/anti-backgammon-play/.
The version is shown next to the title. A new feature raises the middle number and a fix the
last one.

## [0.11.1] - 2026-11-26

### Fixed

- The import texts no longer speak of a .mat file. A DailyGammon export saves as a .txt file,
  and the Evaluation panel hint, the Import match file field, its error message and Help now say
  so. The field already accepted .txt files and pasted text.

## [0.11.0] - 2026-11-26

### Added

- Analyse at 3-ply below a move's evaluation recomputes the move at 3-ply, which looks one roll
  further than 2-ply. The result is its own table and does not change the error total, the PR
  or the move list colours. One move takes about 20 seconds on a computer and about a minute on
  a phone, and it runs in the background while you browse.
- Ctrl-click or Cmd-click in the Game panel's list selects several moves for a 3-ply analysis.
  The game summary has a button that queues all your errors at once, also on a touch screen.

### Fixed

- A game played before 25 November showed the bot as g4-jatko. It is the same network as g4-ft
  and is now shown with that name.

## [0.10.1] - 2026-11-25

### Changed

- New home screen icon in the Deco style: a raccoon on the doubling cube, the sibling of the
  DG Android icon on teal felt. The raccoon is tough and stays on the board. The browser tab
  shows the same icon.

## [0.10.0] - 2026-11-25

### Added

- Edit position under Position (XGID) opens the position on the board for editing: the game,
  a move being reviewed or the selected row, with its turn, roll, cube and match score. Cancel
  returns to the game or the review.
- When creating or editing a position, the left mouse button places your checkers and the right
  button the opponent's, as in XG. The colour choice stays for touch screens.

### Changed

- A created position is a one-point match (DMP) by default instead of the length of the match
  being played.

### Fixed

- A one-point match shows no cube, neither while creating the position nor in the review of a
  created or imported one-point match.

## [0.9.0] - 2026-11-25

### Added

- Create position under Position (XGID) opens an empty board for setting up a position of your
  own. Checkers are placed by clicking with the chosen colour: the height of the click sets the
  number of checkers on the point, and clicking the top checker removes it. Turn, roll, cube and
  match score are set in the form, and Analyse opens the position for analysis.

### Fixed

- The roll map no longer fails when the browser still has the previous version's bot cached.

## [0.8.1] - 2026-11-25

### Changed

- The version next to the title is a link to this changelog, and so is the mention of
  CHANGELOG.md in the Help text.

## [0.8.0] - 2026-11-25

### Added

- All moves (0-ply) under a move's evaluation lists every legal move with its win chance, equity
  and difference to the best move. The list is a 0-ply evaluation of its own, so its numbers are
  not compared directly with the deeper analysis above it.
- A roll map under a move's evaluation shows all 36 rolls as a grid. Each cell is the luck of that
  roll for the mover, blue for lucky and brown for unlucky, and the roll that came is framed.
  Hovering over a cell shows the roll's best move. The map is computed at 1-ply, and a button
  computes it at 2-ply, which takes 15 to 35 seconds. The 1-ply map stays on screen meanwhile.
- An External engine field under Settings > Playing. It is for engine developers: with the
  address of an engine bridge on your own computer, that engine makes the bot's moves, doubles,
  takes and answers to draw offers. An empty field keeps the board's own bot.

### Changed

- The bot's network is now called g4-ft (fine-tuned) instead of the Finnish g4-jatko.
- With the Deco board the headings, point numbers and cube use the Poiret One typeface, as in the
  Deco theme of the DG Android app.

## [0.7.0] - 2026-11-25

### Added

- A new switch under Settings > Playing: Roll automatically when I can't double. It is off by
  default. When it is on, your turn starts with a roll in the Crawford game (also in a 1-point
  match) and when the bot owns the cube or it is at 64. When you can double, Roll waits as
  before. On those turns you can't offer a draw before the roll. The arrows for the bot's move
  stay until your first checker move.

## [0.6.1] - 2026-11-25

### Fixed

- Dragging a checker now works on touch screens, including the installed app. Before, the page
  started to scroll under your finger and the drag was cancelled.

## [0.6.0] - 2026-11-24

### Added

- You can drag a checker to the point where it should go. The move uses the dice that take that
  checker there, so one drag can play both dice. To bear off, drop the checker on the tray. A
  short tap still moves the checker by one die as before.
- Before your first move, the Evaluation panel tells you how to analyse a DailyGammon match:
  export it as a .mat file and open Settings > Import match.

### Changed

- The default board style is now Deco. If you have chosen a style yourself, the board keeps it.

## [0.5.1] - 2026-11-24

### Added

- The HTML export marks the luck of the roll in each move's heading with the same +, ++, − and −−
  marks and limits as the move list.

## [0.5.0] - 2026-11-24

### Added

- The move list marks the luck of the roll at the end of the line, as GNU Backgammon does: + for
  a lucky roll and ++ for a very lucky one, − and −− for the unlucky ones. A roll is marked when
  it is at least 0.08 (++ at 0.16) equity better or worse than the average roll. The limits are
  lower than GNU Backgammon's 0.3 and 0.6, because in Anti-Backgammon the dice swing the equity
  less.

### Changed

- Moves in the move list get their colours during the game as soon as they are analysed, not
  only when the game ends. Your moves are coloured in Tutor mode and the bot's moves with Analyse
  the bot's moves during the game.

## [0.4.0] - 2026-11-24

### Added

- Settings has a new switch, Analyse the bot's moves during the game. When it is on, a bot move
  shows its analysis as soon as you pick it from the move list. The bot does not reply more
  slowly, but at 2-ply the analysis of your own move may come a moment later.

### Changed

- During a game the Evaluation panel shows the same as after it: winning chances, equity, the
  difference to the best move, the luck of the roll and the evaluation of cube decisions. The
  analysis now also tells you during the game whether to double. Your own decisions show in
  Tutor mode, and the bot's decisions with the new switch.

### Fixed

- A 1-point match no longer shows the doubling cube after the page is reloaded.
- A Crawford game interrupted by reloading the page is played again as a Crawford game, without
  the cube.

## [0.3.0] - 2026-11-24

### Added

- Player cards above and below the board on every screen: the name, the penalty points and who is
  to move. When you review an imported match or a position link, the cards show the players and
  score of that game.
- A position link carries the bot that played, its network and depth. The reader sees the same
  bot as the opponent, and the analysis uses that depth.

### Changed

- Copy link appears when you pick a played move from the move list, also during a game. For the
  bot's moves the analysis still waits until the game ends.
- The portrait board setting is gone. It only placed the player cards, which are now always shown.

### Fixed

- Play from here works for a position link without dice.

## [0.2.2] - 2026-11-24

### Changed

- Copy link in the Evaluation panel appears when the game has ended, at the same time as the
  analysis of the bot's moves. It works for your moves and the bot's moves alike. During a game
  the tutor still shows your own moves, without the link.

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
