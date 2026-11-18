// Laudan verkon sukulinja ja sivuhaarat (Tommi 18.11.2026: botin nimestä pitää nähdä historia ja
// miksi joku verkko ei edennyt; valintaperuste on "number go up"). Näytetään otsikon alla verkon
// nimen takana. Luvut ovat mittauskappaleista Kaanon/Anti-Backgammon/mittaukset/01, 02, 04, 05, 06,
// 07 ja 14. Rivi päivitetään samassa commitissa kuin laudan verkko (NET_FILE, src/ui.mjs).
//
// s on rivin tila: 'up' luku nousi ja verkko eteni, 'held' verkko eteni tasoissa edeltäjänsä kanssa
// opettajaksi tai pohjaksi, 'not' luku ei noussut eikä verkko edennyt.

// Laudan verkon lyhyt nimi botin nimeen. Avain on verkon tiedosto.
export const NET_SHORT = { 'verkot/jatko-raw-g4-p3000.json': 'g4-jatko' };

const LINE = {
  fi: [
    ['Sääntöbotit', '25.10.2026', 'up', 'Käsin kirjoitettu arvio: pip-ero ja ulos pelatun nappulan hinta. Syvyys 2, joka laskee vastustajan pakkosiirrot, voitti syvyys 1:n: 42 vs. 358 rangaistuspistettä.'],
    ['Hautaussakko', '27.10.2026', 'up', 'Tommin periaate arvioon: haudattu nappula maksaa 3 pippiä. Sai 81 % voitoista syvyys 2:ta vastaan (38 vs. 162 rangaistuspistettä).'],
    ['td-feat', '27.10.2026', 'up', 'Ensimmäinen neuroverkko: TD-itsepeli, syötteenä asema ja Tommin periaatteet piirteinä (haudatut, kotipisteet, miinat, 6-piste ja pip-luku). Voitti hautaussakon 190–10. Laudan vastustaja 30.10. asti.'],
    ['g1', '27.10.2026', 'held', 'Vertailuopetus: syötteenä pelkkä asema, opettajana td-feat 1-plyllä. Paras oppilas sai 52 % rangaistuspisteistä opettajaa vastaan eli pääsi tasolle mutta ei ohi. Siitä tuli seuraavan sukupolven opettaja.'],
    ['g2', '30.10.2026', 'up', 'Opettajana g1 2-plyllä. Sai 42 % rangaistuspisteistä opettajaa vastaan ja 43 % td-featia vastaan. Ensimmäinen pelkän aseman verkko, joka voitti periaateverkon. Laudan vastustaja 30.10.'],
    ['g3', '31.10.–3.11.2026', 'up', 'Opettajana g2 3-plyllä, 30 opetuskierrosta. Sai 39 % rangaistuspisteistä opettajaa vastaan.'],
    ['g4', '4.11.2026', 'held', 'Opettajana g3 3-plyllä. Sai 48,5 % rangaistuspisteistä opettajaa vastaan 2000 pelissä eli pääsi tasolle. Siitä tuli jatko-opetuksen pohja.'],
    ['g4-jatko', '6.11.2026', 'up', 'g4:n opetusta jatkettiin 60 000 tallennetulla asemalla ja 3000 viimeistelykerralla. Voittaa g3:n otteluista rajaan 7 69 % 0-plyllä ja 66 % 2-plyllä. Laudan verkko 6.11.2026 alkaen.'],
  ],
  en: [
    ['Rule bots', '25 Oct 2026', 'up', 'A hand-written evaluation: pip difference and the price of a borne-off checker. Depth 2, which counts the opponent\'s forced moves, beat depth 1: 42 vs. 358 penalty points.'],
    ['Burial penalty', '27 Oct 2026', 'up', 'Tommi\'s principle in the evaluation: a buried checker costs 3 pips. It won 81% against depth 2 (38 vs. 162 penalty points).'],
    ['td-feat', '27 Oct 2026', 'up', 'The first neural network: TD self-play, with the board and Tommi\'s principles as features (buried checkers, home points, mines, the 6-point and the pip count). It beat the burial penalty bot 190 to 10. The board\'s opponent until 30 October.'],
    ['g1', '27 Oct 2026', 'held', 'Teacher training: board-only input, td-feat at 1-ply as the teacher. The best student got 52% of the penalty points against the teacher, so it reached its level but did not pass it. It became the next generation\'s teacher.'],
    ['g2', '30 Oct 2026', 'up', 'g1 at 2-ply as the teacher. It got 42% of the penalty points against the teacher and 43% against td-feat. The first board-only network to beat the principle network. The board\'s opponent from 30 October.'],
    ['g3', '31 Oct to 3 Nov 2026', 'up', 'g2 at 3-ply as the teacher, 30 training rounds. It got 39% of the penalty points against the teacher.'],
    ['g4', '4 Nov 2026', 'held', 'g3 at 3-ply as the teacher. It got 48.5% of the penalty points against the teacher in 2000 games, so it reached its level. It became the base for further training.'],
    ['g4-jatko', '6 Nov 2026', 'up', 'g4\'s training was continued ("jatko") on 60,000 stored positions with 3000 fine-tuning passes. It wins 69% of matches to 7 against g3 at 0-ply and 66% at 2-ply. The board\'s network since 6 November 2026.'],
  ],
  de: [
    ['Regelbots', '25.10.2026', 'up', 'Eine von Hand geschriebene Bewertung: Pip-Differenz und der Preis eines abgetragenen Steins. Tiefe 2, die die Zwangszüge des Gegners berechnet, schlug Tiefe 1: 42 zu 358 Strafpunkte.'],
    ['Begrabungsstrafe', '27.10.2026', 'up', 'Tommis Prinzip in der Bewertung: Ein begrabener Stein kostet 3 Pips. 81 % Siege gegen Tiefe 2 (38 zu 162 Strafpunkte).'],
    ['td-feat', '27.10.2026', 'up', 'Das erste neuronale Netz: TD-Selbstspiel, Eingabe sind die Stellung und Tommis Prinzipien als Merkmale (begrabene Steine, Heimpunkte, Minen, der 6-Punkt und die Pipzahl). Es schlug den Begrabungsstrafe-Bot 190 zu 10. Gegner auf dem Brett bis zum 30.10.'],
    ['g1', '27.10.2026', 'held', 'Lehrertraining: nur die Stellung als Eingabe, td-feat mit 1-ply als Lehrer. Der beste Schüler bekam 52 % der Strafpunkte gegen den Lehrer, erreichte also dessen Niveau, ohne es zu übertreffen. Er wurde Lehrer der nächsten Generation.'],
    ['g2', '30.10.2026', 'up', 'g1 mit 2-ply als Lehrer. 42 % der Strafpunkte gegen den Lehrer und 43 % gegen td-feat. Das erste Netz nur mit der Stellung als Eingabe, das das Prinzipiennetz schlug. Gegner auf dem Brett ab 30.10.'],
    ['g3', '31.10.–3.11.2026', 'up', 'g2 mit 3-ply als Lehrer, 30 Trainingsrunden. 39 % der Strafpunkte gegen den Lehrer.'],
    ['g4', '4.11.2026', 'held', 'g3 mit 3-ply als Lehrer. 48,5 % der Strafpunkte gegen den Lehrer in 2000 Spielen, also auf dessen Niveau. Es wurde die Grundlage für das Weitertraining.'],
    ['g4-jatko', '6.11.2026', 'up', 'Das Training von g4 wurde („jatko“) mit 60.000 gespeicherten Stellungen und 3000 Feinabstimmungsdurchläufen fortgesetzt. Es gewinnt gegen g3 69 % der Matches bis 7 mit 0-ply und 66 % mit 2-ply. Netz des Bretts seit 6.11.2026.'],
  ],
  fr: [
    ['Bots à règles', '25/10/2026', 'up', 'Une évaluation écrite à la main : écart de pips et prix d\'une dame sortie. La profondeur 2, qui calcule les coups forcés de l\'adversaire, a battu la profondeur 1 : 42 contre 358 points de pénalité.'],
    ['Pénalité d\'enterrement', '27/10/2026', 'up', 'Le principe de Tommi dans l\'évaluation : une dame enterrée coûte 3 pips. 81 % de victoires contre la profondeur 2 (38 contre 162 points de pénalité).'],
    ['td-feat', '27/10/2026', 'up', 'Le premier réseau de neurones : auto-jeu TD, avec la position et les principes de Tommi comme caractéristiques (dames enterrées, points du jan, mines, point 6 et compte de pips). Il a battu le bot à pénalité d\'enterrement 190 à 10. Adversaire du plateau jusqu\'au 30/10.'],
    ['g1', '27/10/2026', 'held', 'Entraînement par un professeur : la position seule en entrée, td-feat à 1-ply comme professeur. Le meilleur élève a pris 52 % des points de pénalité contre le professeur : il a atteint son niveau sans le dépasser. Il est devenu le professeur de la génération suivante.'],
    ['g2', '30/10/2026', 'up', 'g1 à 2-ply comme professeur. 42 % des points de pénalité contre le professeur et 43 % contre td-feat. Le premier réseau sans caractéristiques à battre le réseau à principes. Adversaire du plateau à partir du 30/10.'],
    ['g3', '31/10–3/11/2026', 'up', 'g2 à 3-ply comme professeur, 30 tours d\'entraînement. 39 % des points de pénalité contre le professeur.'],
    ['g4', '4/11/2026', 'held', 'g3 à 3-ply comme professeur. 48,5 % des points de pénalité contre le professeur en 2000 parties : il a atteint son niveau. Il est devenu la base de l\'entraînement prolongé.'],
    ['g4-jatko', '6/11/2026', 'up', 'L\'entraînement de g4 a été prolongé (« jatko ») sur 60 000 positions enregistrées avec 3000 passes d\'affinage. Il gagne 69 % des matchs en 7 contre g3 à 0-ply et 66 % à 2-ply. Réseau du plateau depuis le 6/11/2026.'],
  ],
};

const SIDE = {
  fi: [
    ['Liikkuvuustermit', '27.10.2026', 'not', 'Liikkuvuuseron palkitseminen tai rankaiseminen arviossa. Voitot syvyys 2:ta vastaan jäivät 26 %:iin ja 13 %:iin.'],
    ['Pelkän aseman TD-verkot', '27.10.2026', 'not', 'Jumiutuivat lyöntikierteeseen 1000–1500 itsepelin kohdalla.'],
    ['g2 1-ply-opettajalla', '30.10.2026', 'not', 'Opettajana g1 1-plyllä. 48 % rangaistuspisteistä opettajaa vastaan, ero ei merkitsevä.'],
    ['g3 2-ply-opettajalla', '31.10.2026', 'not', 'Opettajana g2 2-plyllä. 48 % rangaistuspisteistä opettajaa vastaan, ero ei merkitsevä.'],
    ['g4-feat2', '5.11.2026', 'not', 'Kuten g4, mutta syötteenä periaatteet. 49,2 % rangaistuspisteistä g4:ää vastaan 10 000 pelissä, ero ei merkitsevä.'],
    [`g5`, `7.11.2026`, `not`, `Opettajana g4-jatko 3-plyllä ja sama jatko-opetus omalla aineistolla. Suorassa ottelussa tasan opettajan kanssa (49,96 % rangaistuspisteistä), mutta g3:a vastaan heikompi: 41,9 % pisteistä, kun opettaja saa 39,7 %.`],
    [`g5-h`, `7.11.2026`, `not`, `g5 jatko-opetettuna samalla aineistolla kuin opettaja. 49,6 % pisteistä opettajaa vastaan ja 41,4 % g3:a vastaan, joten aineisto ei selittänyt eroa. Opettaja on g5:tä parempi kaikkia kuutta muuta mitattua vastustajaa vastaan.`],
    ['Asemaluokkaverkot', '14.11.2026', 'not', 'Omat verkot kilpajuoksulle, avoimelle kontaktille ja pidolle. Yksikään yhdistelmä ei parantanut g3:a vastaan.'],
    [`g5 DailyGammonissa`, `16.–18.11.2026`, `not`, `Ihmisten DMP-peleissä g5:n virhearviot ennustivat voittajan hieman paremmin (79,7 % peleistä, laudan verkko 78,7 %, 2-ply). Kun verkkojen eri valinnat pelattiin loppuun, laudan verkon siirto oli parempi 51 suurimmassa erimielisyydessä ja g5:n 21:ssä. Keskikokoisissa erimielisyyksissä ne olivat tasoissa (27 ja 20 asemaa).`],
    [`g5:n portti`, `18.11.2026`, `not`, `Ei läpäissyt laudan porttia: arviot olivat vinossa (kalibrointivirhe 5,2 prosenttiyksikköä) ja kuutiorajat 75/20 eivät pitäneet.`],
  ],
  en: [
    ['Mobility terms', '27 Oct 2026', 'not', 'Rewarding or punishing a mobility difference in the evaluation. Wins against depth 2 fell to 26% and 13%.'],
    ['Board-only TD networks', '27 Oct 2026', 'not', 'Got stuck in a hitting loop after 1000–1500 self-play games.'],
    ['g2 with a 1-ply teacher', '30 Oct 2026', 'not', 'g1 at 1-ply as the teacher. 48% of the penalty points against the teacher, not a significant difference.'],
    ['g3 with a 2-ply teacher', '31 Oct 2026', 'not', 'g2 at 2-ply as the teacher. 48% of the penalty points against the teacher, not a significant difference.'],
    ['g4-feat2', '5 Nov 2026', 'not', 'Like g4 but with the principles as input. 49.2% of the penalty points against g4 in 10,000 games, not a significant difference.'],
    [`g5`, `7 Nov 2026`, `not`, `g4-jatko at 3-ply as the teacher and the same further training on its own data. A tie with the teacher in a direct match (49.96% of the penalty points) but weaker against g3: 41.9% of the points where the teacher gets 39.7%.`],
    [`g5-h`, `7 Nov 2026`, `not`, `g5 trained further on the same data as the teacher. 49.6% of the points against the teacher and 41.4% against g3, so the data did not explain the gap. The teacher is better than g5 against all six other measured opponents.`],
    ['Position class networks', '14 Nov 2026', 'not', 'Separate networks for races, open contact and holding games. No combination improved against g3.'],
    [`g5 on DailyGammon`, `16–18 Nov 2026`, `not`, `In human DMP games g5's error estimates predicted the winner slightly better (79.7% of games, board network 78.7%, 2-ply). When the networks' different choices were played out, the board network's move was better in 51 of the biggest disagreements and g5's in 21. In medium-sized disagreements they were even (27 and 20 positions).`],
    [`g5's gate`, `18 Nov 2026`, `not`, `Failed the board's gate: its estimates were skewed (calibration error 5.2 percentage points) and the 75/20 cube thresholds did not hold.`],
  ],
  de: [
    ['Beweglichkeitsterme', '27.10.2026', 'not', 'Belohnen oder Bestrafen eines Beweglichkeitsunterschieds in der Bewertung. Die Siege gegen Tiefe 2 sanken auf 26 % und 13 %.'],
    ['TD-Netze nur mit der Stellung', '27.10.2026', 'not', 'Blieben nach 1000–1500 Selbstspielen in einer Schlagschleife hängen.'],
    ['g2 mit 1-ply-Lehrer', '30.10.2026', 'not', 'g1 mit 1-ply als Lehrer. 48 % der Strafpunkte gegen den Lehrer, kein signifikanter Unterschied.'],
    ['g3 mit 2-ply-Lehrer', '31.10.2026', 'not', 'g2 mit 2-ply als Lehrer. 48 % der Strafpunkte gegen den Lehrer, kein signifikanter Unterschied.'],
    ['g4-feat2', '5.11.2026', 'not', 'Wie g4, aber mit den Prinzipien als Eingabe. 49,2 % der Strafpunkte gegen g4 in 10.000 Spielen, kein signifikanter Unterschied.'],
    [`g5`, `7.11.2026`, `not`, `g4-jatko mit 3-ply als Lehrer und dasselbe Weitertraining mit eigenen Daten. Im direkten Match gleichauf mit dem Lehrer (49,96 % der Strafpunkte), aber schwächer gegen g3: 41,9 % der Punkte, der Lehrer 39,7 %.`],
    [`g5-h`, `7.11.2026`, `not`, `g5 weitertrainiert mit denselben Daten wie der Lehrer. 49,6 % der Punkte gegen den Lehrer und 41,4 % gegen g3, die Daten erklärten den Abstand also nicht. Der Lehrer ist gegen alle sechs anderen gemessenen Gegner besser als g5.`],
    ['Stellungsklassen-Netze', '14.11.2026', 'not', 'Eigene Netze für Rennen, offenen Kontakt und Haltespiele. Keine Kombination war gegen g3 besser.'],
    [`g5 auf DailyGammon`, `16.–18.11.2026`, `not`, `In menschlichen DMP-Spielen sagten die Fehlerschätzungen von g5 den Sieger etwas besser voraus (79,7 % der Spiele, Netz des Bretts 78,7 %, 2-ply). Als die unterschiedlichen Wahlen der Netze ausgespielt wurden, war der Zug des Brett-Netzes in 51 der größten Meinungsverschiedenheiten besser und der von g5 in 21. Bei mittelgroßen waren sie gleichauf (27 und 20 Stellungen).`],
    [`Tor für g5`, `18.11.2026`, `not`, `Bestand das Tor des Bretts nicht: Die Schätzungen waren verzerrt (Kalibrierungsfehler 5,2 Prozentpunkte), und die Würfelschwellen 75/20 hielten nicht.`],
  ],
  fr: [
    ['Termes de mobilité', '27/10/2026', 'not', 'Récompenser ou punir un écart de mobilité dans l\'évaluation. Les victoires contre la profondeur 2 sont tombées à 26 % et 13 %.'],
    ['Réseaux TD sans caractéristiques', '27/10/2026', 'not', 'Bloqués dans une boucle de frappes après 1000 à 1500 parties en auto-jeu.'],
    ['g2 avec un professeur à 1-ply', '30/10/2026', 'not', 'g1 à 1-ply comme professeur. 48 % des points de pénalité contre le professeur, écart non significatif.'],
    ['g3 avec un professeur à 2-ply', '31/10/2026', 'not', 'g2 à 2-ply comme professeur. 48 % des points de pénalité contre le professeur, écart non significatif.'],
    ['g4-feat2', '5/11/2026', 'not', 'Comme g4, mais avec les principes en entrée. 49,2 % des points de pénalité contre g4 en 10 000 parties, écart non significatif.'],
    [`g5`, `7/11/2026`, `not`, `g4-jatko à 3-ply comme professeur et le même entraînement prolongé sur ses propres données. À égalité avec le professeur en match direct (49,96 % des points de pénalité) mais plus faible contre g3 : 41,9 % des points quand le professeur en prend 39,7 %.`],
    [`g5-h`, `7/11/2026`, `not`, `g5 entraîné plus longtemps sur les mêmes données que le professeur. 49,6 % des points contre le professeur et 41,4 % contre g3 : les données n'expliquaient pas l'écart. Le professeur fait mieux que g5 contre les six autres adversaires mesurés.`],
    ['Réseaux par classe de position', '14/11/2026', 'not', 'Des réseaux séparés pour la course, le contact ouvert et le jeu de tenue. Aucune combinaison n\'a fait mieux contre g3.'],
    [`g5 sur DailyGammon`, `16–18/11/2026`, `not`, `Dans les parties DMP humaines, les estimations d'erreur de g5 prédisaient un peu mieux le vainqueur (79,7 % des parties, réseau du plateau 78,7 %, 2-ply). Quand les choix différents des réseaux ont été joués jusqu'au bout, le coup du réseau du plateau était meilleur dans 51 des plus grands désaccords et celui de g5 dans 21. Dans les désaccords moyens, ils étaient à égalité (27 et 20 positions).`],
    [`Porte de g5`, `18/11/2026`, `not`, `N'a pas passé la porte du plateau : ses estimations étaient biaisées (erreur de calibration de 5,2 points de pourcentage) et les seuils de videau 75/20 ne tenaient pas.`],
  ],
};

const TEXT = {
  fi: {
    intro: 'Valintaperuste on number go up: verkko pääsi jatkoon, kun se voitti edeltäjänsä mitatusti. Rangaistuspisteiden osuudessa pienempi on parempi.',
    line: 'Sukulinja', side: 'Eivät edenneet',
    state: { up: 'number went up', held: 'number held', not: 'number didn\'t go up' },
  },
  en: {
    intro: 'The selection rule is number go up: a network went on when it measurably beat its predecessor. In a share of penalty points, smaller is better.',
    line: 'Lineage', side: 'Did not go on',
    state: { up: 'number went up', held: 'number held', not: 'number didn\'t go up' },
  },
  de: {
    intro: 'Das Auswahlkriterium ist number go up: Ein Netz kam weiter, wenn es seinen Vorgänger messbar schlug. Beim Anteil an Strafpunkten ist weniger besser.',
    line: 'Abstammung', side: 'Nicht weitergekommen',
    state: { up: 'number went up', held: 'number held', not: 'number didn\'t go up' },
  },
  fr: {
    intro: 'Le critère de sélection est number go up : un réseau passait à la suite quand il battait son prédécesseur de façon mesurée. Pour une part de points de pénalité, plus petit est meilleur.',
    line: 'Lignée', side: 'Non retenus',
    state: { up: 'number went up', held: 'number held', not: 'number didn\'t go up' },
  },
};

// Historia kielellä lang: { intro, line, side, state, lineage, branches }. Rivi on
// { name, date, state, text }.
export function netHistory(lang) {
  const l = TEXT[lang] ? lang : 'en';
  const rows = list => list.map(([name, date, state, text]) => ({ name, date, state, text }));
  return { ...TEXT[l], lineage: rows(LINE[l]), branches: rows(SIDE[l]) };
}
