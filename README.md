# Anti-Backgammon

Play Anti-Backgammon in the browser against a neural network, with the doubling cube and move
analysis.

**Play:** https://tommihaa.github.io/anti-backgammon-play/

Anti-Backgammon is backgammon where the first player to leave the game gets penalty points.
Board, dice and movement are normal backgammon. Leaving means bearing off the last checker or
resigning, and it costs the cube value. There are no gammons. The match is played to seven penalty
points with the Crawford rule, and a game still running after 300 rows is a draw. You can offer a
draw before rolling, and the bot offers one only when the game is stuck. A Crawford game that ends
in a draw is replayed. The full rules are on the page.

After each of your moves the page compares it with the network's best move, using the network's
own evaluation, and shows the difference to it and the network's top three moves. The bot plays
at 0, 1 or 2 ply, and the analysis uses the same depth. At the end of a game you see the total
error and the biggest errors. Finished games stay under Played games below the board with a
table of both players' moves and cube decisions: the cubeless win chance, the network's choice
and the difference to it.

The board follows DG Android: seven board styles, mirroring, a portrait board on narrow screens,
dark mode, sounds and optional playing toggles. Positions can be copied and set as XGID. Import
match reads a DailyGammon export (.mat) or an .sgf file with the positions marked in DG Android,
steps through it and lets you play on from any position against the bot.

The page has no build step and no dependencies. Everything runs in the browser. The game engine, the network and the training are developed in a private repository
with Claude Code. This repository contains only what the page needs.
