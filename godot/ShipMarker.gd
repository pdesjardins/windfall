class_name ShipMarker
extends Node2D


func _draw() -> void:
	var size := 14.0
	var bow := Vector2(size * 0.45, 0.0)
	var port := Vector2(-size * 0.30, size * 0.28)
	var starboard := Vector2(-size * 0.30, -size * 0.28)
	draw_colored_polygon([bow, port, starboard], Color("#e8d5b0"))
	draw_polyline([bow, port, starboard, bow], Color("#8a6a40"), 1.5, true)
