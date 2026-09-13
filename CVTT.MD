# Core VTT System Logic (CVTT)

This document tracks the primary server-side logic, system requirements, and core system mechanics for the project.

## 1. Main Server Structure (`server.js`)
The `server.js` file serves as the backbone of the backend service. It utilizes:
- **Express**: For routing HTTP requests (API endpoints).
- **Socket.io**: For real-time bidirectional communication between participants.
- **VTTManager**: A central controller for game states, user management, and assets.

## 2. Core Routes & Features
| Feature | Path / Logic | Description |
| :--- | :--- | :--- |
| SRD Data | `/api/srd`, `/api/srd-monsters` | Provides standard rules/monster data for character creation (items, spells, etc.) and monster lookups. |
| Assets | `/assets/` (static) | Serves images, maps, sounds, videos, and "stamps". |
| Dynamics | `getMaps`, `getTokens`, etc. | Dynamically detects content by scanning directory structures. |
| Interaction | `move_token` / `move_token_final` | Hybrid movement: light updates for smooth dragging; "Final" actions update server state and increment version. |
| Mechanics | `state_update` & `sync_character_data` | Targeted pushes to specific clients or groups to minimize bandwidth while maintaining consistency. |
| Construction | **Auto-population** | Automatic filling of fields (feats, skills) during character creation from SRD data. |

## 3. Tech Stack & Visual Framework
| Layer          | Technology                                                  | Purpose                                                                                        |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Frontend       | React 18 + Vite                                              | Fast HMR, responsive UI components, and smooth media pre‑fetch routing.                     |
| Canvas Engine  | HTML5 Canvas API (vanilla JS)                               | Rendering of the map, dynamic fog/lighting, tokens, rulers, pings, and high-performance canvas text.      |
| Backend        | Node.js + Express                                           | Core API routes, dynamic asset directory scanners, and static file serving                              |
| Real‑time      | Socket.IO (WebSocket only)                                  | Bi‑directional state sync with compressed message payloads.                                    |
| Styling        | Tailwind CSS + Custom Properties                             | Dynamic theming via variables (Dark/Light), responsive layout, and global font scaling.          |
| Persistence    | Server‑side JSON files (`data.json`)                        | Centralized storage for maps, tokens, walls, lights, notes, and shapes.                       |
| Client Storage | `localStorage`                                              | Persistent local data: UUIDs, roles, character sheets, and UI preferences.                   |
| Build Tool     | Vite                                                        | Powers the development server (port 5173) with efficient bundling.                        |
| Security       | Room code, payload validation, auto‑IP detection            | Ensures secure sessions and consistent data integrity across all clients.                    |
| Compression    | `perMessageDeflate` (gzip) on Socket.IO                     | Reduces data bandwidth by 60‑80% while maintaining real-time speed.                    |

## 4. Visual Identity & Styling
- **Core Palette**: Uses a sophisticated mix of CSS variables mapping to Tailwind colors:
  - *Dark Mode*: `bgDark` (deep navy), `bgPanel` (gray/blue), `accentGold` (signature gold).
  - *Light Mode*: Soft white and neutral gray backgrounds.
- **Font Scaling**: A unified global font scale (`--ui-font-scale`) impacts all UI elements (sidebar, chat, etc.) while keeping the canvas-rendered text independent.

## 5. Key Logic & Rules
- **Authorization**: A "DM" role exists for private games. Only DM-authorized users can perform high-impact actions: change maps, force hidden items, or modify global environment settings.
- **Data Integrity**: Inventory changes (add, sell, swap) and HP updates are server-validated before broadcasting to other clients.
- **Scale/Performance**: Support for large payloads (JSON limit 50MB) to accommodate complex SRD sheets.
- **Real-time Sync**: Uses `VTTManager.stateVersion` to ensure clients only process state updates when meaningful changes occur.

## 6. Project Scope & Boundaries (Derived from Read Me)
The system follows specific design choices regarding automation:
- **Automated Support**: Character creation logic is automated; rules are applied automatically based on selected race/class (e.g., calculating AC, DC, and Proficiency adjustments).
- **Manual Elements**: No "Auto-Calculate" for damage or complex spell effects; Combat actions are intentionally player/DM driven to ensure control.
- **Resolution Speed**: Direct calls like `then_heartbeat` were avoided in favor of demand-based updates.
