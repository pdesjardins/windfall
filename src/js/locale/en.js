// SPDX-License-Identifier: MIT

const strings = {
  msg_unload_no_land: 'No land nearby \u2014 cannot unload crew here.',
};

export function t(key) {
  return strings[key] ?? key;
}
