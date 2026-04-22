# yakky

A production-grade Node.js CLI toolkit built with TypeScript, Commander.js, Enquirer, Chalk, and Ora.

## Installation

```bash
npm install -g yakky
```

## Usage

```bash
yakky --help
yakky --version
```

### Commands

**hello** — Say hello to someone:

```bash
yakky hello                   # Hello, world!
yakky hello Yakky             # Hello, Yakky!
yakky hello Yakky -g "Hi"    # Hi, Yakky!
```

**init** — Interactive project initialization:

```bash
yakky init
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## Publishing

```bash
npm publish
```

## License

MIT
