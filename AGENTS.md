# Cursor instructions — Global Film Director

Use Figma file `ybDQ62Q6oBo1W8HkDJyJV4` as design source. The file has 36 numbered screen/spec types, each with Day and Night versions (72 frames). Read `design/figma-manifest.json` for exact node IDs; fetch each frame with Figma MCP rather than only the file root. Implement existing app architecture without destructive changes.

Distinct shell regions:
- Top header: project switcher, production/job status, notifications, theme switch, account.
- Left rail: Projects, Director, Characters, Capture, Storyboard, Edit, Audio, Export, Connectors.
- Contextual inspector: screen-specific controls only.
Avoid duplicating primary navigation in header and rail. Some source wireframes contain duplicated nav; treat this as a known design issue, not an implementation requirement.

Organize routes, reusable components, tokens, screen assets and integration adapters. Treat numbered 24–36 as specifications, not necessarily user-facing routes. Preserve day/night, mobile layouts and creator approvals. Camera capture is not motion retargeting; integration stubs must not pretend to be working. Implement and test progressively. Document discrepancies with Figma and do not claim pixel-perfect fidelity without screenshot comparison.
