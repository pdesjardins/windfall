class_name CrewMarker
extends Sprite2D
## Visual for a CrewData. Main keeps position in sync with crew.map_pos.

var crew: CrewData


func _ready() -> void:
	texture = load("res://sprites/crew.svg")
	centered = true
	scale = Vector2(0.6, 0.6)
