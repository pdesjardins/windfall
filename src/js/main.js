// SPDX-License-Identifier: MIT

import { generateTerrain } from './engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT, neighbors, inBounds, hexToIndex } from './engine/hex.js';
import { initGame, moveShip } from './engine/game.js';
import * as renderer from './ui/renderer.js';

const canvas     = document.getElementById('game-canvas');
const btnNewGame = document.getElementById('btn-new-game');
const btnSave    = document.getElementById('btn-save');
const btnEndTurn = document.getElementById('btn-end-turn');

let game      = null;
let terrain   = null;
let selected  = false;

// Pan state
let dragging   = false;
let dragStart  = { x: 0, y: 0 };
let dragMoved  = 0; // total px moved during drag — distinguishes click from pan

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

  // Treat as a click only if the pointer barely moved
  if (dragMoved < 4) handleClick(e.clientX, e.clientY);
});

window.addEventListener('resize', () => renderer.render());

// Dev fog toggle: Ctrl+Shift+F
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

function validMoveTargets(ship) {
  return neighbors(ship.q, ship.r)
    .filter(([q, r]) =>
      inBounds(q, r, MAP_WIDTH, MAP_HEIGHT) &&
      terrain[hexToIndex(q, r, MAP_WIDTH)] === 'ocean'
    )
    .map(([q, r]) => ({ q, r }));
}

function handleClick(px, py) {
  if (!game) return;

  const rect   = canvas.getBoundingClientRect();
  const hex    = renderer.pixelToHex(px - rect.left, py - rect.top);
  const ship   = game.playerShip;
  const onShip = hex.q === ship.q && hex.r === ship.r;

  if (!selected) {
    if (onShip) {
      selected = true;
      renderer.updateSelection(true, validMoveTargets(ship));
    }
    return;
  }

  // Already selected — try to move
  const result = moveShip(game, hex.q, hex.r, terrain, MAP_WIDTH, MAP_HEIGHT);
  selected = false;

  if (result) {
    renderer.updateFog(game.fog);
    renderer.updateShips([game.playerShip]);
  }

  renderer.updateSelection(false, []);
}

btnNewGame.addEventListener('click', () => {
  const seed = Math.floor(Math.random() * 0xffffffff);
  terrain    = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  game       = initGame(seed, terrain, MAP_WIDTH, MAP_HEIGHT);
  selected   = false;

  renderer.init(canvas, terrain, game.fog, [game.playerShip], MAP_WIDTH, MAP_HEIGHT);
  renderer.updateSelection(false, []);

  btnSave.disabled    = false;
  btnEndTurn.disabled = false;
  canvas.style.cursor = 'grab';

  window.addEventListener('beforeunload', onBeforeUnload);
});
