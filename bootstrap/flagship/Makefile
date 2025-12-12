# Flagship Universal Makefile v7.1 — auto-bootstrapping for Rust / TS/JS / Go / C++ / CSS / Python
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables --output-sync=target

# ---- Tunables (override in Makefile.local) ----
CI_STRICT          ?= 0
CYCLO_LIMIT        ?= 10
COG_LIMIT          ?= 15
DUP_THRESHOLD      ?= 3
REPORTS_DIR        ?= reports
LOGS_DIR           ?= $(REPORTS_DIR)/logs
ARTIFACTS_DIR      ?= artifacts
CONFIGS_DIR        ?= configs
SCRIPTS_DIR        ?= scripts
TOOLS_DIR          ?= tools
TOOLCHAIN_STATE_DIR := $(TOOLS_DIR)/state
NODE_STAMP := $(TOOLCHAIN_STATE_DIR)/node-deps.stamp
PYTHON_STAMP := $(TOOLCHAIN_STATE_DIR)/python-deps.stamp
GO_STAMP := $(TOOLCHAIN_STATE_DIR)/go-deps.stamp
FORCE_NODE_DEPS ?= 0
FORCE_PY_DEPS ?= 0
FORCE_GO_DEPS ?= 0
ALLOW_OFFLINE_SECURITY ?= 0
NODE_VERSION       ?= v20.18.0
SYFT_VERSION       ?= v1.33.0
NODE_RUNNER        ?= npm
PYTHON             ?= python3

# Pinned JS CLI versions (override in Makefile.local for reproducibility)
ESLINT_VERSION       ?= 9.37.0
ESLINT_SONARJS_VER   ?= 3.0.5
PRETTIER_VERSION     ?= 3.6.2
STYLELINT_VERSION    ?= 16.25.0
STYLELINT_STD_VER    ?= 39.0.1
SPECTRAL_VERSION     ?= 6.15.0
REDOCLY_VERSION      ?= 2.4.0
JSCPD_VERSION        ?= 4.0.5
CLANG_FORMAT_NPM_VER ?= 1.8.0

# Python tool pins
LIZARD_VERSION         ?= 1.18.0
RADON_VERSION          ?= 6.0.1
XENON_VERSION          ?= 0.9.3
PYTEST_VERSION         ?= 8.4.2
PYTEST_XDIST_VERSION   ?= 3.8.0
PYTEST_BENCHMARK_VER   ?= 5.1.0
PIPAUDIT_VERSION       ?= 2.9.0

# Rust tool pins
CARGO_CYCLONEDX_VERSION ?= 0.11.0

# Go tool pins
GOCYCLO_VERSION      ?= v0.6.0

# Use local tools if installed by bootstrap
PATH := $(TOOLS_DIR)/node/bin:$(TOOLS_DIR)/syft:$(PATH)

SBOM_EXCLUDES ?= **/node_modules/** **/.venv/** **/dist/** **/build/** **/artifacts/** **/reports/** **/target/** **/.pytest_cache/** **/.pytest_tmp/** **/.benchmarks/** **/tools/** **/coverage/** **/tmp/**
SBOM_ARGS := $(foreach path,$(SBOM_EXCLUDES),--exclude $(path))

-include Makefile.local

# ---- Stack detection ----
GITFILES := $(shell git ls-files 2>/dev/null || true)
ifneq ($(strip $(GITFILES)),)
 DETECT_FILES := $(GITFILES)
else
 DETECT_FILES := $(shell find . -maxdepth 4 -type f 2>/dev/null || true)
endif

HAS_RUST := $(filter %/Cargo.toml ./Cargo.toml Cargo.toml,$(DETECT_FILES))
HAS_GO   := $(filter %.go go.mod,$(DETECT_FILES))
NODE_PACKAGE_FILES := $(filter ./package.json package.json,$(DETECT_FILES))
NODE_PROJECT_PACKAGES := $(filter-out ./bootstrap/flagship/package.json bootstrap/flagship/package.json,$(NODE_PACKAGE_FILES))
NODE_SOURCE_FILES := $(filter %.js %.jsx %.mjs %.cjs %.ts %.tsx,$(DETECT_FILES))
ifeq ($(strip $(NODE_PROJECT_PACKAGES)$(NODE_SOURCE_FILES)),)
 HAS_NODE :=
else
 HAS_NODE := $(NODE_PROJECT_PACKAGES)
endif
HAS_CPP  := $(filter %.c %.cc %.cpp %.cxx %.h %.hpp %.hh %.hxx CMakeLists.txt,$(DETECT_FILES))
HAS_CSS  := $(filter %.css %.scss %.sass,$(DETECT_FILES))
HAS_PY   := $(filter %.py pyproject.toml requirements.txt,$(DETECT_FILES))

timestamp := $(shell date -u +%Y-%m-%dT%H%M%SZ)
LOG_FILE := $(LOGS_DIR)/$(timestamp).log
DIST_FILE := $(ARTIFACTS_DIR)/flagship-universal-bootstrap_v7_1.tar.gz
ensure_dirs = mkdir -p $(REPORTS_DIR) $(LOGS_DIR) $(ARTIFACTS_DIR) $(CONFIGS_DIR) scripts/quality scripts/cpp scripts/bench scripts/bootstrap $(TOOLS_DIR) $(TOOLCHAIN_STATE_DIR)

define BLOCKER
{ printf "\033[31mBLOCKER:\033[0m %s\n" "$(1)" >&2; exit 2; }
endef
append_log = tee -a $(LOG_FILE)

# ---- Help ----
.PHONY: help
help:
	@printf "\nFlagship Make v7.1 — targets:\n"; \
	printf "  %-22s %s\n" "preflight" "scaffold + install tooling (idempotent)"; \
	printf "  %-22s %s\n" "quickstart" "preflight + full review (one-shot)"; \
	printf "  %-22s %s\n" "quicksetup" "scaffold configs/ignores (idempotent)"; \
	printf "  %-22s %s\n" "deps" "install project-local tools (Node devDeps, Python venv, Go tools)"; \
	printf "  %-22s %s\n" "doctor" "diagnose only detected stacks"; \
	printf "  %-22s %s\n" "fast-review" "fmt+lint+dup+complexity+guard (no tests)"; \
	printf "  %-22s %s\n" "fmt-check / fmt" "format check/apply"; \
	printf "  %-22s %s\n" "lint" "run linters (clippy w/ cognitive)"; \
	printf "  %-22s %s\n" "test / race / fault" "tests + race/crash hooks"; \
		printf "  %-22s %s\n" "dup / complexity" "jscpd + lizard budgets"; \
		printf "  %-22s %s\n" "contracts / sync-docs" "OpenAPI lint+bundle via npm CLIs"; \
		printf "  %-22s %s\n" "sbom" "Syft CycloneDX JSON (local binary or Docker fallback)"; \
		printf "  %-22s %s\n" "bench-collect" "aggregate p95/p99 from pytest-benchmark & Criterion"; \
		printf "  %-22s %s\n" "guard" "validate metrics vs guardrails (BLOCKER on violation)"; \
		printf "  %-22s %s\n" "clean" "remove tool caches (node_modules/.venv/reports/tools)"; \
		printf "  %-22s %s\n" "dist" "produce distributable tarball in artifacts/"; \
		printf "  %-22s %s\n" "review / ci" "full gate + log aggregation\n\n"

# ---- Quickstart ----
.PHONY: preflight quickstart
preflight: quicksetup ensure-node ensure-pyvenv deps ensure-syft doctor
	@echo "✓ preflight ready"

quickstart: preflight review
	@echo "✓ quickstart complete → see $(REPORTS_DIR)/verify.json (log: $(LOG_FILE))"

.PHONY: toolchain-check
toolchain-check:
	@if [ ! -f $(NODE_STAMP) ] || [ ! -d node_modules ]; then \
		$(call BLOCKER,Node toolchain not initialised. Run 'make deps' or 'make quickstart'); \
	fi
	@if [ -n "$(HAS_PY)" ] && { [ ! -x .venv/bin/python3 ] || [ ! -f $(PYTHON_STAMP) ]; }; then \
		$(call BLOCKER,Python toolchain not initialised. Run 'make deps' or 'make quickstart'); \
	fi
	@if [ -n "$(HAS_GO)" ] && [ ! -f $(GO_STAMP) ]; then \
		$(call BLOCKER,Go toolchain not initialised. Run 'make deps' or 'make quickstart'); \
	fi

.PHONY: fast-review
fast-review: toolchain-check
	@$(MAKE) fmt-check
	@$(MAKE) lint
	@$(MAKE) dup
	@$(MAKE) complexity
	@$(MAKE) guard

# ---- Quicksetup ----
.PHONY: quicksetup
quicksetup:
	@$(ensure_dirs)
	@test -f .gitignore || touch .gitignore
	@grep -qxF "Makefile.local" .gitignore || echo "Makefile.local" >> .gitignore
	@grep -qxF "$(REPORTS_DIR)" .gitignore || echo "$(REPORTS_DIR)" >> .gitignore
	@grep -qxF "$(ARTIFACTS_DIR)" .gitignore || echo "$(ARTIFACTS_DIR)" >> .gitignore
	@grep -qxF "node_modules" .gitignore || echo "node_modules" >> .gitignore
	@grep -qxF ".venv" .gitignore || echo ".venv" >> .gitignore
	@grep -qxF ".pytest_cache" .gitignore || echo ".pytest_cache" >> .gitignore
	@grep -qxF ".pytest_tmp" .gitignore || echo ".pytest_tmp" >> .gitignore
	@grep -qxF ".benchmarks" .gitignore || echo ".benchmarks" >> .gitignore
	@grep -qxF "tools" .gitignore || echo "tools" >> .gitignore
	@grep -qxF ".mcp_profiles.key" .gitignore || echo ".mcp_profiles.key" >> .gitignore
	@grep -qxF "target" .gitignore || echo "target" >> .gitignore
	@test -f .prettierignore || printf "dist/\nbuild/\ncoverage/\nreports/\nartifacts/\n.cache/\n.venv/\n.pytest_cache/\n.pytest_tmp/\n.clang-format\n.clang-tidy\n" > .prettierignore
	@test -f .jscpdignore   || printf "**/node_modules/**\n**/target/**\n**/dist/**\n**/build/**\n**/reports/**\n**/artifacts/**\n**/.venv/**\n**/.pytest_cache/**\n**/.pytest_tmp/**\n**/.benchmarks/**\n**/tools/**\n**/*.lock\n" > .jscpdignore
	@test -f .clang-format || printf "BasedOnStyle: LLVM\nIndentWidth: 2\nColumnLimit: 100\n" > .clang-format
	@test -f .clang-tidy || printf "Checks: '-*'\nWarningsAsErrors: ''\n" > .clang-tidy
	@test -f stylelint.config.mjs || printf '/** @type {import("stylelint").Config} */\nexport default {\n  extends: ["stylelint-config-standard"],\n};\n' > stylelint.config.mjs
	@test -f $(CONFIGS_DIR)/guardrails.json || printf '{\n "dup_threshold_pct": %s,\n "cyclomatic_max": %s,\n "cognitive_max": %s,\n "p95_budget_ms": 0,\n "p99_budget_ms": 0\n}\n' "$(DUP_THRESHOLD)" "$(CYCLO_LIMIT)" "$(COG_LIMIT)" > $(CONFIGS_DIR)/guardrails.json
	@test -f clippy.toml || printf 'cognitive-complexity-threshold = %s\n' "$(COG_LIMIT)" > clippy.toml
	@test -f Makefile.local || printf "ESLINT_VERSION=%s\nESLINT_SONARJS_VER=%s\nPRETTIER_VERSION=%s\nSTYLELINT_VERSION=%s\nSTYLELINT_STD_VER=%s\nSPECTRAL_VERSION=%s\nREDOCLY_VERSION=%s\nJSCPD_VERSION=%s\nCLANG_FORMAT_NPM_VER=%s\nLIZARD_VERSION=%s\nRADON_VERSION=%s\nXENON_VERSION=%s\nPYTEST_VERSION=%s\nPYTEST_XDIST_VERSION=%s\nPYTEST_BENCHMARK_VER=%s\nPIPAUDIT_VERSION=%s\nGOCYCLO_VERSION=%s\nCARGO_CYCLONEDX_VERSION=%s\n" \
	"$(ESLINT_VERSION)" "$(ESLINT_SONARJS_VER)" "$(PRETTIER_VERSION)" "$(STYLELINT_VERSION)" "$(STYLELINT_STD_VER)" "$(SPECTRAL_VERSION)" "$(REDOCLY_VERSION)" "$(JSCPD_VERSION)" "$(CLANG_FORMAT_NPM_VER)" "$(LIZARD_VERSION)" "$(RADON_VERSION)" "$(XENON_VERSION)" "$(PYTEST_VERSION)" "$(PYTEST_XDIST_VERSION)" "$(PYTEST_BENCHMARK_VER)" "$(PIPAUDIT_VERSION)" "$(GOCYCLO_VERSION)" "$(CARGO_CYCLONEDX_VERSION)" > Makefile.local
	@echo "✓ quicksetup done"

# ---- Ensure Node (local install if missing) ----
.PHONY: ensure-node
ensure-node:
	@$(ensure_dirs)
	@if ! command -v node >/dev/null 2>&1; then \
	  echo "Node not found → installing local $(NODE_VERSION) into $(TOOLS_DIR)/node" | $(append_log); \
	  bash scripts/bootstrap/install_node.sh "$(NODE_VERSION)" "$(TOOLS_DIR)/node"; \
	fi

# ---- Ensure Python venv ----
PY := .venv/bin/python3
PIP := .venv/bin/pip
.PHONY: ensure-pyvenv
ensure-pyvenv:
	@$(ensure_dirs)
	@if [ ! -d .venv ]; then python3 -m venv .venv || true; .venv/bin/python3 -m pip install -U pip >/dev/null || true; fi

# ---- Install Dev Tooling ----
.PHONY: deps
deps:
	@$(ensure_dirs)
	@test -f package.json || printf '{\n  "name":"flagship-project","private":true\n}\n' > package.json
	@node_refresh=0; \
	if [ "$(FORCE_NODE_DEPS)" = "1" ]; then node_refresh=1; \
	elif [ ! -d node_modules ] || [ ! -f $(NODE_STAMP) ]; then node_refresh=1; \
	fi; \
	if [ $$node_refresh -eq 1 ]; then \
	  $(MAKE) ensure-node >/dev/null; \
	  if [ -f package-lock.json ]; then \
		$(NODE_RUNNER) ci --no-audit --no-fund >/dev/null 2>&1 || true; \
	  else \
		$(NODE_RUNNER) install --no-audit --no-fund >/dev/null 2>&1 || true; \
	  fi; \
	  echo "Installing JS devDeps (pinned)..." | $(append_log); \
	  $(NODE_RUNNER) install -D --save-exact --no-audit --no-fund jscpd@$(JSCPD_VERSION) eslint@$(ESLINT_VERSION) @eslint/js@$(ESLINT_VERSION) eslint-plugin-sonarjs@$(ESLINT_SONARJS_VER) prettier@$(PRETTIER_VERSION) stylelint@$(STYLELINT_VERSION) stylelint-config-standard@$(STYLELINT_STD_VER) @redocly/cli@$(REDOCLY_VERSION) redoc@^2.4.0 @stoplight/spectral-cli@$(SPECTRAL_VERSION) clang-format@$(CLANG_FORMAT_NPM_VER) >/dev/null; \
	  touch $(NODE_STAMP); \
	else \
	  echo "Node devDeps cached (FORCE_NODE_DEPS=1 to refresh)" | $(append_log); \
	fi
	@py_refresh=0; \
	if [ "$(FORCE_PY_DEPS)" = "1" ]; then py_refresh=1; \
	elif [ ! -x .venv/bin/python3 ] || [ ! -f $(PYTHON_STAMP) ]; then py_refresh=1; \
	fi; \
	if [ $$py_refresh -eq 1 ]; then \
	  $(MAKE) ensure-pyvenv >/dev/null; \
	  echo "Installing Python tools into .venv..." | $(append_log); \
	  $(PY) -m pip install -U lizard==$(LIZARD_VERSION) radon==$(RADON_VERSION) xenon==$(XENON_VERSION) pytest==$(PYTEST_VERSION) pytest-xdist==$(PYTEST_XDIST_VERSION) pytest-benchmark==$(PYTEST_BENCHMARK_VER) pip-audit==$(PIPAUDIT_VERSION) >/dev/null; \
	  $(PY) scripts/security/patch_pip.py | $(append_log); \
	  touch $(PYTHON_STAMP); \
	else \
	  echo "Python tooling cached (FORCE_PY_DEPS=1 to refresh)" | $(append_log); \
	fi
	@if [ -n "$(HAS_RUST)" ]; then \
	  echo "Rust toolchain components (clippy/rustfmt)..." | $(append_log); \
	  ( command -v rustup >/dev/null && rustup component add clippy rustfmt || true ); \
	  if command -v cargo >/dev/null 2>&1; then \
		if cargo cyclonedx --help >/dev/null 2>&1; then :; else cargo install cargo-cyclonedx --locked --version $(CARGO_CYCLONEDX_VERSION) >/dev/null 2>&1 || true; fi; \
	  fi; \
	fi
	@if [ -n "$(HAS_GO)" ]; then \
	  go_refresh=0; \
	  if [ "$(FORCE_GO_DEPS)" = "1" ]; then go_refresh=1; \
	  elif [ ! -f $(GO_STAMP) ]; then go_refresh=1; \
	  fi; \
	  if [ $$go_refresh -eq 1 ]; then \
	    echo "Installing Go tools..." | $(append_log); \
	    ( command -v go >/dev/null && GOBIN=$$(pwd)/$(TOOLS_DIR)/bin go install github.com/fzipp/gocyclo@$(GOCYCLO_VERSION) || true ); \
	    mkdir -p $(TOOLS_DIR)/bin; export PATH="$(TOOLS_DIR)/bin:$$PATH"; \
	    touch $(GO_STAMP); \
	  else \
	    echo "Go tooling cached (FORCE_GO_DEPS=1 to refresh)" | $(append_log); \
	  fi; \
	fi
	@echo "✓ deps installed (cached where possible)" | $(append_log)

# ---- Ensure Syft binary (local) ----
.PHONY: ensure-syft
ensure-syft:
	@$(ensure_dirs)
	@if ! command -v syft >/dev/null 2>&1 && [ ! -x $(TOOLS_DIR)/syft/syft ]; then \
	    echo "Syft not found → installing local $(SYFT_VERSION)" | $(append_log); \
	    bash scripts/bootstrap/install_syft.sh "$(SYFT_VERSION)" "$(TOOLS_DIR)/syft"; \
	fi

# ---- Doctor (detected stacks only) ----
.PHONY: doctor
doctor:
	@$(ensure_dirs)
	@status=0; echo "Doctor (detected stacks):" | $(append_log); \
	if [ -n "$(HAS_NODE)" ]; then command -v node >/dev/null || { echo "MISS node" | $(append_log); status=1; }; fi; \
	if [ -n "$(HAS_RUST)" ]; then command -v cargo >/dev/null || { echo "MISS cargo" | $(append_log); status=1; }; fi; \
	if [ -n "$(HAS_GO)"   ]; then command -v go    >/dev/null || { echo "MISS go"    | $(append_log); status=1; }; fi; \
	if [ -n "$(HAS_CPP)"  ]; then if command -v clang-format >/dev/null || npx --yes clang-format --version >/dev/null 2>&1; then :; else echo "MISS clang-format" | $(append_log); status=1; fi; fi; \
	if [ $$status -ne 0 ] && [ "$(CI_STRICT)" = "1" ]; then exit 1; fi; echo "doctor status=$$status" | $(append_log)

# ---- Formatting ----
.PHONY: fmt-check fmt
fmt-check:
	@$(ensure_dirs)
	@if [ -n "$(HAS_RUST)" ]; then cargo fmt --all -- --check | $(append_log); fi
	@if [ -n "$(HAS_GO)"   ]; then \
		files=""; \
		if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
			files=$$(git ls-files '*.go'); \
		else \
			files=$$(find . -type f -name '*.go' -not -path './node_modules/*' -not -path './.venv/*' -not -path './reports/*' -not -path './artifacts/*'); \
		fi; \
		if [ -n "$$files" ]; then \
			out=$$(gofmt -s -l $$files); \
			if [ -n "$$out" ]; then \
				echo "$$out" | $(append_log); \
				$(call BLOCKER,"gofmt"); \
			fi; \
		fi; \
	fi
	@if [ -n "$(HAS_CPP)"  ]; then \
		files=""; \
		if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
			files=$$(git ls-files '*.[ch]' '*.hpp' '*.hh' '*.hxx' '*.cc' '*.cxx' '*.cpp'); \
		else \
			files=$$(find . -type f \( -name '*.[ch]' -o -name '*.hpp' -o -name '*.hh' -o -name '*.hxx' -o -name '*.cc' -o -name '*.cxx' -o -name '*.cpp' \) -not -path './node_modules/*' -not -path './.venv/*' -not -path './reports/*' -not -path './artifacts/*'); \
		fi; \
		if [ -n "$$files" ]; then \
			if command -v clang-format >/dev/null; then \
				clang-format -n -Werror $$files | $(append_log); \
			else \
				npx --yes clang-format --version >/dev/null; \
				npx --yes clang-format -n -Werror $$files | $(append_log); \
			fi; \
		fi; \
	fi
	@if [ -n "$(HAS_NODE)" ]; then npx --yes prettier@$(PRETTIER_VERSION) . --check | $(append_log); fi
	@if [ -n "$(HAS_CSS)"  ]; then npx --yes stylelint@$(STYLELINT_VERSION) --allow-empty-input "**/*.{css,scss,sass}" | $(append_log); fi

fmt:
	@if [ -n "$(HAS_RUST)" ]; then cargo fmt --all | $(append_log); fi
	@if [ -n "$(HAS_GO)"   ]; then \
		files=""; \
		if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
			files=$$(git ls-files '*.go'); \
		else \
			files=$$(find . -type f -name '*.go' -not -path './node_modules/*' -not -path './.venv/*' -not -path './reports/*' -not -path './artifacts/*'); \
		fi; \
		[ -z "$$files" ] || gofmt -s -w $$files | $(append_log); \
	fi
	@if [ -n "$(HAS_CPP)"  ]; then \
		files=""; \
		if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
			files=$$(git ls-files '*.[ch]' '*.hpp' '*.hh' '*.hxx' '*.cc' '*.cxx' '*.cpp'); \
		else \
			files=$$(find . -type f \( -name '*.[ch]' -o -name '*.hpp' -o -name '*.hh' -o -name '*.hxx' -o -name '*.cc' -o -name '*.cxx' -o -name '*.cpp' \) -not -path './node_modules/*' -not -path './.venv/*' -not -path './reports/*' -not -path './artifacts/*'); \
		fi; \
		if [ -n "$$files" ]; then \
			if command -v clang-format >/dev/null; then \
				clang-format -i $$files | $(append_log); \
			else \
				npx --yes clang-format -i $$files | $(append_log); \
			fi; \
		fi; \
	fi
	@if [ -n "$(HAS_NODE)" ]; then npx --yes prettier@$(PRETTIER_VERSION) . --write | $(append_log); fi

# ---- Linters ----
.PHONY: lint
lint:
	@$(ensure_dirs)
	@if [ -n "$(HAS_RUST)" ]; then cargo clippy --all-targets -- -D warnings -W clippy::cognitive_complexity | $(append_log); fi
	@if [ -n "$(HAS_GO)"   ]; then go vet ./... | $(append_log); fi
	@if [ -n "$(HAS_CPP)"  ]; then \
		if [ -f build/compile_commands.json ]; then \
			files=""; \
			if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
				files=$$(git ls-files '*.[ch]' '*.hpp' '*.hh' '*.hxx' '*.cc' '*.cxx' '*.cpp'); \
			else \
				files=$$(find . -type f \( -name '*.[ch]' -o -name '*.hpp' -o -name '*.hh' -o -name '*.hxx' -o -name '*.cc' -o -name '*.cxx' -o -name '*.cpp' \) -not -path './node_modules/*' -not -path './.venv/*' -not -path './reports/*' -not -path './artifacts/*'); \
			fi; \
			[ -z "$$files" ] || clang-tidy $$files -p build | $(append_log); \
		else \
			echo "WARN: no compile_commands.json → clang-tidy skipped" | $(append_log); \
		fi; \
	fi
	@if [ -n "$(HAS_NODE)" ]; then npx --yes eslint@$(ESLINT_VERSION) . --max-warnings=0 | $(append_log); fi
	@if [ -n "$(HAS_CSS)"  ]; then npx --yes stylelint@$(STYLELINT_VERSION) --allow-empty-input "**/*.{css,scss,sass}" | $(append_log); fi

# ---- Tests / Race / Fault ----
.PHONY: test race fault
test:
	@set -e; $(ensure_dirs)
	@if [ -n "$(HAS_RUST)" ]; then cargo test --all-features --quiet | $(append_log); fi
	@if [ -n "$(HAS_GO)"   ]; then if [ "$(CI_STRICT)" = "1" ]; then go test -race ./... | $(append_log); else go test ./... | $(append_log); fi; fi
	@if [ -n "$(HAS_NODE)" ]; then if [ -f package.json ] && grep -q '"test"' package.json; then $(NODE_RUNNER) test | $(append_log); else echo "INFO: no npm test script" | $(append_log); fi; fi
	@if [ -n "$(HAS_PY)"   ]; then \
		has_tests=0; \
		if [ -d tests ]; then \
			has_tests=1; \
		elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
			py_match=$$(git ls-files 'tests/*.py'); \
			if [ -n "$$py_match" ]; then has_tests=1; fi; \
		fi; \
		if [ $$has_tests -eq 1 ]; then \
			.venv/bin/pytest -q | $(append_log); \
		else \
			echo "INFO: no pytest tests" | $(append_log); \
		fi; \
	fi
	@if [ -n "$(HAS_CPP)"  ]; then if [ -f build/CTestTestfile.cmake ]; then ctest --output-on-failure | $(append_log); else echo "INFO: no CTest config" | $(append_log); fi; fi

race:
	@if [ -n "$(HAS_GO)" ]; then go test -race ./... | $(append_log); fi
	@if [ -n "$(HAS_PY)" ]; then \
		has_tests=0; \
		if [ -d tests ]; then has_tests=1; \
		elif git rev-parse --is-inside-work-tree >/dev/null 2>&1; then \
			py_match=$$(git ls-files 'tests/*.py'); \
			if [ -n "$$py_match" ]; then has_tests=1; fi; \
		fi; \
		if .venv/bin/python -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('xdist') else 1)"; then \
			if [ $$has_tests -eq 1 ]; then \
				tmpdir=".pytest_tmp"; \
				rm -rf "$$tmpdir"; \
				PYTEST_ADDOPTS="--basetemp=$$tmpdir" .venv/bin/pytest -n auto -q | $(append_log); \
			else \
				echo "INFO: no pytest tests (race skipped)" | $(append_log); \
			fi; \
		else \
			echo "WARN: pytest-xdist not installed" | $(append_log); \
		fi; \
	fi

fault:
	@if [ -n "$(HAS_PY)" ]; then if ls tests/*fault*py >/dev/null 2>&1; then .venv/bin/pytest -q -k "fault or crash or chaos" | $(append_log); else echo "INFO: no fault tests" | $(append_log); fi; fi

# ---- Duplication ----
.PHONY: dup
dup:
	@$(ensure_dirs)
	@npx --yes jscpd@$(JSCPD_VERSION) --threshold $(DUP_THRESHOLD) --ignore "node_modules/**,target/**,dist/**,build/**,$(REPORTS_DIR)/**,$(ARTIFACTS_DIR)/**,.venv/**,.pytest_cache/**,.pytest_tmp/**,.benchmarks/**,tools/**" --reporters console,json --output $(REPORTS_DIR)/jscpd . | $(append_log)
	@$(PYTHON) scripts/quality/complexity.py "$(REPORTS_DIR)/metrics.json" "$(REPORTS_DIR)/lizard.json" "$(REPORTS_DIR)/jscpd/jscpd-report.json" "$(CYCLO_LIMIT)" "$(COG_LIMIT)" "$(DUP_THRESHOLD)" | $(append_log)

# ---- Complexity (safe) ----
.PHONY: complexity complexity-safe
complexity complexity-safe:
	@$(ensure_dirs)
	@$(SCRIPTS_DIR)/quality/complexity.sh "$(CYCLO_LIMIT)" "$(COG_LIMIT)" "$(REPORTS_DIR)" "$(DUP_THRESHOLD)" | $(append_log)

# ---- Contracts (OpenAPI) ----
.PHONY: contracts sync-docs
contracts sync-docs:
	@set -e; $(ensure_dirs)
	@openapi=""; for p in api/openapi.yaml api/openapi.yml api/openapi.json docs/openapi.yaml docs/openapi.yml docs/openapi.json; do [ -f "$$p" ] && openapi="$$p" && break; done; \
	if [ -z "$$openapi" ]; then echo "INFO: no openapi spec"; exit 0; fi; \
	npx --yes @stoplight/spectral-cli@$(SPECTRAL_VERSION) lint "$$openapi" | $(append_log); \
	npx --yes @redocly/cli@$(REDOCLY_VERSION) bundle "$$openapi" -o "$(ARTIFACTS_DIR)/openapi.bundle.yaml" | $(append_log)

# ---- SBOM (Syft CycloneDX; docker or local binary) ----
.PHONY: sbom
sbom:
	@$(ensure_dirs)
	@out="$(REPORTS_DIR)/sbom.cdx.json"; status=0; \
	if command -v syft >/dev/null 2>&1; then syft dir:. $(SBOM_ARGS) -o cyclonedx-json > "$$out" || status=1; \
	elif [ -x $(TOOLS_DIR)/syft/syft ]; then $(TOOLS_DIR)/syft/syft dir:. $(SBOM_ARGS) -o cyclonedx-json > "$$out" || status=1; \
	elif command -v docker >/dev/null 2>&1; then docker run --rm -v "$$(pwd):/src" -w /src anchore/syft:$(SYFT_VERSION) dir:. $(SBOM_ARGS) -o cyclonedx-json > "$$out" || status=1; \
	else echo '{"status":"skip","reason":"no syft/docker"}' > "$$out"; [ "$(CI_STRICT)" = "1" ] && status=1 || status=0; fi; \
	if [ $$status -eq 0 ] && [ -n "$(HAS_RUST)" ] && command -v cargo >/dev/null 2>&1 && cargo cyclonedx --help >/dev/null 2>&1; then \
	  cargo_tmp=$$(mktemp); \
	  if cargo cyclonedx --format json --output "$$cargo_tmp" >/dev/null 2>&1; then \
	    python3 scripts/quality/merge_cyclonedx.py "$$out" "$$cargo_tmp"; \
	  else \
	    echo "WARN: cargo cyclonedx failed" >&2; \
	  fi; \
	  rm -f "$$cargo_tmp"; \
	fi; \
	[ $$status -eq 0 ] || $(call BLOCKER,"sbom generation failed")

# ---- Bench aggregation ----
.PHONY: bench-collect
bench-collect:
	@$(ensure_dirs)
	@$(SCRIPTS_DIR)/bench/parse_p95_p99.sh "$(REPORTS_DIR)" | $(append_log)

.PHONY: security
security:
	@$(ensure_dirs); \
	 if [ "$(ALLOW_OFFLINE_SECURITY)" = "1" ]; then \
		 echo "{\"summary\":{\"note\":\"security skipped (ALLOW_OFFLINE_SECURITY=1)\"}}" > $(REPORTS_DIR)/security.json; \
		 echo "INFO: security skipped (ALLOW_OFFLINE_SECURITY=1)" | $(append_log); \
		 exit 0; \
	 fi; \
	 tmpdir=$$(mktemp -d); \
	 npm_file=$$tmpdir/npm.json; pip_file=$$tmpdir/pip.json; \
	 npm_present=0; \
	 if [ -f package.json ] && [ -d node_modules ]; then \
		npm_present=1; \
		npm_status=0; \
		$(NODE_RUNNER) audit --json --audit-level=high > "$$npm_file" 2>"$$tmpdir/npm.err" || npm_status=$$?; \
		if [ $$npm_status -gt 1 ]; then echo "WARN: npm audit exit code $$npm_status" >&2; fi; \
		if [ -s "$$tmpdir/npm.err" ]; then cat "$$tmpdir/npm.err"; fi; \
		if [ ! -s "$$npm_file" ]; then echo '{}' > "$$npm_file"; fi; \
	 else \
		echo "INFO: npm audit skipped (no node_modules)"; \
		echo '{}' > "$$npm_file"; \
	 fi; \
	 pip_status="not_required"; \
	 if [ -n "$(HAS_PY)" ]; then \
		pip_status="missing_tool"; \
		if [ -x .venv/bin/pip-audit ]; then \
			pip_status="ran"; \
			req_args=""; \
			[ -f requirements.txt ] && req_args="-r requirements.txt"; \
			pip_status_code=0; \
			.venv/bin/pip-audit $$req_args -f json --progress-spinner off > "$$pip_file" 2>"$$tmpdir/pip.err" || pip_status_code=$$?; \
			if [ $$pip_status_code -gt 1 ]; then pip_status="error"; echo "WARN: pip-audit exit code $$pip_status_code" >&2; fi; \
			if [ -s "$$tmpdir/pip.err" ]; then cat "$$tmpdir/pip.err"; fi; \
			if [ ! -s "$$pip_file" ]; then echo '[]' > "$$pip_file"; fi; \
		else \
			echo '{"status":"skip","reason":"pip-audit missing"}' > "$$pip_file"; \
		fi; \
	 else \
		echo '{"status":"skip","reason":"python stack not detected"}' > "$$pip_file"; \
	 fi; \
	 CI_STRICT="$(CI_STRICT)" $(PY) scripts/security/aggregate.py "$$npm_file" "$$npm_present" "$$pip_file" "$$pip_status" "$(REPORTS_DIR)/security.json"; \
	 rm -rf "$$tmpdir"

.PHONY: security-smoke-missing-pip-audit
security-smoke-missing-pip-audit:
	@$(ensure_dirs); \
	 if [ ! -x .venv/bin/pip-audit ]; then \
		echo "BLOCKER: pip-audit already missing, run make deps first" >&2; exit 2; \
	 fi; \
	 tmpdir=$$(mktemp -d); \
	 trap 'mv "$$tmpdir/pip-audit" .venv/bin/pip-audit >/dev/null 2>&1 || true; rm -rf "$$tmpdir";' EXIT; \
	 cp .venv/bin/pip-audit "$$tmpdir/" && rm -f .venv/bin/pip-audit; \
	 if $(MAKE) CI_STRICT=1 security >/dev/null 2>&1; then \
		mv "$$tmpdir/pip-audit" .venv/bin/pip-audit >/dev/null 2>&1 || true; rm -rf "$$tmpdir"; \
		echo "BLOCKER: security succeeded despite missing pip-audit" >&2; exit 2; \
	 fi; \
	 mv "$$tmpdir/pip-audit" .venv/bin/pip-audit >/dev/null 2>&1 || true; \
	 rm -rf "$$tmpdir"; \
	 echo "✓ security target fails as expected when pip-audit is absent"
# ---- Guardrails (external script for robust exit codes) ----
.PHONY: guard
guard:
	@$(ensure_dirs)
	@python3 scripts/quality/guard.py "$(CONFIGS_DIR)/guardrails.json" "$(REPORTS_DIR)/metrics.json" | $(append_log)

# ---- Aggregated review / CI ----
.PHONY: review ci
review:
	@$(ensure_dirs); : > $(LOG_FILE)
	@{\
	  echo ">>> fmt-check"; $(MAKE) --no-print-directory fmt-check; \
	  echo ">>> lint"; $(MAKE) --no-print-directory lint; \
	  echo ">>> test"; $(MAKE) --no-print-directory test; \
	  echo ">>> race (soft)"; $(MAKE) --no-print-directory race || true; \
	  echo ">>> dup"; $(MAKE) --no-print-directory dup; \
	  echo ">>> complexity"; $(MAKE) --no-print-directory complexity; \
	  echo ">>> bench-collect"; $(MAKE) --no-print-directory bench-collect; \
	  echo ">>> guard (soft)"; if [ "$(CI_STRICT)" = "1" ]; then $(MAKE) --no-print-directory guard; else $(MAKE) --no-print-directory guard || true; fi; \
	  echo ">>> security (soft)"; if [ "$(CI_STRICT)" = "1" ]; then $(MAKE) --no-print-directory security; else $(MAKE) --no-print-directory security || true; fi; \
	  echo ">>> contracts (soft)"; $(MAKE) --no-print-directory contracts || true; \
	  echo ">>> sbom"; $(MAKE) --no-print-directory sbom; \
	} 2>&1 | $(append_log)
	@printf '{"status":"pass","log":"%s"}\n' "$(LOG_FILE)" > $(REPORTS_DIR)/verify.json
	@echo "✓ review passed → $(REPORTS_DIR)/verify.json"

ci:
	@$(MAKE) CI_STRICT=1 doctor
	@$(MAKE) CI_STRICT=1 review

.PHONY: clean dist
clean:
	@rm -rf node_modules .venv .pytest_cache .pytest_tmp .benchmarks $(REPORTS_DIR) $(ARTIFACTS_DIR) tools .mcp_profiles.key
	@echo "✓ workspace cleaned"

dist: clean
	@mkdir -p $(ARTIFACTS_DIR)
	@tar -czf $(DIST_FILE) \
		Makefile \
		Makefile.local \
		eslint.config.mjs \
		stylelint.config.mjs \
		.clang-format \
		.clang-tidy \
		.prettierignore \
		.jscpdignore \
		.gitignore \
		clippy.toml \
		configs \
		scripts \
		package.json
	@echo "✓ dist artifact → $(DIST_FILE)"

# ---- C++ helpers ----
.PHONY: cpp-compile-commands
cpp-compile-commands:
	@$(ensure_dirs)
	@$(SCRIPTS_DIR)/cpp/generate_compile_commands.sh | $(append_log); echo "OK: compile_commands.json"

# ---- Meta ----
.PHONY: status plan roadmap sync-docs
status:
	@echo "Stacks: rust=$(if $(HAS_RUST),yes,no) go=$(if $(HAS_GO),yes,no) node=$(if $(HAS_NODE),yes,no) cpp=$(if $(HAS_CPP),yes,no) css=$(if $(HAS_CSS),yes,no) py=$(if $(HAS_PY),yes,no)" | $(append_log)
plan:
	@echo "Use todo.machine.md + configs/guardrails.json for thresholds." | $(append_log)
roadmap:
	@echo "Integrate with MCP (Linear/Jira) outside Make." | $(append_log)
