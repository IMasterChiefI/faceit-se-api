import express from 'express';
import { COMPETITION_ID } from './avg';
import { findUserProfile, getPlayerMatchHistory } from '../util/user_util';
import { handleError } from '../server';

export const statsRoute = express.Router();

// Route: /stats/:playerName
statsRoute.get('/:playerName', (req, res) => {
  findUserProfile(req.params.playerName)
    .then((player) => {
      if (!player) {
        res.send(
          `Spieler ${req.params.playerName} wurde nicht gefunden. Groß- und Kleinschreibung im Nicknamen ist wichtig.`
        );
        return;
      }

      if (!player.playsCS2) {
        res.send(`Dieser Spieler hat noch nie CS2 auf FACEIT gespielt.`);
        return;
      }

      // Standardmäßig: heute ab 00:00 Uhr
      let startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      let size = 100;

      // Optional: ?startDate=[timestamp] erlaubt Rückgriff auf mehr Matches
      if (req.query.startDate && !isNaN(Number(req.query.startDate))) {
        startDate = new Date(Number(req.query.startDate));
        size = 500;
      }

      // Match-Historie abrufen
      getPlayerMatchHistory(player.id, size)
        .then((matches) => {
          if (matches.length === 0) {
            res.send('Keine passenden Matches gefunden, um Statistiken zu berechnen.');
            return;
          }

          let wins = 0;
          let losses = 0;

          // Filter: nur heutige (bzw. ab Startdatum) und aus gewünschter Competition
          const todayMatches = matches.filter(
            (match) =>
              startDate.getTime() <= match.created_at &&
              match.competitionId === COMPETITION_ID
          );

          // Restliche Matches zur ELO-Vergleichsbasis
          matches = matches.filter(
            (match) =>
              !todayMatches.includes(match) &&
              match.competitionId === COMPETITION_ID
          );

          let eloDiff = 0;
          if (todayMatches.length > 0) {
            let startElo = parseInt(todayMatches[todayMatches.length - 1].elo);
            if (matches.length > 0) {
              startElo = parseInt(matches[0].elo);
            }
            eloDiff = player.elo - startElo;

            for (const match of todayMatches) {
              if (match.i2 === match.teamId) {
                wins += 1;
              } else {
                losses++;
              }
            }
          }

          // Ausgabeformat
          let format =
            (req.query.format as string | undefined) ||
            `LVL: $lvl, ELO: $elo ($diff), Matches: $winsW / $lossesL`;

          format = format
            .replace('$name', player.username)
            .replace('$lvl', String(player.level))
            .replace('$elo', String(player.elo))
            .replace('$diff', String(eloDiff > 0 ? `+${eloDiff}` : eloDiff))
            .replace('$wins', String(wins))
            .replace('$losses', String(losses));

          res.send(format);
        })
        .catch((err) => {
          handleError(err, res);
        });
    })
    .catch((err) => {
      handleError(err, res);
    });
});
