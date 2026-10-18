class_name CrewMarker
extends Sprite2D

var map_pos: Vector2i = Vector2i.ZERO
var ap_remaining: int = 1


func _ready() -> void:
	texture = load("res://sprites/crew.svg")
	centered = true
	scale = Vector2(0.6, 0.6)
