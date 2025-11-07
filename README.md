# Vidyano

[![CI](https://github.com/Vidyano/vidyano/actions/workflows/ci.yml/badge.svg)](https://github.com/Vidyano/vidyano/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Vidyano** is a client-side TypeScript library for building data-driven applications that connect to a Vidyano .NET backend. It consists of a platform-agnostic core library (`@vidyano/core`) that can be used in any JavaScript environment (browser, Node.js, etc.) and a complete web components package (`@vidyano/vidyano`) for building dynamic UIs.

## Project Structure

```
vidyano/
├── dev/               # .NET backend for development
│   └── wwwroot/       # Build output for development
├── docs/
│   └── core/          # Core library documentation
├── src/
│   ├── core/          # Platform-agnostic core library
│   └── vidyano/       # UI components
└── tests/
    ├── core/          # Core library tests
    └── vidyano/       # UI component tests
```

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- .NET SDK (for development backend)

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start the backend server (localhost:5000)
npm run dev

# In another terminal: Build the project
npm run build

# Run tests
npm test
```

The `npm run dev` command starts the .NET backend server. It will check if the server is already running and only start it if needed.

### Build Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Full build pipeline (Sass → TypeScript → Rollup) |
| `npm run build:sass` | Compile SCSS to CSS |
| `npm run build:ts` | Compile TypeScript |
| `npm run build:rollup` | Bundle with Rollup |
| `npm run dist <version>` | Create distribution packages with specified version |
| `npm test` | Run Playwright tests |

## UI Component Structure

Components in [`src/vidyano/`](src/vidyano/) follow this pattern:

- Each component has its own folder (e.g., `src/vidyano/my-component/`)
- Component folders contain:
  - `.ts` file - TypeScript source (required)
  - `.scss` file - Component styles (required)
  - `.html` file - Component template (optional)

## License

This project is licensed under the [MIT License](LICENSE).

## Resources

- [GitHub Repository](https://github.com/Vidyano/vidyano)
- [Documentation](docs/)
- [Issue Tracker](https://github.com/Vidyano/vidyano/issues)
