import express from 'express';
import {
  findUserProfile,
  getMatchStatsV4,
  getPlayerMatchHistory,
  MatchStatsTeam,
} from '../util/user_util';
import { handleError } from '../server';
import { COMPETITION_ID } from './avg';

export const lastRoute = express.Router();

// Route: /last/:playerName – liefert detaillierte Statistiken zum letzten CS2-Match
lastRoute.get('/:playerName', (req, res) => {
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

      getPlayerMatchHistory(player.id)
        .then((matches) => {
          // Filter auf gültige Matches mit ELO oder Competition
          matches = matches.filter(
            (match) => match.elo || match.competitionId === COMPETITION_ID
          );

          if (matches.length === 0) {
            res.send('Es wurde kein Match gefunden, aus dem Statistiken berechnet werden können.');
            return;
          }

          // Hole detaillierte Matchstatistiken vom letzten Match
          getMatchStatsV4(matches[0].matchId)
            .then((matchStats) => {
              let playersTeam: MatchStatsTeam | undefined = undefined;
              let enemyTeam: MatchStatsTeam | undefined = undefined;

              // Spielerteam ermitteln
              if (
                matchStats.rounds[0].teams[0].players.find(
                  (player1) => player1.player_id === player.id
                )
              ) {
                playersTeam = matchStats.rounds[0].teams[0];
                enemyTeam = matchStats.rounds[0].teams[1];
              } else if (
                matchStats.rounds[0].teams[1].players.find(
                  (player1) => player1.player_id === player.id
                )
              ) {
                playersTeam = matchStats.rounds[0].teams[1];
                enemyTeam = matchStats.rounds[0].teams[0];
              }

              if (!playersTeam || !enemyTeam) {
                res.send('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
                return;
              }

              const playerStats = playersTeam.players.find(
                (p) => p.player_id === player.id
              );

              // Ausgabeformat
              let format =
                (req.query.format as string | undefined) ||
                `Karte: $map, Ergebnis: $score ($result), ELO: $diff, Kills: $kills ($hspercent% HS), Tode: $deaths, K/D: $kd, ADR: $adr`;

              // ELO-Differenz berechnen
              const eloDiff =
                matches.length >= 2
                  ? isNaN(parseInt(matches[0].elo))
                    ? player.elo - parseInt(matches[1].elo)
                    : parseInt(matches[0].elo) - parseInt(matches[1].elo)
                  : 0;

              // Platzhalter ersetzen
              format = format
                .replace('$name', player.username)
                .replace(
                  '$result',
                  matchStats.rounds[0].round_stats.Winner === playersTeam.team_id
                    ? 'Sieg'
                    : 'Niederlage'
                )
                .replace('$map', matchStats.rounds[0].round_stats.Map)
                .replace('$score', matchStats.rounds[0].round_stats.Score)
                .replace('$kills', String(playerStats.player_stats.Kills))
                .replace('$assists', String(playerStats.player_stats.Assists))
                .replace('$deaths', String(playerStats.player_stats.Deaths))
                .replace('$adr', String(playerStats.player_stats.ADR))
                .replace('$kd', String(playerStats.player_stats['K/D Ratio']))
                .replace('$kr', String(playerStats.player_stats['K/R Ratio']))
                .replace('$hspercent', String(playerStats.player_stats['Headshots %']))
                .replace('$diff', eloDiff > 0 ? `+${eloDiff}` : String(eloDiff));

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
