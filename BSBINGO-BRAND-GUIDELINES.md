# Bull$hit! Bingo Brand Guidelines

> Reference this file for all design and copy decisions. Keep it in the project root.

---

## Brand Overview

**What is Bull$hit! Bingo?**
A web app that lets people create custom bingo cards for the predictable things their friends, family, and coworkers say and do. It gamifies the familiar—turning "here we go again" into a shared joke.

**Core positioning:**
"The game you've been playing in your head."

**Brand personality:**
- Knowing, not mean
- Warm but wry
- Self-aware (you're on someone's board too)
- Fun first, always

---

## Voice & Tone

### The Sweet Spot: Wry
Not too gentle, not too harsh. A knowing smile.

| Too Gentle | **Just Right** | Too Harsh |
|------------|----------------|-----------|
| "The things that make them *them*." | **"You called it."** | "Suffer smarter." |

### Voice Principles

**DO:**
- Sound like a knowing friend, not a brand
- Use short, punchy sentences
- Lean into the satisfaction of being right
- Acknowledge everyone is predictable (including the user)
- Keep it light—this is a game, not a roast

**DON'T:**
- Be mean-spirited or cruel
- Punch down
- Over-explain the joke
- Use corporate speak or marketing fluff
- Take itself too seriously

### Key Phrases
- "You called it."
- "The game you've been playing in your head."
- "You already knew."
- "You're on someone's board too."
- "Now it's a game."

### Example Copy

**Hero/Landing:**
> You already knew.
>
> The story they've told eight times. The opinion nobody asked for. The thing they always, always bring up.
>
> You've been keeping track in your head for years. Now it's a game.

**CTAs:**
- "Build Your Board"
- "Start a Game"
- "Create a Card"

**Empty states:**
- "No squares yet. What do they *always* say?"
- "This board is empty. Time to fill it."

**Success:**
- "BINGO. You called it."
- "Board created. Now we wait."

---

## Logo

### Primary Logo
**Bull$hit! Bingo** in Poppins Black (900 weight)
- Main text: Cream (#FFF8E7)
- Accent ($): Amber (#F59E0B)
- Background: Brown (#3D2317)

```css
.logo {
  font-family: 'Poppins', sans-serif;
  font-weight: 900;
  font-size: 2.5rem;
  color: #FFF8E7;
  letter-spacing: -0.02em;
}

.logo .accent {
  color: #F59E0B;
}
```

### Logo Variations

| Context | Text Color | Accent ($) | Background |
|---------|------------|------------|------------|
| Primary (dark bg) | Cream #FFF8E7 | Amber #F59E0B | Brown #3D2317 |
| Light background | Brown #3D2317 | Amber #D97706 | Cream #FFF8E7 |
| Monochrome dark | Brown #3D2317 | Brown #3D2317 | Cream #FFF8E7 |
| Monochrome light | Cream #FFF8E7 | Cream #FFF8E7 | Brown #3D2317 |

### Logo Clear Space
Maintain padding equal to the height of the "$" on all sides.

### Logo Don'ts
- Don't stretch or distort
- Don't change the font
- Don't add shadows, glows, or effects
- Don't rotate
- Don't outline
- Don't rearrange or stack

---

## Color Palette

```css
:root {
  /* Primary */
  --brown: #3D2317;          /* Primary dark, backgrounds, text on light */
  --cream: #FFF8E7;          /* Primary light, backgrounds, text on dark */
  --amber: #F59E0B;          /* Accent, $ symbol, highlights, CTAs */
  
  /* Secondary */
  --amber-dark: #D97706;     /* Hover states, emphasis */
  --amber-light: #FCD34D;    /* Success states, celebrations */
  --tan: #D4A574;            /* Midtone, borders, secondary elements */
  
  /* Neutrals */
  --brown-dark: #2A1810;     /* Darker backgrounds */
  --brown-light: #5C3D2E;    /* Lighter brown for cards */
  --gray: #9CA3AF;           /* Muted text, placeholders */
  --white: #FFFFFF;          /* Pure white when needed */
  
  /* Semantic */
  --success: #10B981;        /* Bingo! Wins */
  --error: #EF4444;          /* Errors, destructive actions */
}
```

### Color Usage

| Element | Color | Notes |
|---------|-------|-------|
| Page background | Brown or Cream | Depends on section |
| Primary text | Cream (on dark) / Brown (on light) | High contrast |
| Accent/highlight | Amber | CTAs, the $, marked squares |
| Cards/containers | Brown-light or Cream | Slight contrast from bg |
| Borders | Tan | Subtle definition |
| Muted/secondary text | Gray or Tan | De-emphasized content |

---

## Typography

### Font Stack

**Primary Font: Poppins**
- Use for: Logo, headlines, buttons, key UI
- Weights: 600 (semibold), 700 (bold), 900 (black/logo only)

**Secondary Font: Inter** (or system-ui fallback)
- Use for: Body copy, labels, descriptions, form inputs
- Weights: 400 (regular), 500 (medium), 600 (semibold)

```css
:root {
  --font-display: 'Poppins', sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
}
```

### Type Scale

```css
--text-xs: 0.75rem;     /* 12px - fine print */
--text-sm: 0.875rem;    /* 14px - labels, captions */
--text-base: 1rem;      /* 16px - body copy */
--text-lg: 1.125rem;    /* 18px - lead text */
--text-xl: 1.25rem;     /* 20px - card headers */
--text-2xl: 1.5rem;     /* 24px - section headers */
--text-3xl: 2rem;       /* 32px - page headers */
--text-4xl: 2.5rem;     /* 40px - hero text */
--text-5xl: 3rem;       /* 48px - logo small */
--text-6xl: 4rem;       /* 64px - logo large */
```

### Type Styles

**Headlines (Poppins)**
```css
.headline {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
```

**Body (Inter)**
```css
.body {
  font-family: var(--font-body);
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.6;
}
```

---

## Spacing

8px base grid:

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.5rem;    /* 24px */
--space-6: 2rem;      /* 32px */
--space-7: 2.5rem;    /* 40px */
--space-8: 3rem;      /* 48px */
--space-9: 4rem;      /* 64px */
--space-10: 5rem;     /* 80px */
```

---

## Border Radius

```css
--radius-sm: 4px;     /* Small elements, bingo cells */
--radius-md: 8px;     /* Buttons, inputs, small cards */
--radius-lg: 12px;    /* Cards, containers */
--radius-xl: 16px;    /* Large cards, modals */
--radius-2xl: 24px;   /* Hero sections */
--radius-full: 9999px; /* Pills, avatars */
```

---

## Shadows

Keep it subtle. No heavy drop shadows.

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);
```

---

## Components

### Buttons

**Primary Button**
```css
.btn-primary {
  background: var(--amber);
  color: var(--brown);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover {
  background: var(--amber-dark);
}
```

**Secondary Button**
```css
.btn-secondary {
  background: transparent;
  color: var(--cream);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  border: 2px solid var(--tan);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.btn-secondary:hover {
  border-color: var(--cream);
}
```

### Bingo Card

```css
.bingo-card {
  background: var(--cream);
  border-radius: var(--radius-lg);
  padding: 1rem;
  box-shadow: var(--shadow-md);
}

.bingo-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.bingo-cell {
  aspect-ratio: 1;
  background: var(--white);
  border: 2px solid var(--tan);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  font-family: var(--font-body);
  font-size: 0.65rem;
  font-weight: 500;
  text-align: center;
  color: var(--brown);
  cursor: pointer;
  transition: all 0.15s ease;
}

.bingo-cell:hover {
  border-color: var(--amber);
}

.bingo-cell.marked {
  background: var(--amber);
  border-color: var(--amber-dark);
  color: var(--brown);
}

.bingo-cell.free {
  background: var(--brown);
  border-color: var(--brown);
  color: var(--cream);
  font-weight: 600;
}
```

### Form Inputs

```css
.input {
  background: var(--white);
  border: 2px solid var(--tan);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--brown);
  width: 100%;
  transition: border-color 0.15s ease;
}

.input:focus {
  outline: none;
  border-color: var(--amber);
}

.input::placeholder {
  color: var(--gray);
}
```

### Cards

```css
.card {
  background: var(--brown-light);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.card-light {
  background: var(--cream);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
```

---

## Layout

### Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

### Container

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

@media (min-width: 768px) {
  .container {
    padding: 0 var(--space-6);
  }
}
```

---

## Accessibility

- Maintain minimum 4.5:1 contrast ratio for text
- Touch targets minimum 44x44px
- Marked cells must be distinguishable without color (use checkmark or visual indicator)
- All interactive elements need visible focus states
- Support reduced motion preferences

---

## Iconography

Use simple, bold icons. Recommended: Lucide or Heroicons (solid variant).

Keep icons:
- Single color (inherit from text)
- 20-24px for inline
- 24-32px for buttons
- Consistent stroke width

---

## Dos and Don'ts

### Do
- Keep it clean and readable
- Use high contrast
- Let whitespace breathe
- Keep the tone warm and fun
- Use amber for emphasis sparingly

### Don't
- Add busy textures or patterns
- Use drop shadows heavily
- Clutter the UI
- Make it feel corporate
- Overuse the amber accent

---

## File Naming

- Components: `PascalCase.tsx` (e.g., `BingoCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `checkBingo.ts`)
- Styles: `kebab-case.css` (e.g., `bingo-card.css`)
- Assets: `kebab-case` (e.g., `logo-primary.svg`)

---

## Quick Reference

| Element | Font | Weight | Color |
|---------|------|--------|-------|
| Logo | Poppins | 900 | Cream + Amber |
| Headlines | Poppins | 700 | Cream or Brown |
| Body | Inter | 400-500 | Cream or Brown |
| Buttons | Poppins | 600 | Brown on Amber |
| Labels | Inter | 500 | Gray or Tan |

| Surface | Color |
|---------|-------|
| Dark background | Brown #3D2317 |
| Light background | Cream #FFF8E7 |
| Cards (on dark) | Brown-light #5C3D2E |
| Cards (on light) | White #FFFFFF |
| Accent | Amber #F59E0B |

---

*Last updated: January 2025*
