class_name Wind
extends RefCounted

const SHIP_MOVE_BUDGET: int = 6
const BLOCKED: int = -1

# Indexed by steps from windward (0 = windward/blocked, 1 = close, 2 = broad, 3 = running)
const AP_COSTS: Array[int] = [BLOCKED, 6, 3, 2]

const SHIFT_TABLE: Array = [
	[40,  0],
	[65,  1],
	[90, -1],
	[94,  2],
	[98, -2],
	[99,  3],
	[100, -3],
]


static func wind_shift(p_seed: int, turn: int) -> int:
	var r := _wind_rng(p_seed, turn)
	for entry: Array in SHIFT_TABLE:
		if r < entry[0]:
			return entry[1]
	return 0


static func apply_shift(dir: int, shift: int) -> int:
	return ((dir + shift) % 6 + 6) % 6


static func point_of_sail(wind_dir: int, move_dir: int) -> int:
	var windward := (wind_dir + 3) % 6
	var diff := absi(move_dir - windward) % 6
	return mini(diff, 6 - diff)


static func move_cost(wind_dir: int, move_dir: int) -> int:
	return AP_COSTS[point_of_sail(wind_dir, move_dir)]


static func _wind_rng(p_seed: int, turn: int) -> int:
	var h: int = (p_seed ^ (turn * 2654435761)) & 0xFFFFFFFF
	h = ((h ^ (h >> 16)) * 0x45d9f3b) & 0xFFFFFFFF
	h = ((h ^ (h >> 16)) * 0x45d9f3b) & 0xFFFFFFFF
	h = h ^ (h >> 16)
	return absi(h) % 100
