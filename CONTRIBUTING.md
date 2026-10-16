# Contributing to Plazai

Thanks for wanting to help! Plazai aims to stay **small, friendly and easy to understand**, so new contributors can find their way around in an afternoon.

## Getting set up

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run typecheck  # before you open a pull request
```

No API key is needed: demo mode covers every screen.

## Guidelines

- **Keep it simple.** Prefer a little plain code over a clever abstraction. Plazai is deliberately less advanced than big agent platforms.
- **Original art only.** Avatar parts, props, sounds and UI must be your own work (or properly licensed and credited). Don't add names, logos, characters, sounds or assets from Nintendo or any other company's games or consoles.
- **Keys stay local.** Never send API keys anywhere except the local `/api/chat` endpoint, and never log them.
- **Match the style:** TypeScript, function components, Zustand for state, and the rounded, glossy look in `src/styles.css`.
- **Small pull requests** with a screenshot or short clip for anything visual.

## Ideas to pick up

- More hair styles, eyes, mouths, hats and outfits (`src/avatar/`)
- New plaza props and areas, or a day/night cycle (`src/world/`)
- Avatar emotes and idle animations (`src/avatar/Avatar3D.tsx`)
- Share an avatar as a short code
- Parallel teams (several avatars working at once)
- Translations

## Reporting bugs

Open an issue with what you did, what you expected, what happened, and your browser and OS. Screenshots help a lot.

By contributing, you agree your work is released under the MIT licence.
