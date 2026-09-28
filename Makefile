.PHONY: help dev dev-camera docs-serve render-crate
.DEFAULT_GOAL := dev

help:
	@printf '%s\n' \
		'dev            Sobe o aplicativo em http://localhost:3001.' \
		'dev-camera     Abre o Chrome com um vídeo falso no lugar da câmera. O make dev já tem de estar no ar.' \
		'docs-serve     Sobe o livro do método em http://localhost:3000. Precisa do mdBook.' \
		'render-crate   Gera uma caixa, de cima e de lado, na máquina com a placa.' \
		'               FRUIT=tangerine ou tomato. Sem FRUIT, a fruta é tangerine.' \
		'               SEED sorteia o enchimento. Sem SEED, a semente é 1.' \
		'               COUNT fixa a quantidade e pula o sorteio.' \
		'               BLENDER=/caminho/do/blender aponta o binário, se não for o desta máquina.' \
		'               Exemplo: make render-crate FRUIT=tomato SEED=5'

dev:
	cd app && npm run dev

dev-camera:
	./scripts/open-with-fake-camera.sh

docs-serve:
	@which mdbook > /dev/null || (echo "mdBook is not installed. Install it from https://github.com/rust-lang/mdBook/releases or with cargo install mdbook" && exit 1)
	@echo "Documentation server at http://localhost:3000"
	mdbook serve docs

# Portable Blender on this machine, otherwise whatever `blender` is on PATH.
BLENDER ?= $(shell if [ -x /tmp/blender-4.5.9-linux-x64/blender ]; then printf '%s' /tmp/blender-4.5.9-linux-x64/blender; elif command -v blender >/dev/null 2>&1; then command -v blender; fi)
FRUIT ?= tangerine

render-crate:
	@test -n "$(BLENDER)" && test -x "$(BLENDER)" || (echo "Blender não encontrado. Use make render-crate BLENDER=/caminho/do/blender" && exit 1)
	PYTHONUNBUFFERED=1 "$(BLENDER)" --background --python sim/render-crate.py -- $(FRUIT)$(if $(SEED), --seed $(SEED),)$(if $(COUNT), --count $(COUNT),)
