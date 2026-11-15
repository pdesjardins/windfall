class_name TestCase
extends RefCounted

var failures: Array[String] = []


func check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)


func check_eq(actual: Variant, expected: Variant, message: String) -> void:
	if actual != expected:
		failures.append("%s (expected %s, got %s)" % [message, str(expected), str(actual)])


## A w x h all-ocean map with a fixed seed; callers carve land into it.
func blank(w: int = 20, h: int = 20, p_seed: int = 0) -> GameState:
	return GameState.blank(p_seed, w, h)


func set_terrain(state: GameState, cells: Array, t: int) -> void:
	for cell: Vector2i in cells:
		state.terrain[state.index_of(cell)] = t


## A crew member standing on `cell`, as if disembarked earlier.
func add_crew(state: GameState, cell: Vector2i) -> CrewData:
	var unit := CrewData.new()
	unit.map_pos = cell
	unit.ap_remaining = GameState.CREW_AP_BUDGET
	state.crew.append(unit)
	return unit
