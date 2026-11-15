class_name ShipMarker
extends Sprite2D


func _ready() -> void:
	texture = load("res://sprites/ship.svg")
	centered = true
	scale = Vector2(0.65, 0.65)
