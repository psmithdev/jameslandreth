# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal document archive website for Dr. James Landreth, a retired doctor, traveler, photographer, and writer. The site provides a browsable archive of his essays, family newsletters, travel journals, and personal narratives — originally written as Microsoft Word documents and converted to PDF.

## Architecture

This is a static site deployed via **GitHub Pages** (branch: `gh-pages`). The main pages are:

- **`index.html`** — Main document archive with search, filtering by category, and document card previews
- **`viewer.html`** — Individual document viewer with PDF-style rendering
- **`upload.html`** — Document upload interface
- **`admin.html`** — Content management system for managing documents
- **`family-tree.html`** — Family tree page

### Supporting Files

- **`components/footer-signature.html`** — Reusable footer signature component with animated box effect
- **`style.css`** — Legacy stylesheet (original design); current pages use inline `<style>` blocks
- **`wordpress/`** — WordPress development environment with custom theme (not actively used for deployment)

## Tech Stack

- **Pure HTML/CSS/JavaScript** — no build tools or frameworks
- **Inline styles** — each HTML page contains its own `<style>` block with a unified design system
- **GitHub Pages** — static hosting from the `gh-pages` branch

## Design System

The pages share a consistent design language:

- System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui`)
- Subtle gradient backgrounds (`#f8fafc` to `#e2e8f0`)
- Glassmorphism elements (backdrop-filter blur, semi-transparent backgrounds)
- CSS-based document preview cards with overlay effects
- Responsive layout

## Content Categories

Health, Fashion, Food, Shopping, Events, Fiction, Travel (especially Japan), Education, Family History, Photography, Music, Annual Adventures, Personal Essays

## Development

No build step required. Open HTML files directly in a browser or use a simple HTTP server:

```bash
python3 -m http.server 8000
```

## Deployment

The site is deployed on GitHub Pages from the `gh-pages` branch. Push to `gh-pages` to deploy.

## Commit & Pull Request Guidelines

## Commits

- Use short, imperative subjects: Add …, Fix …, Refactor …, Update …
- One commit per logical change.
- Keep subject under 72 characters.
- Add a brief body only if the reason is not obvious.

Examples:

- Fix mobile header sticky offset
- Add bottom tab navigation
- Refactor AppShell layout structure

## Pull Requests

Include:

- Clear summary and rationale
- Linked issue/task ID (if available)
- Screenshots or short recordings for UI changes
- Notes on environment/config updates (only if changed)
