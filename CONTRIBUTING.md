# Contributing to TypeScript Plugin Directives

Thank you for your interest in contributing! 🎉

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/lazarv/typescript-plugin-directives.git
cd typescript-plugin-directives
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Build the packages**

```bash
pnpm build
```

4. **Run tests**

```bash
pnpm test
# or with coverage
pnpm test:coverage
```

## Development Workflow

### Git Hooks

The project uses Husky and lint-staged to automatically format and lint code before commits:

- **Pre-commit hook**: Automatically runs `biome check --write` on staged files
- Files are formatted and linted before being committed
- If there are issues that can't be auto-fixed, the commit will be blocked

This ensures consistent code quality across all commits.

### Making Changes

1. Create a new branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and ensure tests pass:

```bash
pnpm test
```

3. Run the linter and fix any issues:

```bash
pnpm lint
# or to auto-fix
pnpm lint:fix
```

4. Add a changeset for user-facing changes:

```bash
pnpm changeset
```

Follow the prompts to describe your changes. This helps with versioning and changelog generation.

**Note**: When you commit, the pre-commit hook will automatically format and lint your staged files. If there are any unfixable issues, the commit will be blocked and you'll need to fix them manually.

### Running Tests

- **Run all tests**: `pnpm test`
- **Run tests in watch mode**: `pnpm -r test:watch`
- **Run tests with UI**: `pnpm -r test:ui`
- **Run coverage**: `pnpm test:coverage`

### Building

- **Build all packages**: `pnpm build`
- **Build in watch mode**: `pnpm dev`

## Project Structure

```
typescript-plugin-directives/
├── packages/
│   ├── plugin/          # Main TypeScript plugin package
│   │   ├── src/         # Source code
│   │   ├── tests/       # Test files
│   │   └── package.json
│   └── example/         # Example usage
└── package.json         # Root package.json
```

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

### When to add a changeset?

Add a changeset when your PR includes:

- Bug fixes
- New features
- Breaking changes
- Performance improvements
- Any user-facing changes

### How to add a changeset?

```bash
pnpm changeset
```

Select:

1. **Which packages to bump**: Select `typescript-plugin-directives`
2. **Bump type**: Choose `patch`, `minor`, or `major`
3. **Summary**: Write a clear description of your changes

The changeset will be stored in `.changeset/*.md` and will be used to generate the changelog when releasing.

## Pull Request Process

1. **Update tests**: Ensure your changes are covered by tests
2. **Run tests**: Make sure all tests pass
3. **Run linter**: Run `pnpm lint` and fix any issues
4. **Add changeset**: Run `pnpm changeset` for user-facing changes
5. **Update documentation**: If needed, update README
6. **Create PR**: Push your branch and create a pull request
7. **Review**: Wait for review and address any feedback

## Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting.

- Run `pnpm lint` to check for issues
- Run `pnpm lint:fix` to auto-fix issues
- Run `pnpm format` to format code
- Run `pnpm check` to run both linting and formatting
- Install the Biome VS Code extension for automatic formatting on save
- Follow the existing code style
- Use TypeScript strict mode
- Write descriptive variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing Guidelines

- Write tests for new features
- Update tests when changing existing functionality
- Aim for high test coverage (we target 80%+ coverage)
- Use descriptive test names: `it("should show hints for default imports", ...)`
- Group related tests using `describe` blocks

## Release Process

Releases are automated using GitHub Actions and Changesets:

1. Merge PRs with changesets to `main`
2. Changesets bot creates a "Version Packages" PR
3. When the Version PR is merged, packages are published to npm automatically

## Questions?

Feel free to open an issue or discussion if you have any questions!
