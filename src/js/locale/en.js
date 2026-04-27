// SPDX-License-Identifier: MIT

// Direction names follow standard nautical convention: named for where wind comes FROM.
export const WIND_NAMES = ['SW', 'NW', 'N', 'NE', 'SE', 'S'];
export const SAIL_NAMES = ['In irons', 'Close reach', 'Broad reach', 'Running'];

const strings = {
  // Messages
  msg_unload_no_land:       'No land nearby — cannot unload crew here.',
  msg_all_moves_spent:      'All moves spent…',

  // Placeholder text
  placeholder_no_unit:      'No unit selected.',
  placeholder_start_game:   'Start a new game to begin.',

  // Wind display
  wind_label:               '{name} wind',

  // Ship panel
  ship_name_resolution:     'Resolution',
  ship_status_anchored:     'Anchored',
  ship_crew_count:          'Crew: {aboard} / {total}',
  ship_wind_reading:        'Wind: {name}',
  ship_sail_ap:             '{sail} — {ap} AP',
  ship_hint_unload:         'U — Unload crew',

  // Crew panel
  crew_name:                'Crew {n}',
  crew_status_encamped:     'Encamped',
  crew_ap:                  'AP: {ap} / 1',
  crew_hint_build:          'B — Build',
  crew_build_label:         'Build:',
  crew_build_cancel:        'Esc — Cancel',

  // Build menu items
  improvement_farm:         'Farm',
  improvement_logging_camp: 'Logging Camp',
  improvement_wall_stage_1: 'Wall (1/3)',
  improvement_wall_stage_2: 'Wall (2/3)',
  improvement_wall_stage_3: 'Wall (3/3)',

  // Developer tools
  dev_fog_off:              'DEV: FOG OFF',
};

// t(key) — look up a locale string by key.
// t(key, { var: value }) — interpolate {var} placeholders in the string.
export function t(key, vars = {}) {
  let str = strings[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}
