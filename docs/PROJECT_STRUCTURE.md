# Project structure

## Guiding rule

Organize new code by responsibility, but keep existing public paths stable. Existing frontend imports, backend launch commands, model locations, dataset locations, and API URLs should continue to work.

## Boundaries

| Area | Location | Responsibility |
| --- | --- | --- |
| UI screens | `frontend/src/pages` | Route-level views |
| Reusable UI | `frontend/src/components` | Shared visual building blocks |
| Client API | `frontend/src/services` | HTTP calls and response handling |
| Client state | `frontend/src/hooks` | Reusable React workflows |
| ML/API runtime | `leafai/backend/app.py` | Flask routes and prediction orchestration |
| ML utilities | `leafai/backend/utils.py`, `plant_knowledge.py` | Domain helpers and plant data |
| Training tools | `leafai/backend/train_cnn.py`, `repair_model.py` | Offline model operations |
| Runtime data | `leafai/backend/storage`, `cache` | Generated files only |
| Documentation | root and `docs/` | Setup, decisions, and maintenance notes |

## Rules for future additions

- Put shared frontend behavior in `services/`, `hooks/`, `components/`, or `utils/` instead of duplicating it in pages.
- Keep training scripts separate from request-time API logic.
- Keep generated uploads, caches, and logs under `leafai/backend/storage` or `leafai/backend/cache`.
- Add backend tests under a dedicated `tests/` folder when behavior is expanded.
- Prefer paths derived from `__file__` for backend assets so launch location does not affect behavior.
