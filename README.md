# kings_wood

킹스우드 2차단지를 공개 좌표 기준 3D 장면 위에 겹쳐 보는 모바일 우선 웹사이트입니다.

## Run

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`VITE_GOOGLE_MAPS_API_KEY`를 넣으면 Google Photorealistic 3D Tiles 로딩이 더 안정적입니다.

## Build

```bash
pnpm build
pnpm preview
```

`vite.config.ts`는 GitHub Pages용 `base=/kings_wood/`를 production에서 자동 적용합니다.
