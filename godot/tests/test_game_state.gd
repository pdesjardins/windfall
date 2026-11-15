extends TestCase
# Rules tests for GameState. Maps are all-ocean unless a test carves land into them.

const OCEAN := GameState.TERRAIN_OCEAN
const GRASS := GameState.TERRAIN_GRASSLAND
const MOUNTAIN := GameState.TERRAIN_MOUNTAIN


# --- seed / determinism -------------------------------------------------------------------

func test_same_seed_gives_same_world() -> void:
	var a := GameState.new_game(777, 40, 30)
	var b := GameState.new_game(777, 40, 30)
	check(a.terrain == b.terrain, "terrain should match for the same seed")
	check_eq(a.wind_dir, b.wind_dir, "starting wind")
	check_eq(a.ship_pos, b.ship_pos, "starting position")


func test_different_seeds_give_different_terrain() -> void:
	var a := GameState.new_game(1, 40, 30)
	var b := GameState.new_game(2, 40, 30)
	check(a.terrain != b.terrain, "terrain should differ between seeds")


func test_wind_sequence_recoverable_from_seed_and_turn() -> void:
	# One seed drives terrain AND wind, so a rebuilt game replays the same wind.
	var a := GameState.new_game(4242, 40, 30)
	var b := GameState.new_game(4242, 40, 30)
	for i in 30:
		a.end_turn()
		b.end_turn()
		check_eq(a.wind_dir, b.wind_dir, "wind after turn %d" % (i + 1))


func test_starting_wind_derives_from_seed_and_ship_faces_it() -> void:
	var s := GameState.new_game(13, 40, 30)
	check_eq(s.wind_dir, 13 % 6, "starting wind")
	check_eq(s.ship_direction, s.wind_dir, "ship starts facing the wind direction")


func test_wind_from_dir_is_the_blocked_windward_direction() -> void:
	# The indicator shows where wind comes FROM, which is exactly the direction the ship
	# cannot sail (in irons).
	var s := blank()
	for d in 6:
		s.wind_dir = d
		check_eq(Wind.move_cost(s.wind_dir, s.wind_from_dir()), Wind.BLOCKED,
				"wind %d: moving toward its source is blocked" % d)
		check_eq((s.wind_from_dir() + 3) % 6, s.wind_dir, "opposite of the blow direction")


# --- ship ---------------------------------------------------------------------------------

func test_ship_reach_follows_points_of_sail() -> void:
	var s := blank()
	s.wind_dir = 0
	s.ship_pos = Vector2i(10, 10)
	var costs := s.ship_move_costs()
	var ahead := HexGrid.neighbors(s.ship_pos)[0]
	check_eq(costs.get(ahead), 2, "running costs 2")
	var windward := HexGrid.neighbors(s.ship_pos)[3]
	check(not costs.has(windward), "windward hex is blocked")
	var close := HexGrid.neighbors(s.ship_pos)[2]
	check_eq(costs.get(close), 6, "close reach costs 6")


func test_ship_cannot_leave_ocean() -> void:
	var s := blank()
	s.wind_dir = 0
	s.ship_pos = Vector2i(10, 10)
	var land := HexGrid.neighbors(s.ship_pos)[0]
	set_terrain(s, [land], GRASS)
	check(not s.ship_move_costs().has(land), "land is not a ship destination")
	check(s.move_ship(land).is_empty(), "move onto land rejected")


func test_move_spends_budget_and_turns_ship() -> void:
	var s := blank()
	s.wind_dir = 0
	s.ship_pos = Vector2i(10, 10)
	var target := HexGrid.neighbors(s.ship_pos)[0]
	var path := s.move_ship(target)
	check_eq(path.size(), 1, "one step")
	check_eq(s.ship_pos, target, "ship moved")
	check_eq(s.ship_budget, Wind.SHIP_MOVE_BUDGET - 2, "budget spent")
	check_eq(s.ship_direction, 0, "ship now faces the direction it moved")


func test_multi_hex_move_reveals_fog_along_path() -> void:
	var s := blank(30, 30)
	s.wind_dir = 0
	s.ship_pos = Vector2i(5, 5)
	# Three running steps (cost 6) in a straight line; find the far end.
	var far := s.ship_pos
	for i in 3:
		far = HexGrid.neighbors(far)[0]
	var path := s.move_ship(far)
	check_eq(path.size(), 3, "three steps")
	check_eq(s.ship_budget, 0, "budget exhausted")
	var mid := path[1]
	check_eq(s.fog.data[s.index_of(mid)], Fog.VISIBLE, "midpoint is visible")
	check(s.move_ship(HexGrid.neighbors(far)[0]).is_empty(), "no budget left to move further")


func test_ship_direction_updates_to_last_step_of_multi_hex_move() -> void:
	var s := blank(30, 30)
	s.wind_dir = 0
	s.ship_pos = Vector2i(5, 5)
	var step1 := HexGrid.neighbors(s.ship_pos)[0]
	var step2 := HexGrid.neighbors(step1)[1] # broad reach: cost 3
	s.move_ship(step2)
	check_eq(s.ship_direction, 1, "direction of final step")


# --- crew: embark / disembark -------------------------------------------------------------

func _island_with_ship() -> GameState:
	# Ship at (10,10); grassland on its direction-0 neighbor.
	var s := blank()
	s.ship_pos = Vector2i(10, 10)
	s.crew_aboard = 3
	set_terrain(s, [HexGrid.neighbors(s.ship_pos)[0]], GRASS)
	return s


func test_disembark_places_crew_and_is_free() -> void:
	var s := _island_with_ship()
	var shore := HexGrid.neighbors(s.ship_pos)[0]
	var unit := s.disembark(shore)
	check(unit != null, "disembark succeeded")
	check_eq(s.crew_aboard, 2, "one fewer aboard")
	check_eq(unit.ap_remaining, GameState.CREW_AP_BUDGET, "disembarking costs no AP")
	check_eq(s.fog.data[s.index_of(shore)], Fog.VISIBLE, "crew sees their hex")


func test_disembark_rejects_ocean_and_mountain() -> void:
	var s := _island_with_ship()
	var around := HexGrid.neighbors(s.ship_pos)
	set_terrain(s, [around[1]], MOUNTAIN)
	check(s.disembark(around[1]) == null, "mountain rejected")
	check(s.disembark(around[2]) == null, "ocean rejected")
	check_eq(s.crew_aboard, 3, "nobody left the ship")


func test_embark_returns_crew_to_ship() -> void:
	var s := _island_with_ship()
	var unit := s.disembark(HexGrid.neighbors(s.ship_pos)[0])
	check(s.can_embark(unit), "adjacent crew can embark")
	check(s.embark(unit), "embark succeeded")
	check_eq(s.crew_aboard, 3, "back aboard")
	check(s.crew.is_empty(), "no crew on land")


func test_embark_respects_ship_capacity() -> void:
	var s := _island_with_ship()
	s.crew_aboard = GameState.SHIP_CAPACITY
	var unit := add_crew(s, HexGrid.neighbors(s.ship_pos)[0])
	check(not s.can_embark(unit), "full ship accepts nobody")


# --- crew: movement and building ----------------------------------------------------------

func _land(cells: Array) -> GameState:
	var s := blank()
	set_terrain(s, cells, GRASS)
	return s


func test_crew_moves_one_hex_per_turn() -> void:
	var a := Vector2i(5, 5)
	var b := HexGrid.neighbors(a)[0]
	var c := HexGrid.neighbors(b)[0]
	var s := _land([a, b, c])
	var unit := add_crew(s, a)
	check(s.move_crew(unit, b), "first move allowed")
	check(not s.move_crew(unit, c), "no AP for a second move")
	s.end_turn()
	check(s.move_crew(unit, c), "AP restored next turn")


func test_crew_cannot_enter_ocean_or_mountain() -> void:
	var a := Vector2i(5, 5)
	var n := HexGrid.neighbors(a)
	var s := _land([a, n[0]])
	set_terrain(s, [n[0]], MOUNTAIN)
	var unit := add_crew(s, a)
	check(not s.move_crew(unit, n[0]), "mountain")
	check(not s.move_crew(unit, n[1]), "ocean")


func test_wall_build_takes_three_turns_through_visible_stages() -> void:
	var a := Vector2i(5, 5)
	var s := _land([a])
	var unit := add_crew(s, a)
	check(s.start_build(unit), "build started")
	check_eq(s.improvement_at(a), GameState.IMPROVEMENT_WALL_1, "turn 1 stage")
	s.end_turn()
	check_eq(s.improvement_at(a), GameState.IMPROVEMENT_WALL_2, "turn 2 stage")
	check(unit.building, "still building")
	s.end_turn()
	check_eq(s.improvement_at(a), GameState.IMPROVEMENT_WALL, "complete")
	check(not unit.building, "free again")


func test_builder_has_no_ap_until_wall_completes_then_gets_full_ap() -> void:
	# Regression: a finished builder used to sit idle for an extra turn.
	var a := Vector2i(5, 5)
	var s := _land([a])
	var unit := add_crew(s, a)
	s.start_build(unit)
	check_eq(unit.ap_remaining, 0, "AP spent on starting")
	s.end_turn()
	check_eq(unit.ap_remaining, 0, "still locked mid-build")
	s.end_turn()
	check_eq(unit.ap_remaining, GameState.CREW_AP_BUDGET, "AP available the turn the wall completes")
	check(not unit.building, "free to act")


func test_building_crew_cannot_move() -> void:
	var a := Vector2i(5, 5)
	var b := HexGrid.neighbors(a)[0]
	var s := _land([a, b])
	var unit := add_crew(s, a)
	s.start_build(unit)
	check(not s.move_crew(unit, b), "builder is locked to the hex")


func test_cannot_build_on_ocean_mountain_or_existing_wall() -> void:
	var a := Vector2i(5, 5)
	var n := HexGrid.neighbors(a)
	var s := _land([a, n[0]])
	set_terrain(s, [n[0]], MOUNTAIN)
	check(not s.can_build(add_crew(s, n[1])), "ocean")
	check(not s.can_build(add_crew(s, n[0])), "mountain")
	s.improvements[s.index_of(a)] = GameState.IMPROVEMENT_WALL
	check(not s.can_build(add_crew(s, a)), "existing wall")


func test_nobody_may_step_onto_a_hex_under_construction() -> void:
	# Regression: only one crew may build on a hex at a time.
	var a := Vector2i(5, 5)
	var b := HexGrid.neighbors(a)[0]
	var s := _land([a, b])
	var builder := add_crew(s, b)
	s.start_build(builder)
	var walker := add_crew(s, a)
	check(not b in s.crew_targets(walker), "construction hex is not a target")
	check(not s.move_crew(walker, b), "move rejected")
	s.end_turn()
	s.end_turn()
	check(b in s.crew_targets(walker), "finished wall hex is walkable again")


# --- forts --------------------------------------------------------------------------------

func _ring_around(center: Vector2i, wall_count: int) -> GameState:
	var ring := HexGrid.neighbors(center)
	var s := blank()
	set_terrain(s, [center] + ring, GRASS)
	for i in wall_count:
		s.improvements[s.index_of(ring[i])] = GameState.IMPROVEMENT_WALL
	return s


func test_closed_wall_ring_goes_live() -> void:
	var center := Vector2i(10, 10)
	var s := _ring_around(center, 6)
	s.detect_forts()
	for w in HexGrid.neighbors(center):
		check_eq(s.live_walls[s.index_of(w)], 1, "wall %s live" % w)


func test_open_ring_is_not_a_fort() -> void:
	var s := _ring_around(Vector2i(10, 10), 5)
	s.detect_forts()
	check(s.live_walls.count(1) == 0, "a gap keeps every wall dormant")


func test_walls_under_construction_do_not_close_a_fort() -> void:
	var center := Vector2i(10, 10)
	var s := _ring_around(center, 5)
	s.improvements[s.index_of(HexGrid.neighbors(center)[5])] = GameState.IMPROVEMENT_WALL_2
	s.detect_forts()
	check(s.live_walls.count(1) == 0, "WALL_2 is visual only")


func test_connected_spur_goes_live_with_the_ring() -> void:
	var center := Vector2i(10, 10)
	var s := _ring_around(center, 6)
	var ring0 := HexGrid.neighbors(center)[0]
	var spur := HexGrid.neighbors(ring0)[0]
	set_terrain(s, [spur], GRASS)
	s.improvements[s.index_of(spur)] = GameState.IMPROVEMENT_WALL
	s.detect_forts()
	check_eq(s.live_walls[s.index_of(spur)], 1, "dead-end spur is live too")


func test_lone_wall_is_not_live() -> void:
	var a := Vector2i(5, 5)
	var s := _land([a])
	s.improvements[s.index_of(a)] = GameState.IMPROVEMENT_WALL
	s.detect_forts()
	check_eq(s.live_walls[s.index_of(a)], 0, "no enclosure, no fort")


func test_mountains_count_as_wall_segments() -> void:
	var center := Vector2i(10, 10)
	var ring := HexGrid.neighbors(center)
	var s := _ring_around(center, 5)
	set_terrain(s, [ring[5]], MOUNTAIN)
	s.detect_forts()
	check_eq(s.live_walls[s.index_of(ring[0])], 1, "walls live when a mountain closes the gap")


func test_live_wall_reveals_surrounding_fog_at_turn_end() -> void:
	var center := Vector2i(10, 10)
	var s := _ring_around(center, 6)
	s.end_turn()
	check_eq(s.fog.data[s.index_of(center)], Fog.VISIBLE, "interior visible")
	var far := HexGrid.neighbors(HexGrid.neighbors(HexGrid.neighbors(center)[0])[0])[0]
	check_eq(s.fog.data[s.index_of(far)], Fog.UNDISCOVERED, "beyond wall sight range stays hidden")
