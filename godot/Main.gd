extends Node2D

const MAP_WIDTH := 80
const MAP_HEIGHT := 50
const TILE_W := 72
const TILE_H := 62

const TERRAIN_OCEAN := 0
const TERRAIN_GRASSLAND := 1
const TERRAIN_FOREST := 2
const TERRAIN_STONE := 3
const TERRAIN_MOUNTAIN := 4

# Tunable thresholds — all noise values are in the range -1.0 to 1.0
const WATER_THRESHOLD: float = 0.05
const STONE_THRESHOLD: float = 0.30
const MOUNTAIN_RIDGE_THRESHOLD: float = 0.52
const FOREST_THRESHOLD: float = 0.0

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

	var tile_names := ["ocean", "grassland", "forest", "stone", "mountain"]
	for name in tile_names:
		var tex: Texture2D = load("res://tiles/" + name + ".svg")
		var source := TileSetAtlasSource.new()
		source.texture = tex
		source.texture_region_size = Vector2i(TILE_W, TILE_H)
		source.create_tile(Vector2i(0, 0))
		ts.add_source(source)

	$World/TerrainLayer.tile_set = ts


func _generate_terrain() -> void:
	var seed := randi()
	print("Map seed: ", seed)

	var elevation := FastNoiseLite.new()
	elevation.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	elevation.seed = seed
	elevation.frequency = 0.04
	elevation.fractal_type = FastNoiseLite.FRACTAL_FBM
	elevation.fractal_octaves = 4

	var biome := FastNoiseLite.new()
	biome.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	biome.seed = seed + 1000
	biome.frequency = 0.06
	biome.fractal_type = FastNoiseLite.FRACTAL_FBM
	biome.fractal_octaves = 3

	var ridge := FastNoiseLite.new()
	ridge.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	ridge.seed = seed + 2000
	ridge.frequency = 0.035
	ridge.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	ridge.fractal_octaves = 4

	terrain_data = PackedByteArray()
	terrain_data.resize(MAP_WIDTH * MAP_HEIGHT)

	for y in MAP_HEIGHT:
		for x in MAP_WIDTH:
			var elev := elevation.get_noise_2d(float(x), float(y))
			var bio := biome.get_noise_2d(float(x), float(y))
			var rdg := ridge.get_noise_2d(float(x), float(y))
			var t: int
			if elev < WATER_THRESHOLD:
				t = TERRAIN_OCEAN
			elif elev > STONE_THRESHOLD and rdg > MOUNTAIN_RIDGE_THRESHOLD:
				t = TERRAIN_MOUNTAIN
			elif elev > STONE_THRESHOLD:
				t = TERRAIN_STONE
			elif bio > FOREST_THRESHOLD:
				t = TERRAIN_FOREST
			else:
				t = TERRAIN_GRASSLAND
			terrain_data[y * MAP_WIDTH + x] = t


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
