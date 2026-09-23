# DM Collections

A Vendetta/Kettu-style plugin that adds **DM Collections** to the existing Discord long-press action sheet.

## Intended interaction

1. Long-press the Discord **DM/chat-bubble navigation button**.
2. Tap **📁 Create Collection**.
3. Enter a collection name.
4. Pick a preset color or a custom HEX color.
5. Use **📌 DM Collections** / **⚙ Manage Collections** to rename, recolor, or delete collections.

Collection data is stored in the plugin's local Vendetta storage.

## Important compatibility note

Discord/Kettu changes internal React Native module names between releases. This plugin intentionally hooks the existing `showSimpleActionSheet` path instead of replacing the navigation component. If your Kettu build uses a different long-press sheet key/title, the matching strings in `src/index.ts` may need one small adjustment.

The plugin follows the structure of the supplied Vendetta plugin template.
