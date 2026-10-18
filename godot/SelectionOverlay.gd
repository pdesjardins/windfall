class_name SelectionOverlay
extends Node2D

var _ship_pos := Vector2.ZERO
var _targets: Array[Vector2] = []
var _active := false


func update(active: bool, ship_world: Vector2, target_worlds: Array[Vector2]) -> void:
	_active = active
	_ship_pos = ship_world
	_targets = target_worlds
	queue_redraw()


func _draw() -> void:
	if not _active:
		return
	draw_arc(_ship_pos, 18.0, 0.0, TAU, 32, Color("#e8d5b0"), 2.0)
	for target in _targets:
		draw_arc(target, 18.0, 0.0, TAU, 32, Color(0.91, 0.835, 0.69, 0.4), 1.5)
