class_name Fog
extends RefCounted

const UNDISCOVERED := 0
const EXPLORED := 1
const VISIBLE := 2

var data: PackedByteArray
var _width: int
var _height: int


func setup(width: int, height: int) -> void:
	_width = width
	_height = height
	data = PackedByteArray()
	data.resize(width * height)


func set_visible(col: int, row: int, sight_range: int, terrain_layer: TileMapLayer) -> void:
	var start := Vector2i(col, row)
	var visited: Dictionary = {start: 0}
	var queue: Array[Vector2i] = [start]

	while queue.size() > 0:
		var cell: Vector2i = queue.pop_front()
		var dist: int = visited[cell]
		data[cell.y * _width + cell.x] = VISIBLE

		if dist < sight_range:
			for neighbor: Vector2i in terrain_layer.get_surrounding_cells(cell):
				if not visited.has(neighbor) and _in_bounds(neighbor):
					visited[neighbor] = dist + 1
					queue.append(neighbor)


func end_turn() -> void:
	for i in data.size():
		if data[i] == VISIBLE:
			data[i] = EXPLORED


func _in_bounds(pos: Vector2i) -> bool:
	return pos.x >= 0 and pos.x < _width and pos.y >= 0 and pos.y < _height
