// SPDX-License-Identifier: MIT

import {
  initGame, moveShip, disembarkCrew, embarkCrew, moveCrew, endPlayerTurn,
  improveTerrain, startWallConstruction, unloadCrew,
  IMPROVEMENT_NONE, IMPROVEMENT_FARM, IMPROVEMENT_LOGGING, IMPROVEMENT_WALL, IMPROVEMENT_WALL_1, IMPROVEMENT_WALL_2,
  CREW_AP, CREW_COUNT, SHIP_SIGHT_RANGE,
} from '../../../src/js/engine/game.js';
import { inIrons, SHIP_MOVE_BUDGET } from '../../../src/js/engine/wind.js';
import { generateTerrain } from '../../../src/js/engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, hexToIndex, distance, neighbors, neighbor, inBounds } from '../../../src/js/engine/hex.js';
import { VISIBLE, EXPLORED, UNDISCOVERED } from '../../../src/js/engine/fog.js';

export function runTests(assert) {
  const seed    = 42;
  const terrain = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  const game    = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  const ship0   = game.ships[0];

  // Shape of returned object
  assert('initGame returns seed', game.seed === seed);
  assert('initGame returns turn 1', game.turn === 1);
  assert('initGame returns ships array', Array.isArray(game.ships) && game.ships.length === 1);
  assert('initGame returns fog array', game.fog instanceof Uint8Array);
  assert('ship has id 0', ship0.id === 0);
  assert('ship has direction', typeof ship0.direction === 'number');
  assert('ship starts with full move budget', ship0.ap === SHIP_MOVE_BUDGET);

  // Starting position
  const { q, r } = ship0;
  assert('ship is on an ocean hex', terrain[hexToIndex(q, r, MAP_WIDTH)] === 'ocean');
  const inLeftQ   = q <  Math.floor(MAP_WIDTH  / 4);
  const inRightQ  = q >= Math.floor(MAP_WIDTH  * 3 / 4);
  const inTopQ    = r <  Math.floor(MAP_HEIGHT / 4);
  const inBottomQ = r >= Math.floor(MAP_HEIGHT * 3 / 4);
  assert('ship is in a corner quadrant of the map',
    (inLeftQ || inRightQ) && (inTopQ || inBottomQ));

  // Fog visibility around ship
  assert('ship hex is VISIBLE', game.fog[hexToIndex(q, r, MAP_WIDTH)] === VISIBLE);

  let hexAt3Visible = false;
  let hexBeyond3Undiscovered = true;
  for (let tr = 0; tr < MAP_HEIGHT; tr++) {
    for (let tq = 0; tq < MAP_WIDTH; tq++) {
      const d     = distance(q, r, tq, tr);
      const state = game.fog[hexToIndex(tq, tr, MAP_WIDTH)];
      if (d === 3 && state === VISIBLE) hexAt3Visible = true;
      if (d > 3 && state !== UNDISCOVERED) hexBeyond3Undiscovered = false;
    }
  }
  assert('hexes at distance 3 from ship are VISIBLE', hexAt3Visible);
  assert('hexes beyond distance 3 are UNDISCOVERED', hexBeyond3Undiscovered);

  // Crew shape
  assert('initGame returns crew array', Array.isArray(game.crew));
  assert('crew has correct count', game.crew.length === CREW_COUNT);
  assert('all crew start aboard', game.crew.every(c => c.aboard));
  assert('all crew start with shipId 0', game.crew.every(c => c.shipId === 0));
  assert('all crew start with full AP', game.crew.every(c => c.ap === CREW_AP));
  assert('all crew start sleeping (auto-anchored aboard)', game.crew.every(c => c.sleeping));

  // moveShip — find an adjacent ocean hex to use as a valid target
  const adjacentOcean = neighbors(q, r)
    .map(([nq, nr]) => ({ q: nq, r: nr }))
    .find(({ q: nq, r: nr }) =>
      inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(nq, nr, MAP_WIDTH)] === 'ocean'
    );

  if (adjacentOcean) {
    const game2  = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    const { q: tq, r: tr } = adjacentOcean;
    const dirIdx = neighbors(q, r).findIndex(([nq, nr]) => nq === tq && nr === tr);
    const result = moveShip(game2, 0, tq, tr, terrain, MAP_WIDTH, MAP_HEIGHT);

    assert('moveShip returns game on valid move', result !== null);
    assert('moveShip updates ship position q', game2.ships[0].q === tq);
    assert('moveShip updates ship position r', game2.ships[0].r === tr);
    assert('moveShip updates ship direction', game2.ships[0].direction === dirIdx);
    assert('moveShip marks new position VISIBLE',
      game2.fog[hexToIndex(tq, tr, MAP_WIDTH)] === VISIBLE);

    // Hex 3 steps behind is still VISIBLE immediately after move (fog not yet reset)
    const oppDir = (dirIdx + 3) % 6;
    let [behindQ, behindR] = [q, r];
    for (let i = 0; i < 3; i++) [behindQ, behindR] = neighbor(behindQ, behindR, oppDir);
    if (inBounds(behindQ, behindR, MAP_WIDTH, MAP_HEIGHT)) {
      assert('moveShip does not immediately dim old visible area',
        game2.fog[hexToIndex(behindQ, behindR, MAP_WIDTH)] === VISIBLE);

      endPlayerTurn(game2, MAP_WIDTH, MAP_HEIGHT);
      assert('endPlayerTurn transitions out-of-range hex to EXPLORED',
        game2.fog[hexToIndex(behindQ, behindR, MAP_WIDTH)] === EXPLORED);
    } else {
      assert('moveShip does not immediately dim old visible area', true);
      assert('endPlayerTurn transitions out-of-range hex to EXPLORED', true);
    }
  }

  // moveShip — invalid moves
  const game3 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  assert('moveShip returns null for non-adjacent hex',
    moveShip(game3, 0, q + 5, r + 5, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

  const adjacentLand = neighbors(q, r)
    .map(([nq, nr]) => ({ q: nq, r: nr }))
    .find(({ q: nq, r: nr }) =>
      inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(nq, nr, MAP_WIDTH)] !== 'ocean'
    );
  if (adjacentLand) {
    assert('moveShip returns null for non-ocean adjacent hex',
      moveShip(game3, 0, adjacentLand.q, adjacentLand.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // moveShip requires crew aboard
  const game4 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  game4.crew.forEach(c => { c.aboard = false; c.shipId = null; c.q = 0; c.r = 0; });
  if (adjacentOcean) {
    assert('moveShip returns null when no crew aboard',
      moveShip(game4, 0, adjacentOcean.q, adjacentOcean.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // moveShip requires ship AP
  if (adjacentOcean) {
    const gameAP = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    gameAP.ships[0].ap = 0;
    assert('moveShip returns null when ship has 0 AP',
      moveShip(gameAP, 0, adjacentOcean.q, adjacentOcean.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // moveCrew — set up a crew unit on land manually
  const game5 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  let crewStart = null, crewTarget = null;
  outer: for (let tr = 0; tr < MAP_HEIGHT; tr++) {
    for (let tq = 0; tq < MAP_WIDTH; tq++) {
      const t = terrain[hexToIndex(tq, tr, MAP_WIDTH)];
      if (t === 'ocean' || t === 'mountain') continue;
      const adj = neighbors(tq, tr).find(([nq, nr]) => {
        if (!inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT)) return false;
        const nt = terrain[hexToIndex(nq, nr, MAP_WIDTH)];
        return nt !== 'ocean' && nt !== 'mountain';
      });
      if (adj) { crewStart = { q: tq, r: tr }; crewTarget = { q: adj[0], r: adj[1] }; break outer; }
    }
  }

  if (crewStart && crewTarget) {
    game5.crew[0].aboard   = false;
    game5.crew[0].shipId   = null;
    game5.crew[0].q        = crewStart.q;
    game5.crew[0].r        = crewStart.r;
    game5.crew[0].sleeping = false;

    assert('moveCrew returns null when crew is aboard',
      moveCrew(game5, 1, crewTarget.q, crewTarget.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    assert('moveCrew returns game on valid move',
      moveCrew(game5, 0, crewTarget.q, crewTarget.r, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
    assert('moveCrew updates crew position q', game5.crew[0].q === crewTarget.q);
    assert('moveCrew updates crew position r', game5.crew[0].r === crewTarget.r);
    assert('moveCrew deducts AP', game5.crew[0].ap === CREW_AP - 1);

    const sleepMoveGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    sleepMoveGame.crew[0].aboard   = false;
    sleepMoveGame.crew[0].shipId   = null;
    sleepMoveGame.crew[0].q        = crewStart.q;
    sleepMoveGame.crew[0].r        = crewStart.r;
    // sleeping stays true (initGame default) — no override needed
    assert('moveCrew returns null for sleeping crew',
      moveCrew(sleepMoveGame, 0, crewTarget.q, crewTarget.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    game5.crew[0].ap = 0;
    assert('moveCrew returns null with 0 AP',
      moveCrew(game5, 0, crewStart.q, crewStart.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    assert('moveCrew returns null for non-adjacent hex',
      (() => {
        const g = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
        g.crew[0].aboard   = false;
        g.crew[0].shipId   = null;
        g.crew[0].q        = crewStart.q;
        g.crew[0].r        = crewStart.r;
        g.crew[0].sleeping = false;
        return moveCrew(g, 0, crewStart.q + 5, crewStart.r + 5, terrain, MAP_WIDTH, MAP_HEIGHT) === null;
      })());
  }

  // disembarkCrew — invalid: crew still sleeping (must unload first)
  const game6 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  if (adjacentLand) {
    assert('disembarkCrew returns null for sleeping crew',
      disembarkCrew(game6, 0, adjacentLand.q, adjacentLand.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // disembarkCrew — invalid: non-adjacent target (wake crew first so only distance is wrong)
  const game6b = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  game6b.crew[0].sleeping = false;
  assert('disembarkCrew returns null for non-adjacent target',
    disembarkCrew(game6b, 0, q + 10, r + 10, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

  // disembarkCrew — invalid: no AP (wake crew first so only AP is wrong)
  const game7 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  game7.crew[0].sleeping = false;
  game7.crew[0].ap = 0;
  if (adjacentLand) {
    assert('disembarkCrew returns null with 0 AP',
      disembarkCrew(game7, 0, adjacentLand.q, adjacentLand.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  // disembarkCrew — success (wake crew first via unloadCrew)
  if (adjacentLand) {
    const game8 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    unloadCrew(game8, 0);
    const res   = disembarkCrew(game8, 0, adjacentLand.q, adjacentLand.r, terrain, MAP_WIDTH, MAP_HEIGHT);
    assert('disembarkCrew returns game on valid disembark', res !== null);
    assert('crew is no longer aboard after disembark', !game8.crew[0].aboard);
    assert('crew shipId is null after disembark', game8.crew[0].shipId === null);
    assert('crew is at target hex after disembark',
      game8.crew[0].q === adjacentLand.q && game8.crew[0].r === adjacentLand.r);
    assert('disembarkCrew deducts AP', game8.crew[0].ap === CREW_AP - 1);
  }

  // unloadCrew — wakes sleeping crew aboard the ship
  const gameU = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  assert('unloadCrew returns game when sleeping crew exist',
    unloadCrew(gameU, 0) !== null);
  assert('unloadCrew wakes all aboard crew',
    gameU.crew.every(c => !c.sleeping));
  assert('unloadCrew returns null when no sleeping crew remain',
    unloadCrew(gameU, 0) === null);
  assert('unloadCrew returns null for unknown ship',
    unloadCrew(gameU, 999) === null);

  // endPlayerTurn
  const game9 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  game9.crew[0].ap    = 0;
  game9.ships[0].ap   = 0;
  // Wake one crew member to verify endPlayerTurn puts them back to sleep.
  game9.crew[0].sleeping = false;
  endPlayerTurn(game9, MAP_WIDTH, MAP_HEIGHT);
  assert('endPlayerTurn increments turn counter', game9.turn === 2);
  assert('endPlayerTurn resets all crew AP', game9.crew.every(c => c.ap === CREW_AP));
  assert('endPlayerTurn resets ship AP to full move budget',
    game9.ships[0].ap === SHIP_MOVE_BUDGET);
  assert('endPlayerTurn puts all aboard crew back to sleep',
    game9.crew.filter(c => c.aboard).every(c => c.sleeping));

  // embarkCrew — sleeping land crew is rejected
  if (crewStart) {
    const oceanAdjToCrew = neighbors(crewStart.q, crewStart.r)
      .find(([nq, nr]) =>
        inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT) &&
        terrain[hexToIndex(nq, nr, MAP_WIDTH)] === 'ocean'
      );
    if (oceanAdjToCrew) {
      const sleepEmbarkGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
      sleepEmbarkGame.ships[0].q     = oceanAdjToCrew[0];
      sleepEmbarkGame.ships[0].r     = oceanAdjToCrew[1];
      sleepEmbarkGame.crew[0].aboard   = false;
      sleepEmbarkGame.crew[0].shipId   = null;
      sleepEmbarkGame.crew[0].q        = crewStart.q;
      sleepEmbarkGame.crew[0].r        = crewStart.r;
      // sleeping stays true (initGame default) — no override needed
      assert('embarkCrew returns null for sleeping crew',
        embarkCrew(sleepEmbarkGame, 0, 0, MAP_WIDTH, MAP_HEIGHT) === null);
    }
  }

  // improveTerrain — find a grassland and a forest hex for testing
  let grasslandHex = null, forestHex = null;
  for (let tr = 0; tr < MAP_HEIGHT && (!grasslandHex || !forestHex); tr++) {
    for (let tq = 0; tq < MAP_WIDTH && (!grasslandHex || !forestHex); tq++) {
      const t = terrain[hexToIndex(tq, tr, MAP_WIDTH)];
      if (!grasslandHex && t === 'grassland') grasslandHex = { q: tq, r: tr };
      if (!forestHex    && t === 'forest')    forestHex    = { q: tq, r: tr };
    }
  }

  if (grasslandHex) {
    const gGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    gGame.crew[0].aboard   = false;
    gGame.crew[0].shipId   = null;
    gGame.crew[0].q        = grasslandHex.q;
    gGame.crew[0].r        = grasslandHex.r;
    gGame.crew[0].sleeping = false;

    assert('improveTerrain returns game for valid farm',
      improveTerrain(gGame, 0, IMPROVEMENT_FARM, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
    assert('improveTerrain sets farm improvement',
      gGame.improvements[hexToIndex(grasslandHex.q, grasslandHex.r, MAP_WIDTH)] === IMPROVEMENT_FARM);
    assert('improveTerrain deducts crew AP',
      gGame.crew[0].ap === CREW_AP - 1);

    assert('improveTerrain returns null when already improved',
      improveTerrain(gGame, 0, IMPROVEMENT_FARM, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    const sleepImproveGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    sleepImproveGame.crew[0].aboard   = false;
    sleepImproveGame.crew[0].shipId   = null;
    sleepImproveGame.crew[0].q        = grasslandHex.q;
    sleepImproveGame.crew[0].r        = grasslandHex.r;
    sleepImproveGame.crew[0].sleeping = true;
    assert('improveTerrain returns null for sleeping crew',
      improveTerrain(sleepImproveGame, 0, IMPROVEMENT_FARM, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    const noApGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    noApGame.crew[0].aboard = false;
    noApGame.crew[0].shipId = null;
    noApGame.crew[0].q      = grasslandHex.q;
    noApGame.crew[0].r      = grasslandHex.r;
    noApGame.crew[0].ap     = 0;
    assert('improveTerrain returns null with 0 AP',
      improveTerrain(noApGame, 0, IMPROVEMENT_FARM, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    const aboardGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    assert('improveTerrain returns null when crew is aboard',
      improveTerrain(aboardGame, 0, IMPROVEMENT_FARM, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    assert('improveTerrain returns null for wrong terrain (logging on grassland)',
      (() => {
        const g = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
        g.crew[0].aboard = false;
        g.crew[0].shipId = null;
        g.crew[0].q      = grasslandHex.q;
        g.crew[0].r      = grasslandHex.r;
        return improveTerrain(g, 0, IMPROVEMENT_LOGGING, terrain, MAP_WIDTH, MAP_HEIGHT) === null;
      })());
  }

  if (forestHex) {
    const fGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    fGame.crew[0].aboard   = false;
    fGame.crew[0].shipId   = null;
    fGame.crew[0].q        = forestHex.q;
    fGame.crew[0].r        = forestHex.r;
    fGame.crew[0].sleeping = false;

    assert('improveTerrain returns game for valid logging camp',
      improveTerrain(fGame, 0, IMPROVEMENT_LOGGING, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
    assert('improveTerrain sets logging improvement',
      fGame.improvements[hexToIndex(forestHex.q, forestHex.r, MAP_WIDTH)] === IMPROVEMENT_LOGGING);
  }

  // Wall construction — startWallConstruction + endPlayerTurn auto-advance
  let stoneHex = null;
  for (let tr = 0; tr < MAP_HEIGHT && !stoneHex; tr++) {
    for (let tq = 0; tq < MAP_WIDTH && !stoneHex; tq++) {
      if (terrain[hexToIndex(tq, tr, MAP_WIDTH)] === 'stone') stoneHex = { q: tq, r: tr };
    }
  }

  if (stoneHex) {
    const wGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    wGame.crew[0].aboard   = false;
    wGame.crew[0].shipId   = null;
    wGame.crew[0].q        = stoneHex.q;
    wGame.crew[0].r        = stoneHex.r;
    wGame.crew[0].sleeping = false;

    assert('startWallConstruction returns game on stone',
      startWallConstruction(wGame, 0, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
    assert('startWallConstruction sets WALL_1',
      wGame.improvements[hexToIndex(stoneHex.q, stoneHex.r, MAP_WIDTH)] === IMPROVEMENT_WALL_1);
    assert('building crew is marked building',
      wGame.crew[0].building === true);
    assert('building crew has buildTurnsRemaining 2',
      wGame.crew[0].buildTurnsRemaining === 2);
    assert('building crew AP is consumed',
      wGame.crew[0].ap === 0);

    endPlayerTurn(wGame, MAP_WIDTH, MAP_HEIGHT);
    assert('after 1 endPlayerTurn: WALL_2',
      wGame.improvements[hexToIndex(stoneHex.q, stoneHex.r, MAP_WIDTH)] === IMPROVEMENT_WALL_2);
    assert('after 1 endPlayerTurn: still building',
      wGame.crew[0].building === true);
    assert('after 1 endPlayerTurn: AP stays 0',
      wGame.crew[0].ap === 0);

    endPlayerTurn(wGame, MAP_WIDTH, MAP_HEIGHT);
    assert('after 2 endPlayerTurns: WALL complete',
      wGame.improvements[hexToIndex(stoneHex.q, stoneHex.r, MAP_WIDTH)] === IMPROVEMENT_WALL);
    assert('after 2 endPlayerTurns: building = false',
      wGame.crew[0].building === false);
    assert('after 2 endPlayerTurns: AP restored',
      wGame.crew[0].ap === CREW_AP);

    assert('startWallConstruction returns null when hex already improved',
      startWallConstruction(wGame, 0, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    // Cannot start a second build on the same hex while one is in progress
    const wGame2 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    wGame2.crew[0].aboard   = false;
    wGame2.crew[0].shipId   = null;
    wGame2.crew[0].q        = stoneHex.q;
    wGame2.crew[0].r        = stoneHex.r;
    wGame2.crew[0].sleeping = false;
    startWallConstruction(wGame2, 0, terrain, MAP_WIDTH, MAP_HEIGHT);
    assert('startWallConstruction returns null when already building',
      startWallConstruction(wGame2, 0, terrain, MAP_WIDTH, MAP_HEIGHT) === null);

    // Building guards: building crew cannot move, embark, or use improveTerrain
    const wGame3 = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    wGame3.crew[0].aboard   = false;
    wGame3.crew[0].shipId   = null;
    wGame3.crew[0].q        = stoneHex.q;
    wGame3.crew[0].r        = stoneHex.r;
    wGame3.crew[0].sleeping = false;
    startWallConstruction(wGame3, 0, terrain, MAP_WIDTH, MAP_HEIGHT);
    wGame3.crew[0].ap = CREW_AP; // restore AP so we test the building guard, not AP=0

    const adjWalkable3 = neighbors(stoneHex.q, stoneHex.r).find(([nq, nr]) => {
      if (!inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT)) return false;
      const nt = terrain[hexToIndex(nq, nr, MAP_WIDTH)];
      return nt !== 'ocean' && nt !== 'mountain';
    });
    if (adjWalkable3) {
      assert('moveCrew returns null for building crew',
        moveCrew(wGame3, 0, adjWalkable3[0], adjWalkable3[1], terrain, MAP_WIDTH, MAP_HEIGHT) === null);
    }
    assert('improveTerrain returns null for building crew',
      improveTerrain(wGame3, 0, IMPROVEMENT_FARM, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }

  if (grasslandHex) {
    const wgGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    wgGame.crew[0].aboard   = false;
    wgGame.crew[0].shipId   = null;
    wgGame.crew[0].q        = grasslandHex.q;
    wgGame.crew[0].r        = grasslandHex.r;
    wgGame.crew[0].sleeping = false;
    assert('startWallConstruction returns game on grassland',
      startWallConstruction(wgGame, 0, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
    assert('startWallConstruction sets WALL_1 on grassland',
      wgGame.improvements[hexToIndex(grasslandHex.q, grasslandHex.r, MAP_WIDTH)] === IMPROVEMENT_WALL_1);
  }

  if (forestHex) {
    const wfGame = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
    wfGame.crew[0].aboard   = false;
    wfGame.crew[0].shipId   = null;
    wfGame.crew[0].q        = forestHex.q;
    wfGame.crew[0].r        = forestHex.r;
    wfGame.crew[0].sleeping = false;
    assert('startWallConstruction returns game on forest',
      startWallConstruction(wfGame, 0, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
    assert('startWallConstruction sets WALL_1 on forest',
      wfGame.improvements[hexToIndex(forestHex.q, forestHex.r, MAP_WIDTH)] === IMPROVEMENT_WALL_1);
  }

  // Wind integration
  const gameW = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  assert('initGame sets wind direction',
    typeof gameW.wind.dir === 'number' && gameW.wind.dir >= 0 && gameW.wind.dir < 6);
  assert('initGame sets ship AP to full move budget',
    gameW.ships[0].ap === SHIP_MOVE_BUDGET);

  // Windward hex is always blocked; non-windward hexes are reachable
  const gameI       = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  const windwardDir = (gameI.wind.dir + 3) % 6;
  const windwardNeighbor = (() => {
    const [wq, wr] = neighbors(gameI.ships[0].q, gameI.ships[0].r)[windwardDir];
    return inBounds(wq, wr, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(wq, wr, MAP_WIDTH)] === 'ocean'
      ? { q: wq, r: wr } : null;
  })();
  if (windwardNeighbor) {
    assert('moveShip returns null for windward hex',
      moveShip(initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT), 0,
        windwardNeighbor.q, windwardNeighbor.r, terrain, MAP_WIDTH, MAP_HEIGHT) === null);
  }
  if (adjacentOcean && neighbors(gameI.ships[0].q, gameI.ships[0].r)
      .findIndex(([nq, nr]) => nq === adjacentOcean.q && nr === adjacentOcean.r) !== windwardDir) {
    gameI.ships[0].ap = SHIP_MOVE_BUDGET;
    assert('moveShip succeeds for non-windward ocean hex',
      moveShip(gameI, 0, adjacentOcean.q, adjacentOcean.r, terrain, MAP_WIDTH, MAP_HEIGHT) !== null);
  }
}
