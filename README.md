# Plazai

**A cosy plaza where AI agents live.** Design your own avatar agents, give them jobs, and watch them walk to their desks, think out loud and pass work to each other.

Plazai is a small, friendly, open-source take on multi-agent AI. No complicated graphs: make some characters, put them in a team, give them a task.

![Plazai home menu](docs/home.png)

## Features

- **Avatar Maker:** build characters from faces, hair, body shapes and colours, then give each one a job, a personality and its own instructions.
- **The Plaza:** a 3D island where your avatars wander, chat-bubble their thoughts while they work, and celebrate when they're done.
- **Teams:** line avatars up (Researcher → Writer → Reviewer) and each one builds on the last one's work.
- **Message Board:** finished work lands here, ready to read and copy.
- **Bring any brain:** Google Gemini, Anthropic Claude, OpenAI, or **Ollama** for free, fully local models. Pick a default, or give each avatar its own.
- **Works with no key:** demo mode uses scripted answers, so you can try everything straight away.
- **Private by design:** everything is saved in your browser. Keys only go to the small Plazai server running on your own computer, which refuses requests from other websites.

| The Plaza | Avatar Maker | Tasks |
| --- | --- | --- |
| ![Plaza](docs/plaza.png) | ![Avatar Maker](docs/maker.png) | ![Tasks](docs/tasks.png) |

## Quick start

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/divinadevosai/plazai.git
cd plazai
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. You'll meet Pip, Juno and Bo, the starter Blog Team. Open **Plaza**, type a task and press **Go!**

### Connect a real AI

Open **Settings** and choose a brain:

| Brain | What you need |
| --- | --- |
| Demo | Nothing. Scripted answers. |
| Google Gemini | A key from [Google AI Studio](https://aistudio.google.com/apikey) (has a free tier) |
| Anthropic Claude | A key from the [Anthropic Console](https://console.anthropic.com/settings/keys) |
| OpenAI | A key from the [OpenAI Platform](https://platform.openai.com/api-keys) |
| Ollama | [Ollama](https://ollama.com) running locally, plus a model: `ollama pull llama3.2` |

You can paste keys in Settings (they're kept in your browser's storage) or put them in a `.env` file. See [`.env.example`](.env.example).

## How it works

```
src/
  avatar/     avatar parts, face drawing (2D portraits + 3D face textures), 3D character
  world/      the plaza island and the avatars that live on it
  engine/     runs tasks: walk to desk → stream the model's answer → hand off to the next avatar
  screens/    home menu, Plaza, Avatar Maker, Tasks, Teams, Message Board, Settings
  store.ts    all app state (Zustand, saved to localStorage)
server/
  api.ts      a tiny Vite plugin: POST /api/chat streams from the chosen model (Vercel AI SDK)
```

A team task runs one avatar at a time. Each avatar gets the task plus everything its teammates handed over, and its answer streams live into the Plaza and the Tasks screen.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run Plazai locally with hot reload |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the built app (the API still works) |
| `npm run typecheck` | TypeScript only |

## Contributing

Ideas, bug reports and pull requests are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Some good first issues: more hair styles and outfits, new plaza props, a day/night cycle, avatar emotes, and sharing avatars as codes.

## A note on inspiration

Plazai's look is inspired by the friendly, rounded console menus and avatar plazas of the late 2000s. It's an independent project: all characters, art, sounds and code are original, and it isn't affiliated with or endorsed by Nintendo. Please keep contributions original too, with no copied names, logos, characters, sounds or assets from other games or consoles.

## Licence

[MIT](LICENSE) © 2026 Sweeney Creative Co. Created by [swe3we.dev](https://swe3we.dev).
