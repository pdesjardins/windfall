class_name SelectionOverlay
extends Node2D

var _unit_pos := Vector2.ZERO
var _targets: Array[Vector2] = []
var _alt_targets: Array[Vector2] = []
var _active := false
var _badge := ""
var _time := 0.0


## `badge` is a short label drawn flashing beside the selected unit ("S" ship, "C" crew).
## It is a placeholder hook: replace _draw_badge with real selection art later.
func update(active: bool, unit_world: Vector2, target_worlds: Array[Vector2],
		alt_worlds: Array[Vector2] = [], badge: String = "") -> void:
	_active = active
	_badge = badge
	set_process(active and badge != "")
	_unit_pos = unit_world
	_targets = target_worlds
	_alt_targets = alt_worlds
	queue_redraw()


func _process(delta: float) -> void:
	_time += delta
	queue_redraw()


func _draw() -> void:
	if not _active:
		return
	var move_color := Color(0.91, 0.835, 0.69, 0.18)
	# Staying put is a legal choice (clicking the unit's own hex deselects), so the current
	# hex gets the same highlight as the destinations whenever there is something to choose.
	if not _targets.is_empty() or not _alt_targets.is_empty():
		_draw_hex(_unit_pos, move_color)
	for target in _targets:
		_draw_hex(target, move_color)
	for target in _alt_targets:
		_draw_hex(target, Color(0.5, 0.88, 0.6, 0.2))
	draw_arc(_unit_pos, 18.0, 0.0, TAU, 32, Color("#e8d5b0"), 2.0)
	if _badge != "":
		_draw_badge()


func _draw_badge() -> void:
	var alpha := 0.55 + 0.45 * sin(_time * 7.0)
	var font := ThemeDB.fallback_font
	var pos := _unit_pos + Vector2(20.0, -18.0)
	draw_string_outline(font, pos, _badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, 5, Color(0, 0, 0, alpha))
	draw_string(font, pos, _badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(1.0, 0.95, 0.75, alpha))


func _draw_hex(center: Vector2, color: Color) -> void:
	var poly := PackedVector2Array([
		center + Vector2(36, 0), center + Vector2(18, 31),
		center + Vector2(-18, 31), center + Vector2(-36, 0),
		center + Vector2(-18, -31), center + Vector2(18, -31),
	])
	draw_colored_polygon(poly, color)
