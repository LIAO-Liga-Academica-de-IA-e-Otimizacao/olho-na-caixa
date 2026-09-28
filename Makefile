dev:
	cd app && npm run dev

dev-camera:
	./scripts/open-with-fake-camera.sh

docs-serve:
	@which mdbook > /dev/null || (echo "mdBook is not installed. Install it from https://github.com/rust-lang/mdBook/releases or with cargo install mdbook" && exit 1)
	@echo "Documentation server at http://localhost:3000"
	mdbook serve docs

# One crate, top and side. FRUIT is tangerine or tomato.
# SEED draws the fill. COUNT fixes it and skips the draw.
# BLENDER points at the binary when it is not the portable build on this machine.
BLENDER ?= $(shell if [ -x /tmp/blender-4.5.9-linux-x64/blender ]; then printf '%s' /tmp/blender-4.5.9-linux-x64/blender; elif command -v blender >/dev/null 2>&1; then command -v blender; fi)
FRUIT ?= tangerine

render:
	@test -n "$(BLENDER)" && test -x "$(BLENDER)" || (echo "Blender não encontrado. Use make render BLENDER=/caminho/do/blender" && exit 1)
	PYTHONUNBUFFERED=1 "$(BLENDER)" --background --python sim/render-crate.py -- $(FRUIT)$(if $(SEED), --seed $(SEED),)$(if $(COUNT), --count $(COUNT),)
