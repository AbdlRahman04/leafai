# Architecture decisions

## Existing paths are stable

The current `frontend/` and `leafai/backend/` locations are used by local commands and application imports, so this structural pass adds documentation and boundaries without moving files.

## Backend assets are module-relative

Model, dataset, reference-image, cache, and storage paths are resolved from `leafai/backend/app.py`. This prevents an IDE or root-level launch command from changing where the backend looks for assets.

## Generated data is separate from source assets

Uploads, prediction history, and performance caches remain under `leafai/backend/storage` and `leafai/backend/cache`. They should not be treated as source code or model assets.
