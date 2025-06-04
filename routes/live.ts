import express from 'express';
import { handleError } from '../server';
import {
  findUserProfile,
  getMatchV2,
  getPlayerOngoingMatchId,
} from '../util/user_util';

export const liveRoute = express.Router();

// Route: /live/:playerName
liveRoute.get('/:playerName', (req, res) => {
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

      getPlayerOngoingMatchId(player.id)
        .then((matchId) => {
          if (!matchId) {
            res.send(`${req.params.playerName} spielt aktuell kein Match.`);
            return;
          }

          getMatchV2(matchId)
            .then((match) => {
              // Falls ?m= leer ist → Weiterleitung zum FACEIT-Raum
              if (req.query.m === '') {
                res.redirect(`https://www.faceit.com/pl/cs2/room/${matchId}`);
                return;
              }

              // Standard-Textformat, wenn keines übergeben wird
              let format =
                (req.query.format as string | undefined) ||
                `Karte: $map, Team: $team, Ergebnis: $team1 ($team1elo ELO) $team1result:$team2result $team2 ($team2elo ELO), Raum: $matchroom`;

              // ELO-Berechnung Team 1
              let team1Elo = 0;
              for (const player of match.teams.faction1.roster) {
                team1Elo += player.elo;
              }

              // ELO-Berechnung Team 2
              let team2Elo = 0;
              for (const player of match.teams.faction2.roster) {
                team2Elo += player.elo;
              }

              // Team-Zuordnung für den angefragten Spieler
              let playerTeam = 1;
              if (
                match.teams.faction1.roster.filter(
                  (player1) => player1.id === player.id
                ).length === 0
              ) {
                playerTeam = 2;
              }

              // Platzhalter ersetzen
              format = format
                .replace('$name', player.username)
                .replace('$map', match.voting.map.pick[0])
                .replace(
                  '$team1elo',
                  String(
                    Math.round(team1Elo / match.teams.faction1.roster.length)
                  )
                )
                .replace(
                  '$team1result',
                  match.results
                    ? String(match.results[0].factions.faction1.score)
                    : '0'
                )
                .replace(
                  '$team',
                  (match.teams as any)[`faction${playerTeam}`].name
                )
                .replace('$team1', match.teams.faction1.name)
                .replace(
                  '$team2elo',
                  String(
                    Math.round(team2Elo / match.teams.faction2.roster.length)
                  )
                )
                .replace(
                  '$team2result',
                  match.results
                    ? String(match.results[0].factions.faction2.score)
                    : '0'
                )
                .replace('$team2', match.teams.faction2.name)
                .replace(
                  '$matchroom',
                  `https://www.faceit.com/pl/cs2/room/${matchId}`
                );

              res.send(format);
            })
            .catch((err) => {
              handleError(err, res);
            });
        })
        .catch((err) => {
          handleError(err, res);
        });
    })
    .catch((err) => {
      handleError(err, res);
    });
});
