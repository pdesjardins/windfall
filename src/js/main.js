// SPDX-License-Identifier: MIT

import { generateTerrain } from './engine/terrain.js';
import { MAP_WIDTH, MAP_HEIGHT } from './engine/hex.js';
import * as renderer from './ui/renderer.js';

const canvas = document.getElementById('game-canvas');
const btnNewGame = document.getElementById('btn-new-game');
const btnSave = document.getElementById('btn-save');
const btnEndTurn = document.getElementById('btn-end-turn');

// Pan state
let dragging = false;
let dragStart = { x: 0, y: 0 };

canvas.addEventListener('mousedown', e => {
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  dragStart = { x: e.clientX, y: e.clientY };
  renderer.pan(dx, dy);
});

window.addEventListener('mouseup', () => {
  dragging = false;
  canvas.style.cursor = 'grab';
});

window.addEventListener('resize', () => {
  renderer.render();
});

function onBeforeUnload(e) {
  e.preventDefault();
}

btnNewGame.addEventListener('click', () => {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const terrain = generateTerrain(seed, MAP_WIDTH, MAP_HEIGHT);
  renderer.init(canvas, terrain, MAP_WIDTH, MAP_HEIGHT);
  renderer.render();

  btnSave.disabled = false;
  btnEndTurn.disabled = false;
  canvas.style.cursor = 'grab';

  window.addEventListener('beforeunload', onBeforeUnload);
});
