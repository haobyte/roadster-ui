# Asset provenance and licensing status

These notes distinguish the provenance of the project code and assets. They are not evidence of permission from third-party rights holders. Original videos, presentation audio, video-derived album cover files, and research screenshots are not included in this branch.

| File | Source | Current status |
| --- | --- | --- |
| `assets/roadster-body.glb` | A 3D reconstruction created in this project from public footage, with a [public Tesla video](https://x.com/Tesla/status/2113730362232680854/video/1) as a visual reference. | The existing runtime model is included. The scope of rights for public distribution of the model, its embedded textures, and the associated design remains unconfirmed. This asset is not covered by the code license. |
| `docs/screenshots/roadster-cockpit.png` | An interface screenshot provided by the project maintainer. | Used in the README and excluded from the Pages runtime build. Including this screenshot does not place the model, marks, or album artwork it depicts under the code's MIT license. The current source build uses generated gradient album covers. |

Album covers are generated with CSS gradients in `src/app.js`, without loading image files. The code that generates these patterns is covered by the project's MIT license.

The GLB model is a visual approximation, not official Tesla CAD or a precise scan. The full Blender files used during development are not included. Animations, lighting, internal demonstration structures, and synthesized audio are created at runtime by code in `src/`.

Tesla names and related marks are outside the scope of the project's code license. This is an unofficial demonstration and does not imply Tesla endorsement or authorization.
