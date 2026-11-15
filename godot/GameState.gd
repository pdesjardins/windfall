class_name GameState
extends RefCounted
## All game rules and state, with no dependency on the scene tree.
##
## Main owns presentation and input; it calls into this class and re-renders from it.
## Everything random derives from the single `game_seed`: terrain, starting wind, and the
## per-turn wind shifts, so a game is fully reproducible from (seed, turn).

const TERRAIN_OCEAN := 0
const TERRAIN_GRASSLAND := 1
const TERRAIN_FOREST := 2
const TERRAIN_STONE := 3
const TERRAIN_MOUNTAIN := 4

const IMPROVEMENT_NONE := 0
const IMPROVEMENT_WALL_1 := 1
const IMPROVEMENT_WALL_2 := 2
const IMPROVEMENT_WALL := 3

const SHIP_SIGHT_RANGE := 3
const CREW_SIGHT_RANGE := 1
const WALL_SIGHT_RANGE := 1
const SHIP_CAPACITY := 10
const CREW_COUNT := 3
const CREW_AP_BUDGET := 1

# Tunable thresholds; all noise values are in the range -1.0 to 1.0.
const WATER_THRESHOLD: float = 0.05
const STONE_THRESHOLD: float = 0.30
const MOUNTAIN_RIDGE_THRESHOLD: float = 0.52
const FOREST_THRESHOLD: float = 0.0

var game_seed: int = 0
var width: int = 0
var height: int = 0
var terrain: PackedByteArray
var improvements: PackedByteArray
var live_walls: PackedByteArray
var fog := Fog.new()

## Direction the wind blows TOWARD (the leeward / running direction). The ship starts facing
## it and moving this way is cheapest. Sailors name wind by where it comes FROM; use
## wind_from_dir() for anything shown to the player.
var wind_dir: int = 0
var turn: int = 0

var ship_pos := Vector2i.ZERO
var ship_direction: int = 0
var ship_budget: int = Wind.SHIP_MOVE_BUDGET
var crew_aboard: int = 0
var crew: Array[CrewData] = []


## A generated world with the ship placed and the starting crew aboard.
static func new_game(p_seed: int, p_width: int, p_height: int) -> GameState:
	var state := blank(p_seed, p_width, p_height)
	state._generate_terrain()
	state._place_ship()
	return state


## An all-ocean map with no ship. Used by new_game() and by tests that build their own maps.
static func blank(p_seed: int, p_width: int, p_height: int) -> GameState:
	var state := GameState.new()
	state.game_seed = p_seed
	state.width = p_width
	state.height = p_height
	state.wind_dir = posmod(p_seed, 6)
	state.ship_direction = state.wind_dir
	state.terrain = PackedByteArray()
	state.terrain.resize(p_width * p_height)
	state.improvements = PackedByteArray()
	state.improvements.resize(p_width * p_height)
	state.live_walls = PackedByteArray()
	state.live_walls.resize(p_width * p_height)
	state.fog.setup(p_width, p_height)
	return state


## Direction the wind comes FROM (the windward direction, where the ship is "in irons").
func wind_from_dir() -> int:
	return (wind_dir + 3) % 6


func in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.x < width and cell.y >= 0 and cell.y < height


func index_of(cell: Vector2i) -> int:
	return cell.y * width + cell.x


func terrain_at(cell: Vector2i) -> int:
	return terrain[index_of(cell)]


func improvement_at(cell: Vector2i) -> int:
	return improvements[index_of(cell)]


func is_walkable(cell: Vector2i) -> bool:
	var t := terrain_at(cell)
	return t != TERRAIN_OCEAN and t != TERRAIN_MOUNTAIN


# --- Ship ---------------------------------------------------------------------------------

## Every ocean cell the ship can reach this turn, mapped to its total movement cost.
func ship_move_costs() -> Dictionary:
	return _ship_search()[0]


## Moves the ship to `target` if reachable this turn. Reveals fog along the whole path.
## Returns the path (excluding the start cell), or an empty array if the move is illegal.
func move_ship(target: Vector2i) -> Array[Vector2i]:
	var result := _ship_search()
	var costs: Dictionary = result[0]
	var prev: Dictionary = result[1]
	var path: Array[Vector2i] = []
	if not costs.has(target):
		return path

	var cell := target
	while cell != ship_pos:
		path.push_front(cell)
		cell = prev[cell]

	ship_budget -= costs[target]
	var from := ship_pos
	for step in path:
		ship_direction = HexGrid.neighbors(from).find(step)
		from = step
		fog.set_visible(step.x, step.y, SHIP_SIGHT_RANGE)
	ship_pos = target
	return path


# Returns [costs, prev]: costs maps each reachable cell (excluding the start) to its total
# cost; prev maps each cell to the cell the cheapest route reached it from.
func _ship_search() -> Array:
	var dist: Dictionary = {ship_pos: 0}
	var prev: Dictionary = {}
	var queue: Array[Vector2i] = [ship_pos]

	while queue.size() > 0:
		var cell: Vector2i = queue.pop_front()
		var cost_so_far: int = dist[cell]
		var around := HexGrid.neighbors(cell)
		for i in 6:
			var neighbor := around[i]
			if not in_bounds(neighbor) or terrain_at(neighbor) != TERRAIN_OCEAN:
				continue
			var step_cost := Wind.move_cost(wind_dir, i)
			if step_cost == Wind.BLOCKED:
				continue
			var new_cost := cost_so_far + step_cost
			if new_cost > ship_budget:
				continue
			if not dist.has(neighbor) or dist[neighbor] > new_cost:
				dist[neighbor] = new_cost
				prev[neighbor] = cell
				queue.append(neighbor)

	var costs: Dictionary = {}
	for cell: Vector2i in dist.keys():
		if cell != ship_pos:
			costs[cell] = dist[cell]
	return [costs, prev]


# --- Crew ---------------------------------------------------------------------------------

## Land cells next to the ship where a crew member aboard could disembark.
func disembark_targets() -> Array[Vector2i]:
	var targets: Array[Vector2i] = []
	if crew_aboard == 0:
		return targets
	for neighbor in HexGrid.neighbors(ship_pos):
		if in_bounds(neighbor) and is_walkable(neighbor) \
				and improvement_at(neighbor) != IMPROVEMENT_WALL:
			targets.append(neighbor)
	return targets


## Puts one crew member from the ship onto `target`. Free action. Returns null if illegal.
func disembark(target: Vector2i) -> CrewData:
	if crew_aboard == 0 or not target in disembark_targets():
		return null
	crew_aboard -= 1
	var unit := CrewData.new()
	unit.map_pos = target
	unit.ap_remaining = CREW_AP_BUDGET
	crew.append(unit)
	fog.set_visible(target.x, target.y, CREW_SIGHT_RANGE)
	return unit


func crew_targets(unit: CrewData) -> Array[Vector2i]:
	var targets: Array[Vector2i] = []
	if unit.ap_remaining == 0 or unit.building:
		return targets
	for neighbor in HexGrid.neighbors(unit.map_pos):
		if not in_bounds(neighbor) or not is_walkable(neighbor):
			continue
		if _is_under_construction_by_other(neighbor, unit):
			continue
		targets.append(neighbor)
	return targets


func move_crew(unit: CrewData, target: Vector2i) -> bool:
	if not target in crew_targets(unit):
		return false
	unit.map_pos = target
	unit.ap_remaining -= 1
	fog.set_visible(target.x, target.y, CREW_SIGHT_RANGE)
	return true


## Embarking is a free action (0 AP) per the spec's 2026-10-17 decision.
func can_embark(unit: CrewData) -> bool:
	if unit.building or crew_aboard >= SHIP_CAPACITY:
		return false
	return ship_pos in HexGrid.neighbors(unit.map_pos)


func embark(unit: CrewData) -> bool:
	if not can_embark(unit):
		return false
	crew.erase(unit)
	crew_aboard += 1
	return true


func can_build(unit: CrewData) -> bool:
	if unit.building or unit.ap_remaining == 0:
		return false
	return is_walkable(unit.map_pos) and improvement_at(unit.map_pos) == IMPROVEMENT_NONE


func start_build(unit: CrewData) -> bool:
	if not can_build(unit):
		return false
	unit.building = true
	unit.build_pos = unit.map_pos
	unit.ap_remaining = 0
	improvements[index_of(unit.map_pos)] = IMPROVEMENT_WALL_1
	return true


# Only one crew unit may build on a hex at a time, so nobody else may step onto it.
func _is_under_construction_by_other(cell: Vector2i, unit: CrewData) -> bool:
	for other in crew:
		if other != unit and other.building and other.build_pos == cell:
			return true
	return false


# --- Turns --------------------------------------------------------------------------------

func end_turn() -> void:
	turn += 1
	wind_dir = Wind.apply_shift(wind_dir, Wind.wind_shift(game_seed, turn))
	ship_budget = Wind.SHIP_MOVE_BUDGET

	for unit in crew:
		if not unit.building:
			unit.ap_remaining = CREW_AP_BUDGET
			continue
		var idx := index_of(unit.build_pos)
		match improvements[idx]:
			IMPROVEMENT_WALL_1:
				improvements[idx] = IMPROVEMENT_WALL_2
			IMPROVEMENT_WALL_2:
				improvements[idx] = IMPROVEMENT_WALL
				unit.building = false
				# The crew is free again this turn, so they get their action back immediately.
				unit.ap_remaining = CREW_AP_BUDGET

	detect_forts()
	fog.end_turn()
	fog.set_visible(ship_pos.x, ship_pos.y, SHIP_SIGHT_RANGE)
	for unit in crew:
		fog.set_visible(unit.map_pos.x, unit.map_pos.y, CREW_SIGHT_RANGE)
	for y in height:
		for x in width:
			if live_walls[y * width + x] == 1:
				fog.set_visible(x, y, WALL_SIGHT_RANGE)


## Marks every wall that borders a fully enclosed region as live (including connected spurs).
func detect_forts() -> void:
	live_walls.fill(0)

	# Step 1: outside-in fill. Seeds are ocean and open map-edge cells; only complete walls
	# and mountains block it, so anything it cannot reach is enclosed.
	var exterior := {}
	var queue: Array[Vector2i] = []
	for y in height:
		for x in width:
			var cell := Vector2i(x, y)
			if _blocks_fill(cell):
				continue
			if terrain_at(cell) == TERRAIN_OCEAN or x == 0 or x == width - 1 \
					or y == 0 or y == height - 1:
				exterior[cell] = true
				queue.append(cell)
	while queue.size() > 0:
		var cell: Vector2i = queue.pop_front()
		for neighbor in HexGrid.neighbors(cell):
			if not in_bounds(neighbor) or exterior.has(neighbor) or _blocks_fill(neighbor):
				continue
			exterior[neighbor] = true
			queue.append(neighbor)

	# Step 2: for each enclosed land region, collect the complete walls bordering it.
	var visited := {}
	for y in height:
		for x in width:
			var start := Vector2i(x, y)
			if exterior.has(start) or visited.has(start) or _blocks_fill(start) \
					or terrain_at(start) == TERRAIN_OCEAN:
				continue

			var region := {start: true}
			var region_queue: Array[Vector2i] = [start]
			var boundary_walls: Array[Vector2i] = []
			var seen_walls := {}

			while region_queue.size() > 0:
				var rc: Vector2i = region_queue.pop_front()
				for neighbor in HexGrid.neighbors(rc):
					if not in_bounds(neighbor) or terrain_at(neighbor) == TERRAIN_MOUNTAIN:
						continue
					if improvement_at(neighbor) == IMPROVEMENT_WALL:
						if not seen_walls.has(neighbor):
							seen_walls[neighbor] = true
							boundary_walls.append(neighbor)
					elif not exterior.has(neighbor) and not region.has(neighbor):
						region[neighbor] = true
						region_queue.append(neighbor)

			for c: Vector2i in region.keys():
				visited[c] = true

			# A region bounded only by mountains is not a fort.
			if boundary_walls.is_empty():
				continue

			# Step 3: spread through all connected complete walls so spurs are live too.
			var wi := 0
			while wi < boundary_walls.size():
				var wall := boundary_walls[wi]
				wi += 1
				live_walls[index_of(wall)] = 1
				for neighbor in HexGrid.neighbors(wall):
					if not in_bounds(neighbor) or seen_walls.has(neighbor):
						continue
					if improvement_at(neighbor) == IMPROVEMENT_WALL:
						seen_walls[neighbor] = true
						boundary_walls.append(neighbor)


func _blocks_fill(cell: Vector2i) -> bool:
	return improvement_at(cell) == IMPROVEMENT_WALL or terrain_at(cell) == TERRAIN_MOUNTAIN


# --- World setup --------------------------------------------------------------------------

func _generate_terrain() -> void:
	var elevation := FastNoiseLite.new()
	elevation.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	elevation.seed = game_seed
	elevation.frequency = 0.04
	elevation.fractal_type = FastNoiseLite.FRACTAL_FBM
	elevation.fractal_octaves = 4

	var biome := FastNoiseLite.new()
	biome.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	biome.seed = game_seed + 1000
	biome.frequency = 0.06
	biome.fractal_type = FastNoiseLite.FRACTAL_FBM
	biome.fractal_octaves = 3

	var ridge := FastNoiseLite.new()
	ridge.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	ridge.seed = game_seed + 2000
	ridge.frequency = 0.035
	ridge.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	ridge.fractal_octaves = 4

	for y in height:
		for x in width:
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
			terrain[y * width + x] = t


func _find_starting_position() -> Vector2i:
	for y in range(10, height - 10):
		for x in range(10, width / 4):
			if terrain[y * width + x] == TERRAIN_OCEAN:
				return Vector2i(x, y)
	for y in height:
		for x in width:
			if terrain[y * width + x] == TERRAIN_OCEAN:
				return Vector2i(x, y)
	return Vector2i(0, 0)


func _place_ship() -> void:
	ship_pos = _find_starting_position()
	ship_direction = wind_dir
	crew_aboard = CREW_COUNT
	fog.set_visible(ship_pos.x, ship_pos.y, SHIP_SIGHT_RANGE)
