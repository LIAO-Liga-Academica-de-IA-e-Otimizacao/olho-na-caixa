#!/bin/sh
# Opens Chrome with a looping test pattern in place of a webcam.
# The dev server must already be running: make dev

set -eu

video="${TMPDIR:-/tmp}/olho-na-caixa-fake.y4m"
profile="${TMPDIR:-/tmp}/olho-na-caixa-chrome"

if [ ! -f "$video" ]; then
  ffmpeg -y -f lavfi -i "testsrc2=size=640x480:rate=30" -t 2 -pix_fmt yuv420p "$video"
fi

exec google-chrome-stable \
  --user-data-dir="$profile" \
  --use-fake-ui-for-media-stream \
  --use-fake-device-for-media-stream \
  --use-file-for-fake-video-capture="$video" \
  "http://localhost:3001/"
