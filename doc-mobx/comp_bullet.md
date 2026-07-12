# Bullet Position System

The bullet position system keeps list bullets aligned with the first visible line of the entry they mark.

This cannot be solved by static CSS alone because a list entry can be a `Row`, a nested `List`, a wrapped text line, or a mainless list that only passes through its children. The renderer therefore treats bullet placement as a small measurement protocol owned by `DocStore` and carried out by the rendered components.

## Core idea

Each component can have a `CompBulletPosState` under `interactionState.bulletPosStateByCompId`.

The important fields are:

- `counterBulletMeasureReq`: incremented when a component needs a fresh measurement.
- `counterBulletMeasureDone`: incremented when a measurement result is accepted.
- `compIdRequester`: component asking for the position.
- `compIdBasis`: component whose top edge is the coordinate basis for the result.
- `compIdProvider`: component that can measure the first visible content line.
- `posYBulletPreferred`: measured bullet Y position, relative to `compIdBasis`.
- `messageBulletMeasure`: short diagnostic text for the current state.

The measured value is always relative to a basis component, not to the page. This is important because moving a row or list can change the DOM parent and therefore change the coordinate basis even when the visible text component is the same.

## Provider chain

The store does not directly measure DOM layout. It records requests and picks a provider.

Current provider selection lives in `src-mobx/docStoreBulletPos.ts`:

- A segment-level component that can measure its own first line can act as a provider.
- A `Row` delegates to its first bullet position provider child.
- A `List` delegates through its main row.

In the current implementation the provider is `TextSeg`, but the document-level idea is not specific to text segments. The document model only needs a component that can answer "where is the first visible line relative to this basis?"

## Request flow

`List` owns the visible bullets for its child entries.

For each child entry, `List` requests a bullet position using the child entry id as `compIdBasis`. The result becomes the CSS variable `--mobx-list-bullet-y` on `.mobx-list-item`, and the bullet marker uses that variable for its `top` value.

When a child entry is a `Row`, `Row` forwards the request to its provider. When a child entry is a nested `List`, `List` forwards the request through its main row. The provider measures its own first visible line and returns the Y value relative to the requested basis.

For a `TextSeg` provider, the measurement is:

1. Find the basis element from `DocStore.getCompElement(docId, compIdBasis)`.
2. Find the first text line rectangle using a DOM range.
3. Return `lineRect.top - basisRect.top + lineRect.height * 0.55`.

If no text line can be found, the provider falls back to the component rectangle and computed line height.

## Stale result protection

Bullet measurements are asynchronous with respect to React rendering. A drag move, indent, outdent, split, or text wrap can make an old result invalid.

The system avoids reusing an old result in three ways:

- A new request clears `posYBulletPreferred` before the next provider result arrives.
- `docStoreUpdateCompBulletPosResult` rejects a result whose `compIdBasis` does not match the current basis.
- `List` and `Row` only forward provider results when the provider state's `compIdBasis` matches their current request basis.

This means a moved component must measure again after its basis changes. Until then, the bullet falls back to CSS default placement instead of using a stale measured value.

## When measurements are requested

Measurements are requested from normal render effects and from structure-changing operations.

`List` requests measurements for nested child entries when its child list changes. `Row` and `List` forward requests to the selected provider when their own request counter changes.

The provider measures when:

- `counterBulletMeasureReq` changes.
- its text changes.
- its own size changes, observed through `ResizeObserver`.

After drag move completes, `src-mobx/docStoreDrag.ts` requests fresh bullet measurements for list main rows and child entries. This catches cases where the rendered hierarchy and measurement basis changed because of the move.

## Rendering

`src-mobx/comp/List.tsx` applies the measured position to each visual child item:

- `--mobx-list-bullet-y` controls the marker Y position.
- `--mobx-list-bullet-y-next` is used when a connector line needs to reach the next bullet.
- `mobx-list-item-bullet-connected` enables the connector line between adjacent bullets.

`src-mobx/comp/List.css` defines the visible bullet styles:

- `circle` renders a small dot.
- `index` renders a numbered marker.
- `flat` skips the normal bullet box.

Mainless nested lists are rendered as transparent pass-through items. They do not get their own bullet marker, but their children can still request and render bullet positions.

## Design rule

Bullet placement should stay a layout protocol between document components. The document store may know which component can provide bullet position, but document-level processing should not depend on the semantic meaning of a specific segment implementation.
