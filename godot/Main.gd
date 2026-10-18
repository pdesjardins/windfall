extends Node2D

const MAP_WIDTH := 80
const MAP_HEIGHT := 50
const TILE_W := 72
const TILE_H := 62

const TERRAIN_OCEAN := 0
const TERRAIN_GRASSLAND := 1
const TERRAIN_FOREST := 2
const TERRAIN_STONE := 3
const TERRAIN_MOUNTAIN := 4

const SHIP_SIGHT_RANGE := 3
const DRAG_THRESHOLD := 4.0

# Tunable thresholds — all noise values are in the range -1.0 to 1.0
const WATER_THRESHOLD: float = 0.05
const STONE_THRESHOLD: float = 0.30
const MOUNTAIN_RIDGE_THRESHOLD: float = 0.52
const FOREST_THRESHOLD: float = 0.0

var terrain_data: PackedByteArray
var fog := Fog.new()
var _ship_position := Vector2i.ZERO
var _ship_direction: int = 1
var _ship_selected := false
var _valid_targets: Array[Vector2i] = []
var _drag_start := Vector2.ZERO
var _dev_fog_disabled := false
var _overlay: SelectionOverlay


func _ready() -> void:
	_setup_tileset()
	_generate_terrain()
	_render_terrain()
	_setup_fog_layer()
	fog.setup(MAP_WIDTH, MAP_HEIGHT)
	_place_ship()
	_render_fog()
	_overlay = SelectionOverlay.new()
	$World.add_child(_overlay)
	_setup_camera()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.ctrl_pressed and event.shift_pressed and event.keycode == KEY_F:
			_toggle_dev_fog()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_drag_start = event.position
		elif event.position.distance_to(_drag_start) < DRAG_THRESHOLD:
			_handle_click(get_global_mouse_position())


func _handle_click(world_pos: Vector2) -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	var clicked := layer.local_to_map(world_pos)

	if _ship_selected:
		if clicked in _valid_targets:
			_move_ship(clicked)
		_ship_selected = false
		_valid_targets.clear()
		_overlay.update(false, Vector2.ZERO, [])
	elif clicked == _ship_position:
		_ship_selected = true
		_valid_targets = _get_valid_targets()
		var target_worlds: Array[Vector2] = []
		for t in _valid_targets:
			target_worlds.append(layer.map_to_local(t))
		_overlay.update(true, layer.map_to_local(_ship_position), target_worlds)


func _get_valid_targets() -> Array[Vector2i]:
	var targets: Array[Vector2i] = []
	var layer := $World/TerrainLayer as TileMapLayer
	for neighbor: Vector2i in layer.get_surrounding_cells(_ship_position):
		if _in_bounds(neighbor) and terrain_data[neighbor.y * MAP_WIDTH + neighbor.x] == TERRAIN_OCEAN:
			targets.append(neighbor)
	return targets


func _in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.x < MAP_WIDTH and cell.y >= 0 and cell.y < MAP_HEIGHT


func _move_ship(target: Vector2i) -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	var from_world := layer.map_to_local(_ship_position)
	var to_world := layer.map_to_local(target)

	var neighbors := layer.get_surrounding_cells(_ship_position)
	for i in neighbors.size():
		if neighbors[i] == target:
			_ship_direction = i
			break

	fog.end_turn()
	_ship_position = target
	fog.set_visible(_ship_position.x, _ship_position.y, SHIP_SIGHT_RANGE, layer)
	_render_fog()

	var marker := $World/Units.get_child(0) as ShipMarker
	marker.position = to_world
	marker.rotation = (to_world - from_world).angle()
	marker.queue_redraw()


func _setup_tileset() -> void:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_HEXAGON
	ts.tile_layout = TileSet.TILE_LAYOUT_STACKED
	ts.tile_offset_axis = TileSet.TILE_OFFSET_AXIS_VERTICAL
	ts.tile_size = Vector2i(TILE_W, TILE_H)

	for name in ["ocean", "grassland", "forest", "stone", "mountain"]:
		var tex: Texture2D = load("res://tiles/" + name + ".svg")
		var source := TileSetAtlasSource.new()
		source.texture = tex
		source.texture_region_size = Vector2i(TILE_W, TILE_H)
		source.create_tile(Vector2i(0, 0))
		ts.add_source(source)

	$World/TerrainLayer.tile_set = ts


func _generate_terrain() -> void:
	var seed := randi()
	print("Map seed: ", seed)

	var elevation := FastNoiseLite.new()
	elevation.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	elevation.seed = seed
	elevation.frequency = 0.04
	elevation.fractal_type = FastNoiseLite.FRACTAL_FBM
	elevation.fractal_octaves = 4

	var biome := FastNoiseLite.new()
	biome.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	biome.seed = seed + 1000
	biome.frequency = 0.06
	biome.fractal_type = FastNoiseLite.FRACTAL_FBM
	biome.fractal_octaves = 3

	var ridge := FastNoiseLite.new()
	ridge.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	ridge.seed = seed + 2000
	ridge.frequency = 0.035
	ridge.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	ridge.fractal_octaves = 4

	terrain_data = PackedByteArray()
	terrain_data.resize(MAP_WIDTH * MAP_HEIGHT)

	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var elev := elevation.get_noise_2d(float(x), float(y))
			var bio := biome.get_noise_2d(float(x), float(y))
			var rdg := ridge.get_noise_2d(float(x), float(y))
			var t: int
			if elev < WATER_THRESHOLD:
				t = TERRAIN_OCEAN
			elif elev > STONE_THRESHOLD and rdg > MOUNTAIN_RIDGE_THRESHOLD:
				t = TERRAIN_MOUNTAIN
			elif elev > STONE_THRESHOLD:
				t = TERRAIN_STONE
			elif bio > FOREST_THRESHOLD:
				t = TERRAIN_FOREST
			else:
				t = TERRAIN_GRASSLAND
			terrain_data[y * MAP_WIDTH + x] = t


func _render_terrain() -> void:
	var layer: TileMapLayer = $World/TerrainLayer
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			layer.set_cell(Vector2i(x, y), terrain_data[y * MAP_WIDTH + x], Vector2i(0, 0))


func _setup_fog_layer() -> void:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_HEXAGON
	ts.tile_layout = TileSet.TILE_LAYOUT_STACKED
	ts.tile_offset_axis = TileSet.TILE_OFFSET_AXIS_VERTICAL
	ts.tile_size = Vector2i(TILE_W, TILE_H)

	for name in ["fog_undiscovered", "fog_explored"]:
		var tex: Texture2D = load("res://tiles/" + name + ".svg")
		var source := TileSetAtlasSource.new()
		source.texture = tex
		source.texture_region_size = Vector2i(TILE_W, TILE_H)
		source.create_tile(Vector2i(0, 0))
		ts.add_source(source)

	$World/FogLayer.tile_set = ts


func _find_starting_position() -> Vector2i:
	for y in range(10, MAP_HEIGHT - 10):
		for x in range(10, MAP_WIDTH / 4):
			if terrain_data[y * MAP_WIDTH + x] == TERRAIN_OCEAN:
				return Vector2i(x, y)
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			if terrain_data[y * MAP_WIDTH + x] == TERRAIN_OCEAN:
				return Vector2i(x, y)
	return Vector2i(0, 0)


func _place_ship() -> void:
	_ship_position = _find_starting_position()
	fog.set_visible(_ship_position.x, _ship_position.y, SHIP_SIGHT_RANGE, $World/TerrainLayer)

	var world_pos := ($World/TerrainLayer as TileMapLayer).map_to_local(_ship_position)
	var marker := ShipMarker.new()
	marker.position = world_pos
	$World/Units.add_child(marker)


func _render_fog() -> void:
	var layer: TileMapLayer = $World/FogLayer
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			if _dev_fog_disabled:
				layer.erase_cell(Vector2i(x, y))
				continue
			match fog.data[y * MAP_WIDTH + x]:
				Fog.UNDISCOVERED:
					layer.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))
				Fog.EXPLORED:
					layer.set_cell(Vector2i(x, y), 1, Vector2i(0, 0))
				Fog.VISIBLE:
					layer.erase_cell(Vector2i(x, y))


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
	var layer := $World/TerrainLayer as TileMapLayer
	var first := layer.map_to_local(Vector2i(0, 0))
	var last := layer.map_to_local(Vector2i(MAP_WIDTH - 1, MAP_HEIGHT - 1))
	var half := Vector2(TILE_W, TILE_H) / 2.0
	var camera := $Camera2D as CameraController
	camera.configure(first - half, last + half)
	camera.position = layer.map_to_local(_ship_position)
