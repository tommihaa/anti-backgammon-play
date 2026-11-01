# Anti-Backgammon

Play Anti-Backgammon in the browser against a neural network, with the doubling cube and move
analysis.

**Play:** https://tommihaa.github.io/anti-backgammon-play/

Anti-Backgammon is backgammon where the first player to leave the game gets penalty points.
Board, dice and movement are normal backgammon. Leaving means bearing off the last checker or
resigning, and it costs the cube value. There are no gammons. The match is played to seven penalty
points with the Crawford rule, and a game still running after 300 rows is a draw. The full rules
are on the page.

After each of your moves the page compares it with the network's best move, using the network's
own evaluation, and shows the difference in cubeless equity. At the end of a game you see the
total error and the biggest errors.

The page has no build step and no dependencies. Everything runs in the browser. The game engine, the network and the training are developed in a private repository
with Claude Code. This repository contains only what the page needs.
