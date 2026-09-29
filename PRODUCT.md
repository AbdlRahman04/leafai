# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People seeking an educational early screen for plant disease from a leaf
photo. The codebase establishes the task but does not establish a narrower
primary user segment; that remains open.

## Product Purpose

LeafAI analyzes leaf images and returns a likely disease classification,
confidence, severity, and practical next steps. It also supports reports,
model metrics, and a plant assistant. Success means helping a user understand
what the model detected and what they might inspect next.

## Positioning

LeafAI combines a browser-based image capture and upload flow with a
PlantVillage-based CNN classifier to make an initial plant health check
accessible through a web app.

## Operating Context

The application runs as a React/Vite frontend connected to a Flask API and
TensorFlow CNN model. Users upload a leaf image or capture one with a browser
camera. Clear feedback is needed during selection, processing, prediction, and
failure states.

## Capabilities and Constraints

- The model supports the plant categories documented in `leafai/README.md`.
- Predictions are for educational and early-screening purposes, not a
  substitute for professional agricultural diagnosis.
- The project has not been validated as a production-grade diagnostic tool.
- Preserve existing frontend routes and frontend/backend API behavior.

## Evidence on Hand

- Product capabilities and model limitations: `leafai/README.md`.
- Current UI implementation: `frontend/src/`.
- Do not invent diagnostic validation, customer claims, or performance
  benchmarks beyond evidence in the repository.

## Product Principles

- Make the next action clear at each step of a scan.
- Explain model output without implying certainty.
- Keep advice practical, calm, and easy to understand.
