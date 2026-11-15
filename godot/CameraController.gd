class_name CameraController
extends Camera2D

const ZOOM_MIN := Vector2(0.25, 0.25)
const ZOOM_MAX := Vector2(3.0, 3.0)
const ZOOM_STEP := 0.15

var _dragging := false
var _drag_start := Vector2.ZERO
var _camera_start := Vector2.ZERO


func configure(top_left: Vector2, bottom_right: Vector2) -> void:
	limit_left = int(top_left.x)
	limit_top = int(top_left.y)
	limit_right = int(bottom_right.x)
	limit_bottom = int(bottom_right.y)
	position = (top_left + bottom_right) / 2.0


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		_on_mouse_button(event)
	elif event is InputEventMouseMotion and _dragging:
		position = _camera_start + (_drag_start - event.position) / zoom


func _on_mouse_button(event: InputEventMouseButton) -> void:
	match event.button_index:
		MOUSE_BUTTON_RIGHT:
			_dragging = event.pressed
			if _dragging:
				_drag_start = event.position
				_camera_start = position
		MOUSE_BUTTON_WHEEL_UP:
			if event.pressed:
				zoom = (zoom + Vector2(ZOOM_STEP, ZOOM_STEP)).clamp(ZOOM_MIN, ZOOM_MAX)
		MOUSE_BUTTON_WHEEL_DOWN:
			if event.pressed:
				zoom = (zoom - Vector2(ZOOM_STEP, ZOOM_STEP)).clamp(ZOOM_MIN, ZOOM_MAX)
