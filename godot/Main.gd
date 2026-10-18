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
const CREW_SIGHT_RANGE := 1
const WALL_SIGHT_RANGE := 1
const SHIP_CAPACITY := 10
const CREW_COUNT := 3
const CREW_AP_BUDGET := 1
const DRAG_THRESHOLD := 4.0

const IMPROVEMENT_NONE := 0
const IMPROVEMENT_WALL_1 := 1
const IMPROVEMENT_WALL_2 := 2
const IMPROVEMENT_WALL := 3

# Tunable thresholds — all noise values are in the range -1.0 to 1.0
const WATER_THRESHOLD: float = 0.05
const STONE_THRESHOLD: float = 0.30
const MOUNTAIN_RIDGE_THRESHOLD: float = 0.52
const FOREST_THRESHOLD: float = 0.0

var terrain_data: PackedByteArray
var improvements: PackedByteArray
var live_walls: PackedByteArray
var fog := Fog.new()
var _fort_lines: FortLines
var _ship_position := Vector2i.ZERO
var _ship_direction: int = 1
var _ship_selected := false
var _valid_targets: Array[Vector2i] = []
var _drag_start := Vector2.ZERO
var _dev_fog_disabled := false
var _overlay: SelectionOverlay
var _game_seed: int = 0
var _wind_dir: int = 0
var _turn: int = 0
var _ship_budget: int = Wind.SHIP_MOVE_BUDGET
var _target_costs: Dictionary = {}
var _disembark_targets: Array[Vector2i] = []
var _crew_aboard: int = 0
var _crew_units: Array[CrewMarker] = []
var _selected_crew: CrewMarker = null
var _wind_indicator: WindIndicator


func _ready() -> void:
	_game_seed = randi()
	_wind_dir = _game_seed % 6
	_setup_tileset()
	_generate_terrain()
	improvements = PackedByteArray()
	improvements.resize(MAP_WIDTH * MAP_HEIGHT)
	live_walls = PackedByteArray()
	live_walls.resize(MAP_WIDTH * MAP_HEIGHT)
	_render_terrain()
	_setup_fog_layer()
	_setup_improvement_layer()
	fog.setup(MAP_WIDTH, MAP_HEIGHT)
	_place_ship()
	_render_fog()
	_fort_lines = FortLines.new()
	$World.add_child(_fort_lines)
	_overlay = SelectionOverlay.new()
	$World.add_child(_overlay)
	_setup_camera()
	_setup_wind_indicator()


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
	var layer := $World/TerrainLayer as TileMapLayer
	var clicked := layer.local_to_map(world_pos)

	if _ship_selected:
		if clicked in _valid_targets:
			_move_ship(clicked)
			_clear_selection()
		elif clicked in _disembark_targets and _crew_aboard > 0:
			_disembark_crew(clicked)
			_select_ship()
		else:
			_clear_selection()
	elif _selected_crew != null:
		if clicked in _valid_targets:
			_move_crew(_selected_crew, clicked)
			if _crew_can_embark(_selected_crew):
				_select_crew(_selected_crew)
			else:
				_clear_selection()
		elif clicked == _ship_position and _crew_can_embark(_selected_crew):
			_embark_crew(_selected_crew)
			_clear_selection()
		else:
			_clear_selection()
	elif clicked == _ship_position:
		_select_ship()
	else:
		for crew: CrewMarker in _crew_units:
			if crew.building:
				continue
			if crew.map_pos == clicked:
				_select_crew(crew)
				break


func _get_valid_targets() -> Array[Vector2i]:
	var layer := $World/TerrainLayer as TileMapLayer
	_target_costs.clear()

	# Dijkstra: find all ocean cells reachable within remaining AP budget
	var dist: Dictionary = {_ship_position: 0}
	var queue: Array[Vector2i] = [_ship_position]

	while queue.size() > 0:
		var cell: Vector2i = queue.pop_front()
		var cost_so_far: int = dist[cell]
		for i in 6:
			var neighbor: Vector2i = layer.get_surrounding_cells(cell)[i]
			if not _in_bounds(neighbor):
				continue
			if terrain_data[neighbor.y * MAP_WIDTH + neighbor.x] != TERRAIN_OCEAN:
				continue
			var step_cost := Wind.move_cost(_wind_dir, i)
			if step_cost == Wind.BLOCKED:
				continue
			var new_cost := cost_so_far + step_cost
			if new_cost > _ship_budget:
				continue
			if not dist.has(neighbor) or dist[neighbor] > new_cost:
				dist[neighbor] = new_cost
				queue.append(neighbor)

	var targets: Array[Vector2i] = []
	for cell: Vector2i in dist.keys():
		if cell != _ship_position:
			_target_costs[cell] = dist[cell]
			targets.append(cell)
	return targets


func _in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.x < MAP_WIDTH and cell.y >= 0 and cell.y < MAP_HEIGHT


func _move_ship(target: Vector2i) -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	var from_world := layer.map_to_local(_ship_position)
	var to_world := layer.map_to_local(target)

	_ship_budget -= _target_costs.get(target, 0)
	_ship_position = target
	fog.set_visible(_ship_position.x, _ship_position.y, SHIP_SIGHT_RANGE, layer)
	_render_fog()

	var marker := $World/Units.get_child(0) as ShipMarker
	marker.position = to_world
	marker.rotation = (to_world - from_world).angle()

	_update_wind_indicator()


func _end_turn() -> void:
	_turn += 1
	var shift := Wind.wind_shift(_game_seed, _turn)
	_wind_dir = Wind.apply_shift(_wind_dir, shift)
	_ship_budget = Wind.SHIP_MOVE_BUDGET
	for crew: CrewMarker in _crew_units:
		if not crew.building:
			crew.ap_remaining = CREW_AP_BUDGET
		else:
			var idx := crew.build_pos.y * MAP_WIDTH + crew.build_pos.x
			match improvements[idx]:
				IMPROVEMENT_WALL_1:
					improvements[idx] = IMPROVEMENT_WALL_2
				IMPROVEMENT_WALL_2:
					improvements[idx] = IMPROVEMENT_WALL
					crew.building = false
	_clear_selection()
	_render_improvements()
	_detect_forts()
	fog.end_turn()
	var fl := $World/TerrainLayer as TileMapLayer
	fog.set_visible(_ship_position.x, _ship_position.y, SHIP_SIGHT_RANGE, fl)
	for crew: CrewMarker in _crew_units:
		fog.set_visible(crew.map_pos.x, crew.map_pos.y, CREW_SIGHT_RANGE, fl)
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			if live_walls[y * MAP_WIDTH + x] == 1:
				fog.set_visible(x, y, WALL_SIGHT_RANGE, fl)
	_render_fog()
	_update_wind_indicator()


func _clear_selection() -> void:
	_ship_selected = false
	_selected_crew = null
	_valid_targets.clear()
	_target_costs.clear()
	_disembark_targets.clear()
	_overlay.update(false, Vector2.ZERO, [])


func _select_ship() -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	_ship_selected = true
	_valid_targets = _get_valid_targets()
	_disembark_targets = _get_disembark_targets()
	var target_worlds: Array[Vector2] = []
	for t in _valid_targets:
		target_worlds.append(layer.map_to_local(t))
	var disembark_worlds: Array[Vector2] = []
	for t in _disembark_targets:
		disembark_worlds.append(layer.map_to_local(t))
	_overlay.update(true, layer.map_to_local(_ship_position), target_worlds, disembark_worlds)


func _select_crew(crew: CrewMarker) -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	_selected_crew = crew
	_valid_targets = _get_crew_targets(crew)
	var target_worlds: Array[Vector2] = []
	for t in _valid_targets:
		target_worlds.append(layer.map_to_local(t))
	var embark_world: Array[Vector2] = []
	if _crew_can_embark(crew):
		embark_world.append(layer.map_to_local(_ship_position))
	_overlay.update(true, layer.map_to_local(crew.map_pos), target_worlds, embark_world)


func _get_disembark_targets() -> Array[Vector2i]:
	if _crew_aboard == 0:
		return []
	var targets: Array[Vector2i] = []
	var layer := $World/TerrainLayer as TileMapLayer
	for neighbor: Vector2i in layer.get_surrounding_cells(_ship_position):
		if not _in_bounds(neighbor):
			continue
		var idx := neighbor.y * MAP_WIDTH + neighbor.x
		var t := terrain_data[idx]
		if t != TERRAIN_OCEAN and t != TERRAIN_MOUNTAIN and improvements[idx] != IMPROVEMENT_WALL:
			targets.append(neighbor)
	return targets


func _get_crew_targets(crew: CrewMarker) -> Array[Vector2i]:
	if crew.ap_remaining == 0:
		return []
	var targets: Array[Vector2i] = []
	var layer := $World/TerrainLayer as TileMapLayer
	for neighbor: Vector2i in layer.get_surrounding_cells(crew.map_pos):
		if not _in_bounds(neighbor):
			continue
		var t := terrain_data[neighbor.y * MAP_WIDTH + neighbor.x]
		if t != TERRAIN_OCEAN and t != TERRAIN_MOUNTAIN:
			targets.append(neighbor)
	return targets


func _crew_can_embark(crew: CrewMarker) -> bool:
	if _crew_aboard >= SHIP_CAPACITY:
		return false
	var layer := $World/TerrainLayer as TileMapLayer
	return _ship_position in layer.get_surrounding_cells(crew.map_pos)


func _disembark_crew(target: Vector2i) -> void:
	_crew_aboard -= 1
	var layer := $World/TerrainLayer as TileMapLayer
	var marker := CrewMarker.new()
	marker.map_pos = target
	marker.position = layer.map_to_local(target)
	marker.ap_remaining = CREW_AP_BUDGET
	_crew_units.append(marker)
	$World/Units.add_child(marker)
	fog.set_visible(target.x, target.y, CREW_SIGHT_RANGE, layer)
	_render_fog()


func _embark_crew(crew: CrewMarker) -> void:
	_crew_aboard += 1
	_crew_units.erase(crew)
	crew.queue_free()


func _move_crew(crew: CrewMarker, target: Vector2i) -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	crew.map_pos = target
	crew.position = layer.map_to_local(target)
	crew.ap_remaining -= 1
	fog.set_visible(target.x, target.y, CREW_SIGHT_RANGE, layer)
	_render_fog()


func _try_start_build() -> void:
	if _selected_crew == null or _selected_crew.building or _selected_crew.ap_remaining == 0:
		return
	var pos := _selected_crew.map_pos
	var idx := pos.y * MAP_WIDTH + pos.x
	var t := terrain_data[idx]
	if t == TERRAIN_OCEAN or t == TERRAIN_MOUNTAIN:
		return
	if improvements[idx] != IMPROVEMENT_NONE:
		return
	_selected_crew.building = true
	_selected_crew.build_pos = pos
	_selected_crew.ap_remaining = 0
	improvements[idx] = IMPROVEMENT_WALL_1
	_render_improvements()
	_clear_selection()


func _setup_improvement_layer() -> void:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_HEXAGON
	ts.tile_layout = TileSet.TILE_LAYOUT_STACKED
	ts.tile_offset_axis = TileSet.TILE_OFFSET_AXIS_VERTICAL
	ts.tile_size = Vector2i(TILE_W, TILE_H)

	for name in ["wall_1", "wall_2", "wall"]:
		var tex: Texture2D = load("res://tiles/" + name + ".svg")
		var source := TileSetAtlasSource.new()
		source.texture = tex
		source.texture_region_size = Vector2i(TILE_W, TILE_H)
		source.create_tile(Vector2i(0, 0))
		ts.add_source(source)

	$World/ImprovementLayer.tile_set = ts


func _render_improvements() -> void:
	var layer: TileMapLayer = $World/ImprovementLayer
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			match improvements[y * MAP_WIDTH + x]:
				IMPROVEMENT_WALL_1:
					layer.set_cell(Vector2i(x, y), 0, Vector2i(0, 0))
				IMPROVEMENT_WALL_2:
					layer.set_cell(Vector2i(x, y), 1, Vector2i(0, 0))
				IMPROVEMENT_WALL:
					layer.set_cell(Vector2i(x, y), 2, Vector2i(0, 0))
				_:
					layer.erase_cell(Vector2i(x, y))


func _detect_forts() -> void:
	live_walls.fill(0)
	var layer := $World/TerrainLayer as TileMapLayer

	# Step 1: outside-in BFS — mark all open cells reachable from the exterior
	var exterior := {}
	var queue: Array[Vector2i] = []
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var idx := y * MAP_WIDTH + x
			if improvements[idx] == IMPROVEMENT_WALL or terrain_data[idx] == TERRAIN_MOUNTAIN:
				continue
			if terrain_data[idx] == TERRAIN_OCEAN or x == 0 or x == MAP_WIDTH - 1 or y == 0 or y == MAP_HEIGHT - 1:
				var cell := Vector2i(x, y)
				exterior[cell] = true
				queue.append(cell)
	while queue.size() > 0:
		var cell: Vector2i = queue.pop_front()
		for neighbor: Vector2i in layer.get_surrounding_cells(cell):
			if not _in_bounds(neighbor) or exterior.has(neighbor):
				continue
			var nidx := neighbor.y * MAP_WIDTH + neighbor.x
			if improvements[nidx] == IMPROVEMENT_WALL or terrain_data[nidx] == TERRAIN_MOUNTAIN:
				continue
			exterior[neighbor] = true
			queue.append(neighbor)

	# Step 2: BFS each enclosed land region, collect boundary walls
	var visited := {}
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var cell := Vector2i(x, y)
			var idx := y * MAP_WIDTH + x
			if exterior.has(cell) or visited.has(cell):
				continue
			if improvements[idx] == IMPROVEMENT_WALL or terrain_data[idx] == TERRAIN_MOUNTAIN or terrain_data[idx] == TERRAIN_OCEAN:
				continue

			var component_set := {cell: true}
			var rqueue: Array[Vector2i] = [cell]
			var boundary_walls: Array[Vector2i] = []
			var seen_walls := {}

			while rqueue.size() > 0:
				var rc: Vector2i = rqueue.pop_front()
				for neighbor: Vector2i in layer.get_surrounding_cells(rc):
					if not _in_bounds(neighbor):
						continue
					var nidx := neighbor.y * MAP_WIDTH + neighbor.x
					if terrain_data[nidx] == TERRAIN_MOUNTAIN:
						continue
					if improvements[nidx] == IMPROVEMENT_WALL:
						if not seen_walls.has(neighbor):
							seen_walls[neighbor] = true
							boundary_walls.append(neighbor)
					elif not exterior.has(neighbor) and not component_set.has(neighbor):
						component_set[neighbor] = true
						rqueue.append(neighbor)

			for c: Vector2i in component_set.keys():
				visited[c] = true

			if boundary_walls.is_empty():
				continue

			# Step 3: BFS outward through all connected walls (marks spurs live too)
			var wi := 0
			while wi < boundary_walls.size():
				var wc: Vector2i = boundary_walls[wi]
				wi += 1
				live_walls[wc.y * MAP_WIDTH + wc.x] = 1
				for neighbor: Vector2i in layer.get_surrounding_cells(wc):
					if not _in_bounds(neighbor) or seen_walls.has(neighbor):
						continue
					if improvements[neighbor.y * MAP_WIDTH + neighbor.x] == IMPROVEMENT_WALL:
						seen_walls[neighbor] = true
						boundary_walls.append(neighbor)

	_fort_lines.update(live_walls, MAP_WIDTH, MAP_HEIGHT, layer)


func _setup_wind_indicator() -> void:
	_wind_indicator = WindIndicator.new()
	_wind_indicator.position = Vector2(60.0, 80.0)
	$UI.add_child(_wind_indicator)
	_update_wind_indicator()


func _update_wind_indicator() -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	var origin := layer.map_to_local(_ship_position)
	var neighbors := layer.get_surrounding_cells(_ship_position)
	var wind_angle := 0.0
	if _wind_dir < neighbors.size():
		wind_angle = (layer.map_to_local(neighbors[_wind_dir]) - origin).angle()
	_wind_indicator.set_state(wind_angle, _ship_budget)


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
	_ship_direction = _wind_dir
	_crew_aboard = CREW_COUNT
	fog.set_visible(_ship_position.x, _ship_position.y, SHIP_SIGHT_RANGE, $World/TerrainLayer)

	var layer := $World/TerrainLayer as TileMapLayer
	var world_pos := layer.map_to_local(_ship_position)
	var marker := ShipMarker.new()
	marker.position = world_pos

	var neighbors := layer.get_surrounding_cells(_ship_position)
	if _wind_dir < neighbors.size():
		marker.rotation = (layer.map_to_local(neighbors[_wind_dir]) - world_pos).angle()

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
