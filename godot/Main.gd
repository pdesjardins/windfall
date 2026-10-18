extends Node2D

const MAP_WIDTH := 80
const MAP_HEIGHT := 50
const TILE_W := 72
const TILE_H := 62

const TERRAIN_OCEAN := 0
const TERRAIN_GRASSLAND := 1
const TERRAIN_FOREST := 2
const TERRAIN_STONE := 3

var terrain_data: PackedByteArray


func _ready() -> void:
	_setup_tileset()
	_generate_terrain()
	_render_terrain()
	_setup_camera()


func _setup_tileset() -> void:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_HEXAGON
	ts.tile_layout = TileSet.TILE_LAYOUT_STACKED
	ts.tile_offset_axis = TileSet.TILE_OFFSET_AXIS_VERTICAL
	ts.tile_size = Vector2i(TILE_W, TILE_H)

	var tile_names := ["ocean", "grassland", "forest", "stone"]
	for name in tile_names:
		var tex: Texture2D = load("res://tiles/" + name + ".svg")
		var source := TileSetAtlasSource.new()
		source.texture = tex
		source.texture_region_size = Vector2i(TILE_W, TILE_H)
		source.create_tile(Vector2i(0, 0))
		ts.add_source(source)

	$World/TerrainLayer.tile_set = ts


func _generate_terrain() -> void:
	terrain_data = PackedByteArray()
	terrain_data.resize(MAP_WIDTH * MAP_HEIGHT)
	for i in terrain_data.size():
		var roll := randf()
		if roll < 0.40:
			terrain_data[i] = TERRAIN_OCEAN
		elif roll < 0.65:
			terrain_data[i] = TERRAIN_GRASSLAND
		elif roll < 0.85:
			terrain_data[i] = TERRAIN_FOREST
		else:
			terrain_data[i] = TERRAIN_STONE


func _render_terrain() -> void:
	var layer: TileMapLayer = $World/TerrainLayer
	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var terrain := terrain_data[y * MAP_WIDTH + x]
			layer.set_cell(Vector2i(x, y), terrain, Vector2i(0, 0))


func _setup_camera() -> void:
	var layer := $World/TerrainLayer as TileMapLayer
	var first := layer.map_to_local(Vector2i(0, 0))
	var last := layer.map_to_local(Vector2i(MAP_WIDTH - 1, MAP_HEIGHT - 1))
	var half := Vector2(TILE_W, TILE_H) / 2.0
	($Camera2D as CameraController).configure(first - half, last + half)
