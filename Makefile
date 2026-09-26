dev:
	cd app && npm run dev

docs-serve:
	@which mdbook > /dev/null || (echo "mdBook is not installed. Install it from https://github.com/rust-lang/mdBook/releases or with cargo install mdbook" && exit 1)
	@echo "Documentation server at http://localhost:3000"
	mdbook serve docs
