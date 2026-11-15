class_name WindIndicator
extends Node2D

const RADIUS := 28.0

var _wind_angle: float = 0.0
var _budget: int = Wind.SHIP_MOVE_BUDGET


func set_state(wind_angle: float, budget: int) -> void:
	_wind_angle = wind_angle
	_budget = budget
	queue_redraw()


func _draw() -> void:
	draw_arc(Vector2.ZERO, RADIUS, 0.0, TAU, 32, Color(1.0, 1.0, 1.0, 0.2), 1.5)

	var dir := Vector2(cos(_wind_angle), sin(_wind_angle))
	var tip := dir * RADIUS
	var tail := -dir * (RADIUS * 0.5)
	var perp := Vector2(-dir.y, dir.x)

	draw_line(tail, tip, Color("#e8d5b0"), 2.0)
	draw_line(tip, tip - dir * 10.0 + perp * 5.0, Color("#e8d5b0"), 2.0)
	draw_line(tip, tip - dir * 10.0 - perp * 5.0, Color("#e8d5b0"), 2.0)

	draw_string(ThemeDB.fallback_font, Vector2(-16.0, RADIUS + 18.0),
			"AP: %d" % _budget, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#e8d5b0"))
