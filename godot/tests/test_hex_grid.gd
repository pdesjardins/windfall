extends TestCase


func test_neighbors_match_tilemaplayer() -> void:
	# The wind code and Main's rendering assume HexGrid agrees with the real tile layer.
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_HEXAGON
	ts.tile_layout = TileSet.TILE_LAYOUT_STACKED
	ts.tile_offset_axis = TileSet.TILE_OFFSET_AXIS_VERTICAL
	ts.tile_size = Vector2i(72, 62)
	var layer := TileMapLayer.new()
	layer.tile_set = ts
	for x in range(0, 8):
		for y in range(0, 8):
			var cell := Vector2i(x, y)
			check_eq(HexGrid.neighbors(cell), layer.get_surrounding_cells(cell),
					"neighbors of %s" % cell)
	layer.free()


func test_neighbors_are_symmetric() -> void:
	for x in range(0, 10):
		for y in range(0, 10):
			var cell := Vector2i(x, y)
			for n in HexGrid.neighbors(cell):
				check(cell in HexGrid.neighbors(n), "%s and %s should be mutual" % [cell, n])


func test_opposite_directions_are_three_apart() -> void:
	for x in range(0, 6):
		for y in range(0, 6):
			var cell := Vector2i(x, y)
			var around := HexGrid.neighbors(cell)
			for i in 6:
				# Going out in direction i then in direction (i+3) returns to the start.
				var there := around[i]
				check_eq(HexGrid.neighbors(there)[(i + 3) % 6], cell,
						"direction %d from %s" % [i, cell])
