# Third-Party Licenses

Audiflow bundles the following components. Their licenses require attribution,
and FFmpeg's LGPL requires an offer of the corresponding source.

## FFmpeg (LGPL-2.1-or-later)

The bundled `ffmpeg` and `ffprobe` binaries are custom minimal builds with
`--disable-gpl --disable-nonfree`. Enabled external libraries: LAME
(`libmp3lame`, LGPL-2.0-or-later) and Opus (`libopus`, BSD-3-Clause).

- License: https://www.ffmpeg.org/legal.html
- Corresponding source: the build script `scripts/build-ffmpeg-minimal.sh`
  plus the upstream FFmpeg 8.1 sources at https://ffmpeg.org/download.html.
  On request the exact source archive used for a release will be provided.

## AndroidX Media3 / ExoPlayer (Apache-2.0)

https://github.com/androidx/media — Copyright The Android Open Source Project.

## Tauri (MIT OR Apache-2.0)

https://github.com/tauri-apps/tauri

## React / React DOM (MIT)

https://github.com/facebook/react

## Rust crates

See `src-tauri/Cargo.lock` for the exact set and versions; each crate carries its
own license in the `license` field of its manifest. Notable: `reqwest`
(MIT/Apache-2.0), `serde` (MIT/Apache-2.0), `tokio` (MIT), `image` (MIT/Apache-2.0).

## Fonts

IRANSans (see `src/fonts/`) is distributed for use with this application.

## Audio libraries

- LAME — LGPL-2.0-or-later — https://lame.sourceforge.io/
- Opus — BSD-3-Clause — https://opus-codec.org/
