class_name FortLines
extends Node2D

var _live_walls: PackedByteArray
var _width: int
var _height: int
var _layer: TileMapLayer


func update(live_walls: PackedByteArray, width: int, height: int, layer: TileMapLayer) -> void:
	_live_walls = live_walls
	_width = width
	_height = height
	_layer = layer
	queue_redraw()


func _draw() -> void:
	if _live_walls.is_empty():
		return
	for y in _height:
		for x in _width:
			var idx := y * _width + x
			if _live_walls[idx] == 0:
				continue
			var cell := Vector2i(x, y)
			var from_world := _layer.map_to_local(cell)
			var neighbors := _layer.get_surrounding_cells(cell)
			for neighbor in neighbors:
				if not _in_bounds(neighbor):
					continue
				var nidx := neighbor.y * _width + neighbor.x
				if _live_walls[nidx] == 0:
					continue
				if nidx <= idx:
					continue
				draw_line(from_world, _layer.map_to_local(neighbor),
						Color("#5a4a3a"), 3.0, true)


func _in_bounds(pos: Vector2i) -> bool:
	return pos.x >= 0 and pos.x < _width and pos.y >= 0 and pos.y < _height
