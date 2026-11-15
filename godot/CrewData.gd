class_name CrewData
extends RefCounted
## One crew unit's state. Contains no rendering; CrewMarker displays it.

var map_pos: Vector2i = Vector2i.ZERO
var ap_remaining: int = 1
var building: bool = false
var build_pos: Vector2i = Vector2i.ZERO
