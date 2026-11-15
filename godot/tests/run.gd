extends SceneTree
## Headless test runner. Usage (from the godot/ directory):
##   godot --headless --script tests/run.gd
## Discovers tests/test_*.gd, runs every method named test_*, exits non-zero on any failure.
## Plain GDScript on purpose: CLAUDE.md forbids third-party addons (e.g. GUT) without approval.


func _init() -> void:
	var failures := 0
	var total := 0
	var dir := DirAccess.open("res://tests")
	var files: Array[String] = []
	for f in dir.get_files():
		if f.begins_with("test_") and f.ends_with(".gd"):
			files.append(f)
	files.sort()

	for file in files:
		var script: GDScript = load("res://tests/" + file)
		var methods: Array[String] = []
		for m in script.get_script_method_list():
			if String(m.name).begins_with("test_"):
				methods.append(m.name)
		methods.sort()
		for method in methods:
			var case: TestCase = script.new()
			case.call(method)
			total += 1
			if case.failures.is_empty():
				print("  ok    %s::%s" % [file, method])
			else:
				failures += 1
				print("  FAIL  %s::%s" % [file, method])
				for msg in case.failures:
					print("          " + msg)

	print("\n%d tests, %d failed" % [total, failures])
	quit(1 if failures > 0 else 0)
