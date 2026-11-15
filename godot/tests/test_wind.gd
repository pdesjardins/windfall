extends TestCase


func test_shift_distribution_matches_spec() -> void:
	# Spec: 20% none, 30% each for +/-1, 7% each for +/-2, 3% each for +/-3.
	var expected := {0: 20.0, 1: 30.0, -1: 30.0, 2: 7.0, -2: 7.0, 3: 3.0, -3: 3.0}
	var counts := {}
	var n := 100000
	for turn in n:
		var s := Wind.wind_shift(12345, turn)
		counts[s] = counts.get(s, 0) + 1
	for shift: int in expected:
		var pct: float = 100.0 * counts.get(shift, 0) / n
		check(absf(pct - expected[shift]) < 1.0,
				"shift %d should be ~%.0f%%, got %.2f%%" % [shift, expected[shift], pct])


func test_shift_is_deterministic_per_seed_and_turn() -> void:
	for turn in 50:
		check_eq(Wind.wind_shift(99, turn), Wind.wind_shift(99, turn), "turn %d" % turn)


func test_apply_shift_wraps_both_ways() -> void:
	check_eq(Wind.apply_shift(5, 2), 1, "wrap up")
	check_eq(Wind.apply_shift(0, -1), 5, "wrap down")
	check_eq(Wind.apply_shift(3, 0), 3, "no change")


func test_points_of_sail_costs() -> void:
	# Wind index 0: windward move direction is 3.
	check_eq(Wind.move_cost(0, 3), Wind.BLOCKED, "into the wind is blocked")
	check_eq(Wind.move_cost(0, 2), 6, "close reach")
	check_eq(Wind.move_cost(0, 4), 6, "close reach (other side)")
	check_eq(Wind.move_cost(0, 1), 3, "broad reach")
	check_eq(Wind.move_cost(0, 5), 3, "broad reach (other side)")
	check_eq(Wind.move_cost(0, 0), 2, "running")
