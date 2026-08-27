# Stage 13 — Personality, Interaction, and Delight

Status: implemented for isolated staging review. Production, production Supabase, DNS, and `main` are untouched.

## Product shape

Stage 13 adds a small system suite without changing the accepted Dock, window manager, utility applications, or mobile home screen. Trash and Software Update are first-class public experiences. Activity Monitor and Terminal are discoverable through Finder and system menus. Screen Time and three interpretive lenses live naturally inside Settings.

## Experiences

- **Trash:** Finder-like list/inspector composition, selection, double-click, native confirmation sheet, contextual copy for Become a Day Trader, local visitor restoration, and authenticated administrator restoration through the protected Control Center command.
- **Software Update:** a compact release-notes surface driven by the existing editable snapshot. Older snapshots remain stored and can support version browsing later.
- **Activity Monitor:** a process list and restrained inspector with status, optional start label, relationships, detail, and one handcrafted Quit response. No activity is measured or inferred.
- **Settings:** About This Human, Current Configuration, Screen Time, Astrology, Human Design, and Gene Keys. Current fields use public current-state/update data. The three lenses deliberately show polished unconfigured states; no private archive data was imported.
- **Screen Time:** a manual editorial snapshot derived from public current state. It reports no minutes or percentages.
- **Terminal:** a closed handcrafted command interpreter supporting `help`, `whoami`, `whereis joe`, `now`, `books`, `places`, `history`, `clear`, `cat consciousness.txt`, and `sudo become-enlightened`. It has no shell, arbitrary execution, or LLM.
- **System details:** Software Update opens from its status popover; Activity Monitor and Terminal appear in Explore; the desktop context menu can open Terminal; Wi-Fi includes one additional fictional handcrafted network.
- **Finder:** the sidebar introduces the public conceptual `/Joe` filesystem and a small System list. No real filesystem paths or private Kortex archive paths are exposed.

## Data and editorial control

`activity_monitor_processes` is a narrow manually authored table with public/private visibility, editorial and lifecycle states, RLS, an allowlisted-admin policy, and a public view that exposes only public + approved + active rows. Control Center adds one compact Activity editor. Software Update and Trash retain their existing editors.

The Stage 13 import is guarded to the known staging project, deterministic, and idempotent. It publishes one current Software Update, four Trash records, and six Activity processes for staging review. Earlier invented Trash prototype rows are retained privately rather than deleted.

## Factual versus editorial/playful

- **Explicitly supplied/current factual direction:** Joe is in Bosnia; he is building Synergetic Human OS, experimenting with AI-assisted creation, reading *Cosmos and Psyche*, exploring planetary transits, trading remains present, and the newsletter is no longer treated as an obligation.
- **Explicitly supplied editorial seeds:** the Software Update section wording, four named Trash records, process names/status concepts, too-many-rabbit-holes, and uncertainty about information volume.
- **Playful interface copy:** `/earth`, Consensus Reality, Innernet, the contextual day-trader restoration button, the unquittable OS process, and Terminal responses. These are interface jokes, not biographical claims or measurements.
- **Placeholders:** Astrology, Human Design, and Gene Keys values/charts are intentionally absent. Their screens demonstrate information architecture only.

## Security and privacy boundary

- Anonymous access can read only the narrow public Activity view; the base table returns 401.
- Public Trash and Software Update continue through public-safe views.
- Central Trash restoration and all Activity edits repeat authenticated admin and allowlist checks server-side.
- No service-role credential appears in browser code.
- No private archives, astrology records, identifying data, filesystem paths, inferred psychological states, or quantified-self data were imported.

## Intentionally deferred

Historical version browsing, Activity percentages, automatic tracking, real natal/bodygraph/Gene Keys content, additional Control Center personality modules, Finder/Spotlight Brain exploration, expanded Maps, Photos ingestion, Browser/Rabbit Holes, Reminders, Messages, Time Machine, embeddings, and AI assistance.

## Editorial review requested

1. Approve, revise, or hide each Stage 13 Software Update line.
2. Approve the four Trash descriptions and category labels.
3. Approve the six Activity process names, statuses, details, and relationships.
4. Decide whether visitor-local Put Back should remain, or whether the button should appear only to Joe.
5. Decide when public-safe birth/chart/profile inputs may be added to Settings.
