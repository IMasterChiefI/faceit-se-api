import express from 'express';
import { findUserProfile, getPlayerMatchStatsBulk } from '../util/user_util';
import { handleError } from '../server';

export const avgRoute = express.Router();

// FACEIT-Turnier-ID für CS2
export const COMPETITION_ID = 'f4148ddd-bce8-41b8-9131-ee83afcdd6dd';

// Route: /avg/:playerName – berechnet Durchschnittswerte der letzten ~30 CS2-Matches
avgRoute.get('/:playerName', (req, res) => {
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

      getPlayerMatchStatsBulk(player.id)
        .then((matches_stats) => {
          // Filter: nur CS2-Matches mit der richtigen Competition-ID
          matches_stats = matches_stats.filter(
            (match) => match.stats['Competition Id'] === COMPETITION_ID
          );

          if (matches_stats.length === 0) {
            res.send(`Es wurden keine Spiele gefunden, aus denen ein Durchschnitt berechnet werden kann.`);
            return;
          }

          let kills = 0;
          let kd = 0;
          let kr = 0;
          let headshots = 0;
          let adr = 0;
          let matches = 0;

          for (const match of matches_stats) {
            if (matches >= 30) continue; // Max. 30 Matches
            kills += parseInt(match.stats.Kills);
            kd += parseFloat(match.stats['K/D Ratio']);
            kr += parseFloat(match.stats['K/R Ratio']);
            headshots += parseFloat(match.stats['Headshots %']);
            if (match.stats['ADR']) adr += parseFloat(match.stats['ADR']);
            matches++;
          }

          // Ausgabeformat
          let format =
            (req.query.format as string | undefined) ||
            `LVL: $lvl, Kills: $kills, K/D: $kd, K/R: $kr, ADR: $adr, Headshotrate: $hspercent`;

          // Platzhalter ersetzen
          format = format
            .replace('$name', player.username)
            .replace('$lvl', String(player.level))
            .replace('$kills', String(round(kills / matches)))
            .replace('$kd', String(round(kd / matches)))
            .replace('$kr', String(round(kr / matches)))
            .replace('$adr', String(round(adr / matches)))
            .replace('$hspercent', String(round(headshots / matches) + '%'));

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

// Hilfsfunktion zum Runden auf 2 Nachkommastellen
function round(number: number) {
  return Math.floor(number * 100) / 100;
}
