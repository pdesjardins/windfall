extends Node2D
## Presentation and input. All game rules live in GameState; this scene draws it and
## translates clicks and key presses into calls on it.

const MAP_WIDTH := 80
const MAP_HEIGHT := 50
const TILE_W := 72
const TILE_H := 62
const DRAG_THRESHOLD := 4.0

var state: GameState

var _fort_lines: FortLines
var _overlay: SelectionOverlay
var _ship_marker: ShipMarker
var _crew_markers: Array[CrewMarker] = []
var _wind_indicator: WindIndicator
var _hud_label: Label

var _ship_selected := false
var _selected_crew: CrewData = null
var _valid_targets: Array[Vector2i] = []
var _disembark_targets: Array[Vector2i] = []
var _drag_start := Vector2.ZERO
var _dev_fog_disabled := false


func _ready() -> void:
	var map_seed := randi()
	print("Game seed: ", map_seed)
	state = GameState.new_game(map_seed, MAP_WIDTH, MAP_HEIGHT)

	_setup_tileset()
	_setup_fog_layer()
	_setup_improvement_layer()
	_render_terrain()
	_place_ship_marker()
	_render_fog()
	_fort_lines = FortLines.new()
	$World.add_child(_fort_lines)
	_overlay = SelectionOverlay.new()
	$World.add_child(_overlay)
	_setup_camera()
	_setup_wind_indicator()
	_setup_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.ctrl_pressed and event.shift_pressed and event.keycode == KEY_F:
			_toggle_dev_fog()
		elif not event.ctrl_pressed and not event.shift_pressed:
			if event.keycode == KEY_ENTER or event.keycode == KEY_KP_ENTER:
				_end_turn()
			elif event.keycode == KEY_B:
				_try_start_build()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_drag_start = event.position
		elif event.position.distance_to(_drag_start) < DRAG_THRESHOLD:
			_handle_click(get_global_mouse_position())


func _handle_click(world_pos: Vector2) -> void:
	var clicked := _terrain_layer().local_to_map(world_pos)

	if _ship_selected:
		if clicked in _valid_targets:
			_move_ship(clicked)
			_clear_selection()
		elif clicked in _disembark_targets and state.crew_aboard > 0:
			_disembark_crew(clicked)
			_select_ship()
		else:
			_clear_selection()
	elif _selected_crew != null:
		if clicked in _valid_targets:
			var unit := _selected_crew
			state.move_crew(unit, clicked)
			_sync_crew_marker(unit)
			_render_fog()
			if state.can_embark(unit):
				_select_crew(unit)
			else:
				_clear_selection()
		elif clicked == state.ship_pos and state.can_embark(_selected_crew):
			_embark_crew(_selected_crew)
			_clear_selection()
		else:
			_clear_selection()
	elif clicked == state.ship_pos:
		_select_ship()
	else:
		for unit in state.crew:
			if not unit.building and unit.map_pos == clicked:
				_select_crew(unit)
				break


func _move_ship(target: Vector2i) -> void:
	state.move_ship(target)
	_sync_ship_marker()
	_render_fog()
	_update_wind_indicator()


func _end_turn() -> void:
	state.end_turn()
	_clear_selection()
	_render_improvements()
	_fort_lines.update(state.live_walls, state.width, state.height, _terrain_layer())
	_render_fog()
	_update_wind_indicator()
	_update_hud()


func _try_start_build() -> void:
	if _selected_crew == null or not state.start_build(_selected_crew):
		return
	_render_improvements()
	_clear_selection()


func _disembark_crew(target: Vector2i) -> void:
	var unit := state.disembark(target)
	if unit == null:
		return
	var marker := CrewMarker.new()
	marker.crew = unit
	marker.position = _terrain_layer().map_to_local(unit.map_pos)
	_crew_markers.append(marker)
	$World/Units.add_child(marker)
	_render_fog()
	_update_hud()


func _embark_crew(unit: CrewData) -> void:
	if not state.embark(unit):
		return
	for marker in _crew_markers:
		if marker.crew == unit:
			_crew_markers.erase(marker)
			marker.queue_free()
			break
	_update_hud()


# --- Selection ----------------------------------------------------------------------------

func _clear_selection() -> void:
	_ship_selected = false
	_selected_crew = null
	_valid_targets.clear()
	_disembark_targets.clear()
	_overlay.update(false, Vector2.ZERO, [])


func _select_ship() -> void:
	var layer := _terrain_layer()
	_ship_selected = true
	_valid_targets.assign(state.ship_move_costs().keys())
	_disembark_targets = state.disembark_targets()
	_overlay.update(true, layer.map_to_local(state.ship_pos),
			_to_world(_valid_targets), _to_world(_disembark_targets))


func _select_crew(unit: CrewData) -> void:
	var layer := _terrain_layer()
	_selected_crew = unit
	_valid_targets = state.crew_targets(unit)
	var embark_cells: Array[Vector2i] = []
	if state.can_embark(unit):
		embark_cells.append(state.ship_pos)
	_overlay.update(true, layer.map_to_local(unit.map_pos),
			_to_world(_valid_targets), _to_world(embark_cells))


func _to_world(cells: Array[Vector2i]) -> Array[Vector2]:
	var layer := _terrain_layer()
	var worlds: Array[Vector2] = []
	for cell in cells:
		worlds.append(layer.map_to_local(cell))
	return worlds


# --- Rendering ----------------------------------------------------------------------------

func _terrain_layer() -> TileMapLayer:
	return $World/TerrainLayer


func _make_hex_tileset(names: Array) -> TileSet:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_HEXAGON
	ts.tile_layout = TileSet.TILE_LAYOUT_STACKED
	ts.tile_offset_axis = TileSet.TILE_OFFSET_AXIS_VERTICAL
	ts.tile_size = Vector2i(TILE_W, TILE_H)
	for tile_name: String in names:
		var source := TileSetAtlasSource.new()
		source.texture = load("res://tiles/" + tile_name + ".svg")
		source.texture_region_size = Vector2i(TILE_W, TILE_H)
		source.create_tile(Vector2i(0, 0))
		ts.add_source(source)
	return ts


func _setup_tileset() -> void:
	$World/TerrainLayer.tile_set = _make_hex_tileset(
			["ocean", "grassland", "forest", "stone", "mountain"])


func _setup_fog_layer() -> void:
	$World/FogLayer.tile_set = _make_hex_tileset(["fog_undiscovered", "fog_explored"])


func _setup_improvement_layer() -> void:
	$World/ImprovementLayer.tile_set = _make_hex_tileset(["wall_1", "wall_2", "wall"])


func _render_terrain() -> void:
	var layer := _terrain_layer()
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			layer.set_cell(Vector2i(x, y), state.terrain[y * MAP_WIDTH + x], Vector2i(0, 0))


func _render_improvements() -> void:
	var layer: TileMapLayer = $World/ImprovementLayer
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var cell := Vector2i(x, y)
			match state.improvements[y * MAP_WIDTH + x]:
				GameState.IMPROVEMENT_WALL_1:
					layer.set_cell(cell, 0, Vector2i(0, 0))
				GameState.IMPROVEMENT_WALL_2:
					layer.set_cell(cell, 1, Vector2i(0, 0))
				GameState.IMPROVEMENT_WALL:
					layer.set_cell(cell, 2, Vector2i(0, 0))
				_:
					layer.erase_cell(cell)


func _render_fog() -> void:
	var layer: TileMapLayer = $World/FogLayer
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var cell := Vector2i(x, y)
			if _dev_fog_disabled:
				layer.erase_cell(cell)
				continue
			match state.fog.data[y * MAP_WIDTH + x]:
				Fog.UNDISCOVERED:
					layer.set_cell(cell, 0, Vector2i(0, 0))
				Fog.EXPLORED:
					layer.set_cell(cell, 1, Vector2i(0, 0))
				Fog.VISIBLE:
					layer.erase_cell(cell)


func _place_ship_marker() -> void:
	_ship_marker = ShipMarker.new()
	$World/Units.add_child(_ship_marker)
	_sync_ship_marker()


func _sync_ship_marker() -> void:
	_ship_marker.position = _terrain_layer().map_to_local(state.ship_pos)
	_ship_marker.rotation = _direction_angle(state.ship_pos, state.ship_direction)


func _sync_crew_marker(unit: CrewData) -> void:
	for marker in _crew_markers:
		if marker.crew == unit:
			marker.position = _terrain_layer().map_to_local(unit.map_pos)
			return


## Screen-space angle of the neighbor in hex direction `dir` as seen from `cell`.
func _direction_angle(cell: Vector2i, dir: int) -> float:
	var layer := _terrain_layer()
	var neighbor := HexGrid.neighbors(cell)[dir]
	return (layer.map_to_local(neighbor) - layer.map_to_local(cell)).angle()


func _setup_wind_indicator() -> void:
	_wind_indicator = WindIndicator.new()
	_wind_indicator.position = Vector2(60.0, 80.0)
	$UI.add_child(_wind_indicator)
	_update_wind_indicator()


func _update_wind_indicator() -> void:
	_wind_indicator.set_state(_direction_angle(state.ship_pos, state.wind_from_dir()), state.ship_budget)


func _setup_hud() -> void:
	_hud_label = Label.new()
	_hud_label.add_theme_color_override("font_color", Color("#e8d5b0"))
	_hud_label.add_theme_color_override("font_outline_color", Color.BLACK)
	_hud_label.add_theme_constant_override("outline_size", 4)
	$UI.add_child(_hud_label)
	_update_hud() # text first, so the preset sees the label's real size
	_hud_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_MINSIZE, 12)
	_hud_label.grow_vertical = Control.GROW_DIRECTION_BEGIN

	# No focus, so Enter always reaches the end-turn key handler instead of
	# re-triggering a focused button.
	var button := Button.new()
	button.text = "End Turn (Enter)"
	button.focus_mode = Control.FOCUS_NONE
	button.pressed.connect(_end_turn)
	$UI.add_child(button)
	button.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT, Control.PRESET_MODE_MINSIZE, 12)


func _update_hud() -> void:
	_hud_label.text = "Turn %d   Crew aboard: %d\nEnter: end turn   B: build wall (crew selected)" \
			% [state.turn + 1, state.crew_aboard]


func _toggle_dev_fog() -> void:
	_dev_fog_disabled = !_dev_fog_disabled
	_render_fog()
	var indicator: Label = $UI.get_node_or_null("DevFogLabel")
	if indicator == null:
		indicator = Label.new()
		indicator.name = "DevFogLabel"
		indicator.text = "DEV: FOG OFF"
		indicator.position = Vector2(10, 10)
		indicator.add_theme_color_override("font_color", Color.YELLOW)
		$UI.add_child(indicator)
	indicator.visible = _dev_fog_disabled


func _setup_camera() -> void:
	var layer := _terrain_layer()
	var first := layer.map_to_local(Vector2i(0, 0))
	var last := layer.map_to_local(Vector2i(MAP_WIDTH - 1, MAP_HEIGHT - 1))
	var half := Vector2(TILE_W, TILE_H) / 2.0
	var camera := $Camera2D as CameraController
	camera.configure(first - half, last + half)
	camera.position = layer.map_to_local(state.ship_pos)
