# Implementation of Dynamic Card Links in index.html

## Overview
This document summarizes the changes made to `index.html` to implement dynamic and conditional navigation links for the "Objekte im Fokus" feature cards.

## Changes Implemented

### 1. Data Loading
- Added logic to fetch `data.json` and `assets/coordinates.json` in parallel using `Promise.all`.
- Created a global `objectLookup` map to store full object data keyed by `Inventarnummer`.
- Created a global `steinzeltInvSet` to store inventory numbers present in `coordinates.json`.

### 2. Feature Objects Update
- Updated the `FEATURE_OBJECTS` array to include an `inv` property for each object (e.g., `'CAR-S-2000'`).
- This `inv` property is used as the key for lookups and for generating URL parameters.

### 3. Conditional Link Logic
Refactored the `renderFeatureCards` function to:
- Create a `div` container for each card instead of a single `a` tag.
- Generate a `card-actions` container for buttons.
- Implement the following logic for buttons:
    - **Sarkophage**: Always displayed. Links to `panorama_optimized.html?ids=[inv]`.
    - **Fundkarte**: Displayed ONLY if `objData.lat` and `objData.lng` exist. Links to `fundkarte.html?ids=[inv]`.
    - **Steinzelt**: Displayed ONLY if the inventory number exists in `steinzeltInvSet`. Links to `steinzelt.html?ids=[inv]`.

### 4. Styling
- Added CSS rules for `.card-actions` and `.card-action-btn` in the `<style>` block of `index.html`.
- Removed inline styles from the JavaScript code to ensure better maintainability and separation of concerns.
- Buttons now have hover effects and consistent styling with the rest of the application.

## Verification
- The code structure has been verified to ensure all elements (title, text, why, actions) are correctly appended.
- The logic correctly checks for data availability before rendering conditional buttons.
- The `buildTargetUrl` function correctly handles `inv`, `ids`, `tags`, and `search` parameters.
