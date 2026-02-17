# LendFlow Presentation Video

This folder contains auto-generated product presentation videos for the loan origination and servicing platform.

## Outputs

- Full captioned: `presentation/video/lendflow-presentation.mp4`
- Short captioned: `presentation/video/lendflow-presentation-short.mp4`
- Full narrated: `presentation/video/lendflow-presentation-narrated.mp4`
- Short narrated: `presentation/video/lendflow-presentation-short-narrated.mp4`

## Regenerate

1. Start API + web app:

```bash
npm run api:dev
npm run dev:web -- --host 127.0.0.1 --port 5173
```

2. Capture screenshots:

```bash
node scripts/capture-presentation-screenshots.mjs
```

3. Render videos:

```bash
# Full captioned
node scripts/generate-presentation-video.mjs

# Short captioned
PRESENTATION_VARIANT=short node scripts/generate-presentation-video.mjs

# Full narrated (requires macOS speech synthesis access)
PRESENTATION_NARRATED=true node scripts/generate-presentation-video.mjs

# Short narrated
PRESENTATION_VARIANT=short PRESENTATION_NARRATED=true node scripts/generate-presentation-video.mjs
```

## Customization

```bash
PRESENTATION_BRAND_NAME="Your Company" \
PRESENTATION_TAGLINE="Scale without the Chaos - Smarter Workflows. Seamless Funding." \
PRESENTATION_VARIANT=short \
PRESENTATION_NARRATED=true \
PRESENTATION_VOICE=Samantha \
PRESENTATION_RATE=176 \
node scripts/generate-presentation-video.mjs
```

### Optional custom output path

```bash
PRESENTATION_OUTPUT="presentation/video/custom-demo.mp4" node scripts/generate-presentation-video.mjs
```

## Notes

- Rendering uses `ffmpeg-static`.
- Captions are burned into each frame.
- `presentation/video/narration-script.md` contains reference voiceover copy.
