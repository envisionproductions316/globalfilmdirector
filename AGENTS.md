# Cursor instructions — Global Film Director

Use Figma file `ybDQ62Q6oBo1W8HkDJyJV4` as design source. The file has numbered screen/spec types with Day and Night versions. Read `figma-manifest.json` for exact node IDs; fetch each frame with Figma MCP rather than only the file root. Implement existing app architecture without destructive changes.

Distinct shell regions (studio layout target):
- Top header: brand + tagline, primary destination icons (Projects, Chat/Director, Characters, Locations, Capture, Storyboard, Edit, Audio, Export), Director Mode / Studio Mode toggle, cloud status, notifications, theme, account. Connectors remain reachable (Studio Mode / connectors destination).
- Left rail: project card and asset categories (Media Library, Characters, Locations, Scenes, Music, Sound Effects, Visual Styles, My Assets) that deep-link or filter existing data — not a second copy of header destinations.
- Right contextual tools: screen-specific inspector; on Capture this is performance controls, actions, and tool grids.
- Main workspace: screen content (Capture uses the five-step Character Mirror studio layout).

Treat numbered 24–36 as specifications, not necessarily user-facing routes. Preserve day/night, mobile layouts and creator approvals. Camera capture is not motion retargeting; Live Sync, MediaPipe tracking, AI motion tools, wireless phone camera, and cloud sync must stay honestly unavailable until implemented and tested. Integration stubs must not pretend to be working. Implement and test progressively. Document discrepancies with Figma and do not claim pixel-perfect fidelity without screenshot comparison.
