// SPDX-License-Identifier: MIT

import { generateTerrain } from './engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, neighbors, inBounds, hexToIndex } from './engine/hex.js';
import { initGame, moveShip, disembarkCrew, embarkCrew, moveCrew, endPlayerTurn } from './engine/game.js';
import * as renderer from './ui/renderer.js';

const canvas      = document.getElementById('game-canvas');
const btnNewGame  = document.getElementById('btn-new-game');
const btnSave     = document.getElementById('btn-save');
const btnEndTurn  = document.getElementById('btn-end-turn');
const elTurnNum    = document.getElementById('turn-number');
const elUnitInfo   = document.getElementById('unit-info');
const elStatusInfo = document.getElementById('status-info');

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

function shipMoveTargets() {
  if (game.playerShip.ap < 1) return [];
  if (!game.crew.some(c => c.aboard)) return [];
  const ship = game.playerShip;
  return neighbors(ship.q, ship.r)
    .filter(([q, r]) =>
      inBounds(q, r, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(q, r, MAP_WIDTH)] === 'ocean'
    )
    .map(([q, r]) => ({ q, r }));
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
  if (game.playerShip.ap > 0) return false;
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
}

function updatePanel() {
  if (elTurnNum) elTurnNum.textContent = game ? game.turn : '—';
  if (!elUnitInfo) return;
  if (!game || !selection) {
    elUnitInfo.innerHTML = '<p class="placeholder-text">No unit selected.</p>';
    return;
  }
  if (selection.type === 'ship') {
    const aboard = game.crew.filter(c => c.aboard).length;
    elUnitInfo.innerHTML =
      `<p><strong>Resolution</strong></p>` +
      `<p>Crew aboard: ${aboard} / ${game.crew.length}</p>`;
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
      const result = moveShip(game, q, r, terrain, MAP_WIDTH, MAP_HEIGHT);
      if (result) {
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
  autoSelect();
  setStatus('');

  btnSave.disabled    = false;
  btnEndTurn.disabled = false;
  canvas.style.cursor = 'grab';

  window.addEventListener('beforeunload', onBeforeUnload);
});
