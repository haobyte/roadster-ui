# Third-party notices

| Dependency | Version | Purpose | License |
| --- | --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | 0.180.0 | 3D rendering in the browser; bundled into the runtime JavaScript. | MIT. The full license is in [licenses/three.txt](licenses/three.txt) and is also copied to `dist/THREE-LICENSE.txt` during the build. |
| [esbuild](https://github.com/evanw/esbuild) | 0.25.12 | Build tooling used during development. | MIT. The license is included in the npm package. |
| [Playwright](https://github.com/microsoft/playwright) | 1.62.1 | Browser regression testing during development. | Apache-2.0. The license and notices are included in the npm package. |

Versions and transitive dependencies are pinned in `package-lock.json`. Build tools and test browsers are not included in the Pages static build.

See [ASSETS.md](ASSETS.md) for separate notes on models and images. The project's code license does not replace the original terms of these dependencies and assets.
