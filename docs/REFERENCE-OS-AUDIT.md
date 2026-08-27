# Reference OS audit

Reference: [alanagoyal/alanagoyal](https://github.com/alanagoyal/alanagoyal), reviewed at the commit cloned on 27 August 2026.

## Recommendation

Keep the Synergetic Human shell and Brain architecture. Selectively adapt interaction patterns whose implementation is clearly stronger, rather than migrating the foundational window manager or any application data model.

### Direct adaptations

- Pointer-distance Gaussian Dock magnification and its compact spacing/material proportions.
- Traffic-light sizing, hover-only glyphs, and inactive-window behavior.
- Compact menu-bar proportions and status-control treatment.
- Motion timing and focus/press feedback for system controls.
- The general separation of desktop and mobile application presenters.

### Reference only

- Finder toolbar, sidebar, selection, and view-mode vocabulary.
- Notes list/detail split and mobile back-navigation model.
- Messages conversation list, bubbles, typing state, reactions, drafts, and minimized queue continuity.
- Photos grid, viewer, collections, favorites, time filtering, and metadata panel.
- Settings sidebar/panel composition, menus, popovers, and notification widgets.

These should be recreated around Synergetic Human content and data boundaries rather than copied wholesale.

### Keep from Synergetic Human

- Window dragging, resizing, layering, minimizing/reopening, routing, and responsive home screen.
- The Books Brain, 165-book Library, passage grouping, reader, provenance, and staging architecture.
- Existing app registry and the conceptual mapping from familiar applications into a personal knowledge system.

## Icons

The reference's six 512px PNG application icons appear extremely close to Apple artwork. No asset-specific provenance or third-party attribution was found in the repository. The repository's MIT license covers the author's contribution but is not evidence that Apple-derived artwork can be relicensed. Those files are excluded.

Keep the current original vectors temporarily. Commission or generate a cohesive set of original transparent 1024px raster icons with documented provenance, using familiar application categories but distinct silhouettes, internal objects, lighting, and color construction. Do not use Apple logos or copied Apple icon artwork.

## Applications

- **Finder:** retain Brain navigation; adopt only spatial grammar and selection/toolbars.
- **Notes:** later split data/state from desktop and mobile presenters, preserving source and publication status.
- **Messages:** reuse UI concepts only. The future response system needs server-side source retrieval, citation/provenance records, explicit thinker/source identity, and stronger persistence/privacy review than the reference client-local AI conversation model.
- **Photos:** the grid/viewer patterns are useful. A future data model should preserve original file identity, capture time, EXIF, optional GPS, place links, derivatives, collections, and visibility. The reference iPhone Shortcut is a useful ingestion concept, but its public insert policies and static shared API key should not be carried over unchanged.
- **Settings:** useful shell for “About This Human” and local display/preferences; keep personal/system information distinct from editable private data.

## Licensing

MIT code adaptations require preservation of the copyright and permission notice in copies or substantial portions. A third-party notice is included in this repository. Third-party artwork is not assumed to inherit the code license.

## Migration sequence

1. Dock behavior and core control primitives.
2. Menu bar and window-chrome refinement.
3. App-by-app presentation improvements without changing Brain queries.
4. Original high-fidelity icon production and review.
5. Later, domain-specific Notes, Messages, Photos, Finder, and Settings implementations with explicit data/security designs.

## Risks

- Mistaking bundled Apple-derived artwork for safely reusable MIT assets.
- Importing another person's data model into the Brain.
- Weakening public/private boundaries, especially for AI conversations and photo ingestion.
- Destabilizing a working Library with a foundational shell rewrite.
- Pursuing surface similarity at the cost of Synergetic Human's own visual identity.
