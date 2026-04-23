// SPDX-License-Identifier: MIT

import { generateTerrain } from './engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, neighbors, inBounds, hexToIndex } from './engine/hex.js';
import { initGame, moveShip, disembarkCrew, embarkCrew, moveCrew, endPlayerTurn } from './engine/game.js';
import { pointOfSail, moveApCost } from './engine/wind.js';
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

let game     = null;
let terrain  = null;

// selection: null | { type: 'ship', id: number } | { type: 'crew', id: number }
let selection     = null;
// Ordered queue of units with remaining actions this turn.
let pendingUnits  = [];
let _autoEndTimer  = null;
let _advanceTimer  = null; // brief pause before auto-advancing to next unit

// Pan state
let dragging  = false;
let dragStart = { x: 0, y: 0 };
let dragMoved = 0;

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
    return;
  }

  if (!game) return;

  // Space: skip current unit — remove from queue, do not return to it this turn.
  if (e.key === ' ') {
    e.preventDefault();
    if (!selection) return;
    cancelAutoEnd();
    removePending(selection);
    advanceOrDeselect();
    return;
  }

  // F: encamp/anchor — put selected unit to sleep until explicitly woken.
  if (e.key === 'f' || e.key === 'F') {
    if (!selection) return;
    const unit = selection.type === 'ship' ? findShipById(selection.id) : findCrewById(selection.id);
    if (!unit || unit.sleeping) return;
    unit.sleeping = true;
    removePending(selection);
    cancelAdvance();
    advanceOrDeselect();
    return;
  }

  // W: wait — defer current unit to end of queue, act on others first.
  if (e.key === 'w' || e.key === 'W') {
    if (!selection) return;
    const idx = pendingUnits.findIndex(u => u.type === selection.type && u.id === selection.id);
    if (idx !== -1 && pendingUnits.length > 1) {
      cancelAutoEnd();
      const [unit] = pendingUnits.splice(idx, 1);
      pendingUnits.push(unit);
      advanceOrDeselect();
    }
    return;
  }
});

function onBeforeUnload(e) {
  e.preventDefault();
}

// --- Unit lookups ---

function findShipById(id)   { return game.ships.find(s => s.id === id); }
function findCrewById(id)   { return game.crew.find(c => c.id === id); }
function shipAtHex(q, r)    { return game.ships.find(s => s.q === q && s.r === r); }
function crewAtHex(q, r)    { return game.crew.find(c => !c.aboard && c.q === q && c.r === r); }

// --- Movement calculations ---

// Dijkstra path from ship to (targetQ, targetR) within remaining budget.
// Returns array of {q,r} steps or null if unreachable.
function findShipPath(ship, targetQ, targetR) {
  const { q: sq, r: sr } = ship;
  const budget = ship.ap;
  const dist   = new Map([[hexToIndex(sq, sr, MAP_WIDTH), 0]]);
  const prev   = new Map();
  const queue  = [[0, sq, sr]];

  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, cq, cr] = queue.shift();
    if (cost > (dist.get(hexToIndex(cq, cr, MAP_WIDTH)) ?? Infinity)) continue;
    if (cq === targetQ && cr === targetR) return reconstructPath(prev, sq, sr, targetQ, targetR);
    for (let dir = 0; dir < 6; dir++) {
      const stepCost = moveApCost(game.wind.dir, dir);
      if (!isFinite(stepCost)) continue;
      const [nq, nr] = neighbors(cq, cr)[dir];
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
    const q = key % MAP_WIDTH, r = Math.floor(key / MAP_WIDTH);
    path.unshift({ q, r });
    const [pq, pr] = prev.get(key);
    key = hexToIndex(pq, pr, MAP_WIDTH);
  }
  return path.length > 0 ? path : null;
}

function shipMoveTargets(ship) {
  if (!game.crew.some(c => c.aboard && c.shipId === ship.id)) return [];
  const { q: sq, r: sr } = ship;
  const budget = ship.ap;
  if (budget <= 0) return [];

  const dist      = new Map([[hexToIndex(sq, sr, MAP_WIDTH), 0]]);
  const queue     = [[0, sq, sr]];
  const reachable = [];

  while (queue.length > 0) {
    queue.sort((a, b) => a[0] - b[0]);
    const [cost, cq, cr] = queue.shift();
    const key = hexToIndex(cq, cr, MAP_WIDTH);
    if (cost > (dist.get(key) ?? Infinity)) continue;
    for (let dir = 0; dir < 6; dir++) {
      const stepCost = moveApCost(game.wind.dir, dir);
      if (!isFinite(stepCost)) continue;
      const [nq, nr] = neighbors(cq, cr)[dir];
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

function disembarkTargets(ship) {
  if (!game.crew.some(c => c.aboard && c.shipId === ship.id && c.ap >= 1)) return [];
  return neighbors(ship.q, ship.r)
    .filter(([q, r]) => {
      if (!inBounds(q, r, MAP_WIDTH, MAP_HEIGHT)) return false;
      const t = terrain[hexToIndex(q, r, MAP_WIDTH)];
      if (t === 'ocean' || t === 'mountain') return false;
      return !game.crew.some(c => !c.aboard && c.q === q && c.r === r);
    })
    .map(([q, r]) => ({ q, r }));
}

function crewMoveTargets(crew) {
  if (crew.ap < 1) return [];
  const targets = [];
  for (const [q, r] of neighbors(crew.q, crew.r)) {
    if (!inBounds(q, r, MAP_WIDTH, MAP_HEIGHT)) continue;
    const t = terrain[hexToIndex(q, r, MAP_WIDTH)];
    if (t === 'ocean' || t === 'mountain') continue;
    if (game.crew.some(c => c.id !== crew.id && !c.aboard && c.q === q && c.r === r)) continue;
    targets.push({ q, r });
  }
  // Highlight each adjacent ship hex (for embark).
  for (const ship of game.ships) {
    if (neighbors(crew.q, crew.r).some(([nq, nr]) => nq === ship.q && nr === ship.r)) {
      targets.push({ q: ship.q, r: ship.r });
    }
  }
  return targets;
}

// --- Queue and selection ---

function buildTurnQueue() {
  const q = [];
  for (const ship of [...game.ships].sort((a, b) => a.id - b.id)) {
    if (ship.sleeping) continue;
    if (shipMoveTargets(ship).length > 0 || disembarkTargets(ship).length > 0) {
      q.push({ type: 'ship', id: ship.id });
    }
  }
  for (const crew of game.crew.filter(c => !c.aboard && c.ap > 0 && !c.sleeping).sort((a, b) => a.id - b.id)) {
    q.push({ type: 'crew', id: crew.id });
  }
  return q;
}

// Wake a unit (if sleeping) and insert it at the front of the queue if it has moves.
// Always runs regardless of current sleeping state so manual clicks reliably re-queue units.
function wakeUnit(type, id) {
  const unit = type === 'ship' ? findShipById(id) : findCrewById(id);
  if (!unit) return;
  unit.sleeping = false;
  const desc = { type, id };
  if (!pendingUnits.some(u => u.type === type && u.id === id) && !isUnitExhausted(desc)) {
    pendingUnits.unshift(desc);
  }
}

function isUnitExhausted(sel) {
  if (!sel) return true;
  if (sel.type === 'ship') {
    const ship = findShipById(sel.id);
    return !ship || (shipMoveTargets(ship).length === 0 && disembarkTargets(ship).length === 0);
  }
  if (sel.type === 'crew') {
    const crew = findCrewById(sel.id);
    return !crew || crew.ap <= 0;
  }
  return true;
}

function selectionHighlights(sel) {
  if (!sel) return [];
  if (sel.type === 'ship') {
    const ship = findShipById(sel.id);
    return ship ? [...shipMoveTargets(ship), ...disembarkTargets(ship)] : [];
  }
  if (sel.type === 'crew') {
    const crew = findCrewById(sel.id);
    return crew ? crewMoveTargets(crew) : [];
  }
  return [];
}

function selectUnit(unitDesc) {
  selection = unitDesc;
  renderer.updateSelection(selection, selectionHighlights(selection));
  updatePanel();
}

function deselect() {
  selection = null;
  renderer.updateSelection(null, []);
  updatePanel();
}

function removePending(sel) {
  if (!sel) return;
  pendingUnits = pendingUnits.filter(u => !(u.type === sel.type && u.id === sel.id));
}

function advanceOrDeselect() {
  if (pendingUnits.length > 0) {
    const next = pendingUnits[0];
    selectUnit(next);
    panToUnit(next);
  } else {
    deselect();
    maybeAutoEndTurn();
  }
}

function panToUnit(unitDesc) {
  if (unitDesc.type === 'ship') {
    const ship = findShipById(unitDesc.id);
    if (ship) renderer.panTo(ship.q, ship.r);
  } else if (unitDesc.type === 'crew') {
    const crew = findCrewById(unitDesc.id);
    if (crew && !crew.aboard) renderer.panTo(crew.q, crew.r);
  }
}

// Called after every action. Advances to next unit if current is exhausted,
// after a brief pause so the player can see where the unit landed.
function afterAction() {
  syncRenderer();

  // Pick up units that became eligible mid-turn (e.g. crew just disembarked).
  for (const ship of game.ships) {
    if (ship.sleeping) continue;
    if (pendingUnits.some(u => u.type === 'ship' && u.id === ship.id)) continue;
    if (shipMoveTargets(ship).length > 0 || disembarkTargets(ship).length > 0)
      pendingUnits.push({ type: 'ship', id: ship.id });
  }
  for (const crew of game.crew) {
    if (crew.aboard || crew.sleeping || crew.ap <= 0) continue;
    if (pendingUnits.some(u => u.type === 'crew' && u.id === crew.id)) continue;
    pendingUnits.push({ type: 'crew', id: crew.id });
  }

  if (isUnitExhausted(selection)) {
    removePending(selection);
    _advanceTimer = setTimeout(() => {
      _advanceTimer = null;
      advanceOrDeselect();
    }, 250);
  } else {
    renderer.updateSelection(selection, selectionHighlights(selection));
    updatePanel();
  }
}

function autoSelect() {
  pendingUnits = buildTurnQueue();
  if (pendingUnits.length > 0) {
    selectUnit(pendingUnits[0]);
    panToUnit(pendingUnits[0]);
  } else {
    deselect();
  }
}

// --- Status and auto-end ---

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

function cancelAdvance() {
  if (_advanceTimer) { clearTimeout(_advanceTimer); _advanceTimer = null; }
}

function maybeAutoEndTurn() {
  if (pendingUnits.length > 0 || _autoEndTimer) return;
  setStatus('All moves spent…');
  _autoEndTimer = setTimeout(() => {
    _autoEndTimer = null;
    if (!game || pendingUnits.length > 0) { setStatus(''); return; }
    endPlayerTurn(game, MAP_WIDTH, MAP_HEIGHT);
    syncRenderer();
    autoSelect();
    setStatus('');
  }, 800);
}

// --- Renderer sync ---

function syncRenderer() {
  renderer.updateFog(game.fog);
  renderer.updateShips(game.ships);
  renderer.updateCrew(game.crew);
  updateWindDisplay();
}

function updateWindDisplay() {
  if (!game) return;
  if (elWindWrapper) elWindWrapper.style.transform = `rotate(${WIND_CSS_ANGLE[game.wind.dir]}deg)`;
  if (elWindLabel)   elWindLabel.textContent = `${WIND_NAMES[game.wind.dir]} wind`;
}

function updatePanel() {
  if (elTurnNum) elTurnNum.textContent = game ? game.turn : '—';
  if (!elUnitInfo) return;
  if (!game || !selection) {
    elUnitInfo.innerHTML = '<p class="placeholder-text">No unit selected.</p>';
    return;
  }
  if (selection.type === 'ship') {
    const ship = findShipById(selection.id);
    if (!ship) return;
    const aboard   = game.crew.filter(c => c.aboard && c.shipId === ship.id).length;
    const pos      = pointOfSail(game.wind.dir, ship.direction);
    const sailName = SAIL_NAMES[pos];
    elUnitInfo.innerHTML = ship.sleeping
      ? `<p><strong>Resolution</strong></p><p>Anchored</p>`
      : `<p><strong>Resolution</strong></p>` +
        `<p>Crew: ${aboard} / ${game.crew.length}</p>` +
        `<p>Wind: ${WIND_NAMES[game.wind.dir]}</p>` +
        `<p>${sailName} — ${Math.floor(ship.ap / 2)} AP</p>`;
    return;
  }
  if (selection.type === 'crew') {
    const c = findCrewById(selection.id);
    if (c) {
      elUnitInfo.innerHTML = c.sleeping
        ? `<p><strong>Crew ${c.id + 1}</strong></p><p>Encamped</p>`
        : `<p><strong>Crew ${c.id + 1}</strong></p><p>AP: ${c.ap} / 1</p>`;
    }
  }
}

// --- Click handler ---

function handleClick(px, py) {
  if (!game) return;

  cancelAutoEnd();
  cancelAdvance();
  const { q, r } = renderer.pixelToHex(px - canvas.getBoundingClientRect().left, py - canvas.getBoundingClientRect().top);

  if (!selection) {
    const ship = shipAtHex(q, r);
    if (ship) { wakeUnit('ship', ship.id); selectUnit({ type: 'ship', id: ship.id }); return; }
    const crew = crewAtHex(q, r);
    if (crew) { wakeUnit('crew', crew.id); selectUnit({ type: 'crew', id: crew.id }); return; }
    return;
  }

  if (selection.type === 'ship') {
    const ship = findShipById(selection.id);
    if (!ship) { deselect(); return; }

    // Try to move ship to a highlighted ocean hex.
    if (terrain[hexToIndex(q, r, MAP_WIDTH)] === 'ocean') {
      const targets = shipMoveTargets(ship);
      if (targets.some(t => t.q === q && t.r === r)) {
        if (!moveShip(game, ship.id, q, r, terrain, MAP_WIDTH, MAP_HEIGHT)) {
          const path = findShipPath(ship, q, r);
          if (path) for (const step of path) moveShip(game, ship.id, step.q, step.r, terrain, MAP_WIDTH, MAP_HEIGHT);
        }
        afterAction();
        return;
      }
    }

    // Try to disembark crew to adjacent land hex.
    const aboardCrew = game.crew.find(c => c.aboard && c.shipId === ship.id && c.ap >= 1);
    if (aboardCrew) {
      if (disembarkCrew(game, aboardCrew.id, q, r, terrain, MAP_WIDTH, MAP_HEIGHT)) {
        afterAction();
        return;
      }
    }

    // Switch to another ship.
    const other = shipAtHex(q, r);
    if (other && other.id !== ship.id) { wakeUnit('ship', other.id); selectUnit({ type: 'ship', id: other.id }); return; }

    // Switch to crew on land.
    const crew = crewAtHex(q, r);
    if (crew) { wakeUnit('crew', crew.id); selectUnit({ type: 'crew', id: crew.id }); return; }

    deselect();
    return;
  }

  if (selection.type === 'crew') {
    const crew = findCrewById(selection.id);
    if (!crew) { deselect(); return; }

    // Try to embark onto a ship at the clicked hex.
    const targetShip = shipAtHex(q, r);
    if (targetShip) {
      if (embarkCrew(game, crew.id, targetShip.id, MAP_WIDTH, MAP_HEIGHT)) {
        afterAction();
        return;
      }
    }

    // Try to move crew on land.
    if (moveCrew(game, crew.id, q, r, terrain, MAP_WIDTH, MAP_HEIGHT)) {
      afterAction();
      return;
    }

    // Switch to another crew unit with AP or sleeping.
    const other = crewAtHex(q, r);
    if (other && other.id !== crew.id && (other.ap > 0 || other.sleeping)) {
      wakeUnit('crew', other.id);
      selectUnit({ type: 'crew', id: other.id });
      return;
    }

    // Switch to a ship.
    const ship = shipAtHex(q, r);
    if (ship) { wakeUnit('ship', ship.id); selectUnit({ type: 'ship', id: ship.id }); return; }

    deselect();
  }
}

// --- End Turn ---

btnEndTurn.addEventListener('click', () => {
  if (!game) return;
  cancelAutoEnd();
  cancelAdvance();
  endPlayerTurn(game, MAP_WIDTH, MAP_HEIGHT);
  syncRenderer();
  autoSelect();
});

// --- New Game ---

btnNewGame.addEventListener('click', () => {
  cancelAutoEnd();
  const seed = Math.floor(Math.random() * 0xffffffff);
  terrain      = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  game         = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  selection    = null;
  pendingUnits = [];

  renderer.init(canvas, terrain, game.fog, game.ships, MAP_WIDTH, MAP_HEIGHT);
  renderer.updateCrew(game.crew);
  updateWindDisplay();
  autoSelect();
  setStatus('');

  btnSave.disabled    = false;
  btnEndTurn.disabled = false;
  canvas.style.cursor = 'grab';

  window.addEventListener('beforeunload', onBeforeUnload);
});
