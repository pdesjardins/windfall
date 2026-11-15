class_name HexGrid
extends RefCounted
## Pure hex-grid math for the stacked / vertical-offset layout used by the TileMapLayers.
##
## Neighbor order matches TileMapLayer.get_surrounding_cells() for this layout:
## 0 down-right, 1 down, 2 down-left, 3 up-left, 4 up, 5 up-right.
## Opposite directions are always index and (index + 3) % 6; the wind code relies on this.
## Keeping this independent of the scene tree lets game rules run (and be tested) headless.


static func neighbors(cell: Vector2i) -> Array[Vector2i]:
	var x := cell.x
	var y := cell.y
	if (x & 1) == 0:
		return [
			Vector2i(x + 1, y), Vector2i(x, y + 1), Vector2i(x - 1, y),
			Vector2i(x - 1, y - 1), Vector2i(x, y - 1), Vector2i(x + 1, y - 1),
		]
	return [
		Vector2i(x + 1, y + 1), Vector2i(x, y + 1), Vector2i(x - 1, y + 1),
		Vector2i(x - 1, y), Vector2i(x, y - 1), Vector2i(x + 1, y),
	]
