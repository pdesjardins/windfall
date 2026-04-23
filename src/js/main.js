// SPDX-License-Identifier: MIT

import { generateTerrain } from './engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, neighbors, inBounds, hexToIndex } from './engine/hex.js';
import { initGame, moveShip, disembarkCrew, embarkCrew, moveCrew, endPlayerTurn } from './engine/game.js';
import { pointOfSail, moveApCost, SHIP_MOVE_BUDGET } from './engine/wind.js';
import * as renderer from './ui/renderer.js';

const canvas        = document.getElementById('game-canvas');
const btnNewGame    = document.getElementById('btn-new-game');
const btnSave       = document.getElementById('btn-save');
const btnEndTurn    = document.getElementById('btn-end-turn');
const elTurnNum     = document.getElementById('turn-number');
const elUnitInfo    = document.getElementById('unit-info');
const elStatusInfo  = document.getElementById('status-info');
const elWindWrapper = document.getElementById('wind-face-wrapper');
const elWindLabel   = document.getElementById('wind-label');

// Named for where wind comes FROM (standard convention).
// wind.dir is the leeward index, so the windward source is (dir+3)%6.
const WIND_NAMES     = ['SW', 'NW', 'N', 'NE', 'SE', 'S'];
// Rotate the face so its plumes point toward the leeward direction (where wind goes).
const WIND_CSS_ANGLE = [330, 30, 90, 150, 210, 270];
const SAIL_NAMES     = ['In irons', 'Close reach', 'Broad reach', 'Running'];

let game      = null;
let terrain   = null;

// selection: null | { type: 'ship' } | { type: 'crew', id: number }
let selection     = null;
let _autoEndTimer = null;

// Pan state
let dragging   = false;
let dragStart  = { x: 0, y: 0 };
let dragMoved  = 0;

canvas.addEventListener('mousedown', e => {
  dragging  = true;
  dragStart = { x: e.clientX, y: e.clientY };
  dragMoved = 0;
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  dragStart = { x: e.clientX, y: e.clientY };
  renderer.pan(dx, dy);
});

window.addEventListener('mouseup', e => {
  if (!dragging) return;
  dragging = false;
  if (game) canvas.style.cursor = 'grab';
  if (dragMoved < 4) handleClick(e.clientX, e.clientY);
});

window.addEventListener('resize', () => renderer.render());

let devFogOff = false;
window.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    devFogOff = !devFogOff;
    renderer.setDevFog(devFogOff);
  }
});

function onBeforeUnload(e) {
  e.preventDefault();
}

// --- helpers ---

// Dijkstra path from ship to (targetQ, targetR), using moveApCost weights.
// Returns array of {q,r} steps or null if unreachable within remaining budget.
function findShipPath(targetQ, targetR) {
  const { q: sq, r: sr } = game.playerShip;
  const budget = game.playerShip.ap;

  // dist map: index → cheapest cost to reach
  const dist  = new Map([[hexToIndex(sq, sr, MAP_WIDTH), 0]]);
  const prev  = new Map();
  // min-heap via sorted array (small enough maps)
  const queue = [[0, sq, sr]]; // [cost, q, r]

  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, cq, cr] = queue.shift();
    if (cost > (dist.get(hexToIndex(cq, cr, MAP_WIDTH)) ?? Infinity)) continue;
    if (cq === targetQ && cr === targetR) {
      // reconstruct
      const path = [];
      let key = hexToIndex(targetQ, targetR, MAP_WIDTH);
      while (prev.has(key)) {
        const [pq, pr] = prev.get(key);
        path.unshift({ q: pq === sq && pr === sr ? targetQ : pq, r: pq === sq && pr === sr ? targetR : pr });
        key = hexToIndex(pq, pr, MAP_WIDTH);
      }
      // Simpler: rebuild from start
      return reconstructPath(prev, sq, sr, targetQ, targetR);
    }
    const nbrs = neighbors(cq, cr);
    for (let dir = 0; dir < 6; dir++) {
      const stepCost = moveApCost(game.wind.dir, dir);
      if (!isFinite(stepCost)) continue;
      const [nq, nr] = nbrs[dir];
      if (!inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT)) continue;
      if (terrain[hexToIndex(nq, nr, MAP_WIDTH)] !== 'ocean') continue;
      const newCost = cost + stepCost;
      if (newCost > budget) continue;
      const idx = hexToIndex(nq, nr, MAP_WIDTH);
      if (newCost < (dist.get(idx) ?? Infinity)) {
        dist.set(idx, newCost);
        prev.set(idx, [cq, cr]);
        queue.push([newCost, nq, nr]);
      }
    }
  }
  return null;
}

function reconstructPath(prev, sq, sr, targetQ, targetR) {
  const path = [];
  let key = hexToIndex(targetQ, targetR, MAP_WIDTH);
  const startKey = hexToIndex(sq, sr, MAP_WIDTH);
  while (key !== startKey) {
    const coords = coordsFromIndex(key);
    path.unshift({ q: coords.q, r: coords.r });
    const [pq, pr] = prev.get(key);
    key = hexToIndex(pq, pr, MAP_WIDTH);
  }
  return path.length > 0 ? path : null;
}

function coordsFromIndex(idx) {
  return { q: idx % MAP_WIDTH, r: Math.floor(idx / MAP_WIDTH) };
}

function shipMoveTargets() {
  if (!game.crew.some(c => c.aboard)) return [];
  const { q: sq, r: sr } = game.playerShip;
  const budget  = game.playerShip.ap;
  if (budget <= 0) return [];

  const dist    = new Map([[hexToIndex(sq, sr, MAP_WIDTH), 0]]);
  const queue   = [[0, sq, sr]];
  const reachable = [];

  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, cq, cr] = queue.shift();
    const key = hexToIndex(cq, cr, MAP_WIDTH);
    if (cost > (dist.get(key) ?? Infinity)) continue;
    const nbrs = neighbors(cq, cr);
    for (let dir = 0; dir < 6; dir++) {
      const stepCost = moveApCost(game.wind.dir, dir);
      if (!isFinite(stepCost)) continue;
      const [nq, nr] = nbrs[dir];
      if (!inBounds(nq, nr, MAP_WIDTH, MAP_HEIGHT)) continue;
      if (terrain[hexToIndex(nq, nr, MAP_WIDTH)] !== 'ocean') continue;
      const newCost = cost + stepCost;
      if (newCost > budget) continue;
      const idx = hexToIndex(nq, nr, MAP_WIDTH);
      if (newCost < (dist.get(idx) ?? Infinity)) {
        dist.set(idx, newCost);
        reachable.push({ q: nq, r: nr });
        queue.push([newCost, nq, nr]);
      }
    }
  }
  return reachable;
}

function disembarkTargets() {
  // Shore hexes adjacent to the ship where a crew member could step off.
  // Requires ship AP > 0 so that a spent ship shows no highlighted options at all.
  // (Disembark still works mechanically if player clicks a shore hex directly.)
  if (game.playerShip.ap < 1) return [];
  const ship = game.playerShip;
  const hasAboardCrew = game.crew.some(c => c.aboard && c.ap >= 1);
  if (!hasAboardCrew) return [];
  return neighbors(ship.q, ship.r)
    .filter(([q, r]) => {
      if (!inBounds(q, r, MAP_WIDTH, MAP_HEIGHT)) return false;
      const t = terrain[hexToIndex(q, r, MAP_WIDTH)];
      if (t === 'ocean' || t === 'mountain') return false;
      // Unoccupied by crew already on land
      return !game.crew.some(c => !c.aboard && c.q === q && c.r === r);
    })
    .map(([q, r]) => ({ q, r }));
}

function crewMoveTargets(crew) {
  if (crew.ap < 1) return [];
  const targets = [];
  // Adjacent land hexes (unoccupied)
  for (const [q, r] of neighbors(crew.q, crew.r)) {
    if (!inBounds(q, r, MAP_WIDTH, MAP_HEIGHT)) continue;
    const t = terrain[hexToIndex(q, r, MAP_WIDTH)];
    if (t === 'ocean' || t === 'mountain') continue;
    if (game.crew.some(c => c.id !== crew.id && !c.aboard && c.q === q && c.r === r)) continue;
    targets.push({ q, r });
  }
  // Also highlight ship hex if adjacent (embark)
  const ship = game.playerShip;
  const adjToShip = neighbors(crew.q, crew.r)
    .some(([nq, nr]) => nq === ship.q && nr === ship.r);
  if (adjToShip) targets.push({ q: ship.q, r: ship.r });
  return targets;
}

function crewAtHex(q, r) {
  return game.crew.find(c => !c.aboard && c.q === q && c.r === r);
}

// True when no unit has any actionable move remaining this turn.
// Aboard crew are excluded: disembark requires ship AP, which is already 0.
function allOptionsSpent() {
  if (!game) return false;
  if (shipMoveTargets().length > 0) return false;
  return !game.crew.some(c => !c.aboard && c.ap > 0);
}

function setStatus(msg) {
  if (!elStatusInfo) return;
  elStatusInfo.innerHTML = msg
    ? `<p>${msg}</p>`
    : '<p class="placeholder-text">Start a new game to begin.</p>';
}

function cancelAutoEnd() {
  if (_autoEndTimer) { clearTimeout(_autoEndTimer); _autoEndTimer = null; }
  setStatus('');
}

function maybeAutoEndTurn() {
  if (!allOptionsSpent() || _autoEndTimer) return;
  setStatus('All moves spent…');
  _autoEndTimer = setTimeout(() => {
    _autoEndTimer = null;
    if (!game || !allOptionsSpent()) { setStatus(''); return; }
    endPlayerTurn(game, MAP_WIDTH, MAP_HEIGHT);
    syncRenderer();
    autoSelect();
    setStatus('');
  }, 800);
}

function syncRenderer() {
  renderer.updateFog(game.fog);
  renderer.updateShips([game.playerShip]);
  renderer.updateCrew(game.crew);
  updateWindDisplay();
}

function updateWindDisplay() {
  if (!game) return;
  if (elWindWrapper) {
    elWindWrapper.style.transform = `rotate(${WIND_CSS_ANGLE[game.wind.dir]}deg)`;
  }
  if (elWindLabel) {
    elWindLabel.textContent = `${WIND_NAMES[game.wind.dir]} wind`;
  }
}

function updatePanel() {
  if (elTurnNum) elTurnNum.textContent = game ? game.turn : '—';
  if (!elUnitInfo) return;
  if (!game || !selection) {
    elUnitInfo.innerHTML = '<p class="placeholder-text">No unit selected.</p>';
    return;
  }
  if (selection.type === 'ship') {
    const aboard   = game.crew.filter(c => c.aboard).length;
    const pos      = pointOfSail(game.wind.dir, game.playerShip.direction);
    const sailName = SAIL_NAMES[pos];
    elUnitInfo.innerHTML =
      `<p><strong>Resolution</strong></p>` +
      `<p>Crew: ${aboard} / ${game.crew.length}</p>` +
      `<p>Wind: ${WIND_NAMES[game.wind.dir]}</p>` +
      `<p>${sailName} — ${Math.floor(game.playerShip.ap / 2)} AP</p>`;
    return;
  }
  if (selection.type === 'crew') {
    const c = game.crew.find(c => c.id === selection.id);
    if (c) {
      elUnitInfo.innerHTML =
        `<p><strong>Crew ${c.id + 1}</strong></p>` +
        `<p>AP: ${c.ap} / 2</p>`;
    }
  }
}

function deselect() {
  selection = null;
  renderer.updateSelection(null, []);
  updatePanel();
}

function autoSelect() {
  selection = { type: 'ship' };
  renderer.updateSelection(selection, [...shipMoveTargets(), ...disembarkTargets()]);
  updatePanel();
}

// --- click handler ---

function handleClick(px, py) {
  if (!game) return;

  const rect = canvas.getBoundingClientRect();
  const hex  = renderer.pixelToHex(px - rect.left, py - rect.top);
  const { q, r } = hex;
  const ship = game.playerShip;

  if (!selection) {
    // Select ship
    if (q === ship.q && r === ship.r) {
      selection = { type: 'ship' };
      renderer.updateSelection(selection, [...shipMoveTargets(), ...disembarkTargets()]);
      updatePanel();
      return;
    }
    // Select crew on land
    const crew = crewAtHex(q, r);
    if (crew && crew.ap > 0) {
      selection = { type: 'crew', id: crew.id };
      renderer.updateSelection(selection, crewMoveTargets(crew));
      updatePanel();
      return;
    }
    return;
  }

  if (selection.type === 'ship') {
    // Try to move ship to adjacent ocean hex (spends ship AP, does not end turn)
    if (terrain[hexToIndex(q, r, MAP_WIDTH)] === 'ocean') {
      const targets = shipMoveTargets();
      if (targets.some(t => t.q === q && t.r === r)) {
        // Try direct move first; if not adjacent, path there automatically.
        if (!moveShip(game, q, r, terrain, MAP_WIDTH, MAP_HEIGHT)) {
          const path = findShipPath(q, r);
          if (path) for (const step of path) moveShip(game, step.q, step.r, terrain, MAP_WIDTH, MAP_HEIGHT);
        }
        syncRenderer();
        renderer.updateSelection(selection, [...shipMoveTargets(), ...disembarkTargets()]);
        updatePanel();
        maybeAutoEndTurn();
        return;
      }
    }
    // Try to disembark crew to adjacent land hex
    const aboardCrew = game.crew.find(c => c.aboard && c.ap >= 1);
    if (aboardCrew) {
      const result = disembarkCrew(game, aboardCrew.id, q, r, terrain, MAP_WIDTH, MAP_HEIGHT);
      if (result) {
        syncRenderer();
        renderer.updateSelection(selection, [...shipMoveTargets(), ...disembarkTargets()]);
        updatePanel();
        maybeAutoEndTurn();
        return;
      }
    }
    deselect();
    return;
  }

  if (selection.type === 'crew') {
    const crew = game.crew.find(c => c.id === selection.id);
    if (!crew) { deselect(); return; }

    // Try to embark (clicked ship hex)
    if (q === ship.q && r === ship.r) {
      const result = embarkCrew(game, crew.id, MAP_WIDTH, MAP_HEIGHT);
      if (result) {
        syncRenderer();
        deselect();
        maybeAutoEndTurn();
        return;
      }
    }

    // Try to move crew on land
    const result = moveCrew(game, crew.id, q, r, terrain, MAP_WIDTH, MAP_HEIGHT);
    if (result) {
      syncRenderer();
      if (crew.ap > 0) {
        renderer.updateSelection(selection, crewMoveTargets(crew));
        updatePanel();
      } else {
        deselect();
      }
      maybeAutoEndTurn();
      return;
    }

    // Click on a different crew unit with AP — switch selection
    const other = crewAtHex(q, r);
    if (other && other.id !== crew.id && other.ap > 0) {
      selection = { type: 'crew', id: other.id };
      renderer.updateSelection(selection, crewMoveTargets(other));
      updatePanel();
      return;
    }

    deselect();
  }
}

// --- End Turn ---

// Pass = skip ship move; fog resets, AP resets, turn advances without moving
btnEndTurn.addEventListener('click', () => {
  if (!game) return;
  cancelAutoEnd();
  endPlayerTurn(game, MAP_WIDTH, MAP_HEIGHT);
  syncRenderer();
  autoSelect();
});

// --- New Game ---

btnNewGame.addEventListener('click', () => {
  cancelAutoEnd();
  const seed = Math.floor(Math.random() * 0xffffffff);
  terrain    = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  game       = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  selection  = null;

  renderer.init(canvas, terrain, game.fog, [game.playerShip], MAP_WIDTH, MAP_HEIGHT);
  renderer.updateCrew(game.crew);
  updateWindDisplay();
  autoSelect();
  setStatus('');

  btnSave.disabled    = false;
  btnEndTurn.disabled = false;
  canvas.style.cursor = 'grab';

  window.addEventListener('beforeunload', onBeforeUnload);
});
