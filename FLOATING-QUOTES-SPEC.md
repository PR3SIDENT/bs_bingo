# Floating Quotes - Implementation Spec

## Overview
Ambient floating quotes that drift across the landing page hero section. These are the predictable things people say - the "scripts" referenced in the tagline.

---

## Quote Data

```typescript
// quotes.ts

export type QuoteCategory = 
  | 'family'
  | 'advice'
  | 'conspiracy'
  | 'office'
  | 'humblebrag'
  | 'relationship';

export interface FloatingQuote {
  text: string;
  category: QuoteCategory;
}

export const quotes: FloatingQuote[] = [
  // Classic Family Dinner
  { text: "Back in my day...", category: "family" },
  { text: "You look tired.", category: "family" },
  { text: "When are you having kids?", category: "family" },
  { text: "Nobody wants to work anymore.", category: "family" },
  { text: "You should buy a house.", category: "family" },
  { text: "I saw on Facebook...", category: "family" },
  { text: "I'm not racist, but...", category: "family" },
  { text: "Kids these days...", category: "family" },
  { text: "When I was your age...", category: "family" },
  { text: "That's not real music.", category: "family" },
  { text: "You'll understand when you're older.", category: "family" },
  { text: "Money doesn't grow on trees.", category: "family" },
  
  // Unsolicited Advice
  { text: "Have you tried yoga?", category: "advice" },
  { text: "Sleep when you're dead.", category: "advice" },
  { text: "You just need to manifest it.", category: "advice" },
  { text: "Everything happens for a reason.", category: "advice" },
  { text: "Have you tried waking up earlier?", category: "advice" },
  { text: "You should start a podcast.", category: "advice" },
  { text: "It's all about mindset.", category: "advice" },
  { text: "Just drink more water.", category: "advice" },
  { text: "Have you tried not being stressed?", category: "advice" },
  { text: "You just need to put yourself out there.", category: "advice" },
  { text: "Try cutting out gluten.", category: "advice" },
  { text: "It's called discipline.", category: "advice" },
  
  // The Conspiracies
  { text: "They don't want you to know this.", category: "conspiracy" },
  { text: "Wake up, sheeple.", category: "conspiracy" },
  { text: "It's all connected.", category: "conspiracy" },
  { text: "Follow the money.", category: "conspiracy" },
  { text: "Do your own research.", category: "conspiracy" },
  { text: "The mainstream media won't cover this.", category: "conspiracy" },
  { text: "I don't trust Big Pharma.", category: "conspiracy" },
  { text: "That's what they want you to think.", category: "conspiracy" },
  { text: "Look into it.", category: "conspiracy" },
  { text: "I'm just asking questions.", category: "conspiracy" },
  { text: "Exposed.", category: "conspiracy" },
  { text: "Think about it.", category: "conspiracy" },
  
  // Office BS
  { text: "Let's circle back.", category: "office" },
  { text: "We're like a family here.", category: "office" },
  { text: "It is what it is.", category: "office" },
  { text: "Per my last email...", category: "office" },
  { text: "Let's take this offline.", category: "office" },
  { text: "Synergy.", category: "office" },
  { text: "Let's table that.", category: "office" },
  { text: "Moving forward...", category: "office" },
  { text: "Let's unpack that.", category: "office" },
  { text: "I'll ping you.", category: "office" },
  { text: "Quick question.", category: "office" },
  { text: "As per our conversation...", category: "office" },
  
  // Humble Brags
  { text: "I'm SO busy.", category: "humblebrag" },
  { text: "I barely slept.", category: "humblebrag" },
  { text: "My trainer says...", category: "humblebrag" },
  { text: "When I ran my marathon...", category: "humblebrag" },
  { text: "I don't even own a TV.", category: "humblebrag" },
  { text: "I'm just brutally honest.", category: "humblebrag" },
  { text: "I'm such a perfectionist.", category: "humblebrag" },
  { text: "I work too hard.", category: "humblebrag" },
  { text: "I'm bad at relaxing.", category: "humblebrag" },
  { text: "People say I'm intimidating.", category: "humblebrag" },
  { text: "I just forget to eat.", category: "humblebrag" },
  { text: "I'm kind of a workaholic.", category: "humblebrag" },
  
  // Relationship Classics
  { text: "When I was your age, I was married.", category: "relationship" },
  { text: "You're too picky.", category: "relationship" },
  { text: "He seems nice.", category: "relationship" },
  { text: "Are you still single?", category: "relationship" },
  { text: "You're not getting any younger.", category: "relationship" },
  { text: "My friend's daughter is single...", category: "relationship" },
  { text: "Have you tried the apps?", category: "relationship" },
  { text: "You'll find someone when you stop looking.", category: "relationship" },
  { text: "What happened to that nice girl?", category: "relationship" },
  { text: "Love finds you when you least expect it.", category: "relationship" },
];
```

---

## Visual Design

### Quote Bubble Style
```css
.floating-quote {
  background: rgba(61, 35, 23, 0.85);  /* brown with transparency */
  color: #FFF8E7;                       /* cream */
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.625rem 1rem;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  /* Optional: subtle border */
  border: 1px solid rgba(212, 165, 116, 0.3);  /* tan */
}

/* Alternate style - lighter bubbles */
.floating-quote.light {
  background: rgba(255, 248, 231, 0.9);  /* cream */
  color: #3D2317;                         /* brown */
}

/* Highlight certain quotes with amber accent */
.floating-quote.highlight {
  background: rgba(245, 158, 11, 0.9);   /* amber */
  color: #3D2317;                         /* brown */
}
```

### Size Variations
```typescript
type QuoteSize = 'sm' | 'md' | 'lg';

const sizeStyles = {
  sm: { fontSize: '0.75rem', padding: '0.5rem 0.875rem' },
  md: { fontSize: '0.875rem', padding: '0.625rem 1rem' },
  lg: { fontSize: '1rem', padding: '0.75rem 1.25rem' },
};
```

---

## Animation Behavior

### Movement Pattern
- Quotes float from right to left (or scattered directions)
- Slow, ambient drift - not distracting
- Staggered entry times
- Varying speeds (some faster, some slower)
- Varying vertical positions
- Slight rotation for organic feel (-3° to 3°)
- Fade in at edges, fade out when exiting

### Remotion Implementation

```tsx
// FloatingQuote.tsx
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface FloatingQuoteProps {
  text: string;
  startFrame: number;
  duration: number;
  yPosition: number;      // 0-100 (percentage from top)
  speed?: number;         // multiplier, default 1
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light' | 'highlight';
}

export const FloatingQuote: React.FC<FloatingQuoteProps> = ({
  text,
  startFrame,
  duration,
  yPosition,
  speed = 1,
  size = 'md',
  variant = 'dark',
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  
  // Move from right (off-screen) to left (off-screen)
  const xPosition = interpolate(progress, [0, 1], [width + 200, -400]);
  
  // Fade in/out at edges
  const opacity = interpolate(
    progress,
    [0, 0.1, 0.9, 1],
    [0, 1, 1, 0]
  );
  
  // Subtle rotation
  const rotation = interpolate(progress, [0, 1], [-2, 2]);
  
  return (
    <div
      style={{
        position: 'absolute',
        top: `${yPosition}%`,
        left: xPosition,
        opacity,
        transform: `rotate(${rotation}deg)`,
      }}
      className={`floating-quote ${variant} ${size}`}
    >
      {text}
    </div>
  );
};
```

### Scene Composition

```tsx
// FloatingQuotesScene.tsx
import { FloatingQuote } from './FloatingQuote';
import { quotes } from './quotes';

// Shuffle and pick N quotes
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const FloatingQuotesScene: React.FC = () => {
  const selectedQuotes = shuffleArray(quotes).slice(0, 15);
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {selectedQuotes.map((quote, index) => (
        <FloatingQuote
          key={index}
          text={quote.text}
          startFrame={index * 30}           // Stagger entry
          duration={300 + Math.random() * 100}  // Vary duration
          yPosition={10 + (index * 6) % 80}    // Distribute vertically
          speed={0.8 + Math.random() * 0.4}    // Vary speed
          size={['sm', 'md', 'lg'][index % 3] as 'sm' | 'md' | 'lg'}
          variant={index % 5 === 0 ? 'highlight' : 'dark'}
        />
      ))}
    </div>
  );
};
```

---

## Alternative: CSS-Only Implementation

If not using Remotion for the landing page, here's a pure CSS approach:

```tsx
// FloatingQuotes.tsx (React + CSS)
import { useEffect, useState } from 'react';
import { quotes } from './quotes';
import styles from './FloatingQuotes.module.css';

export const FloatingQuotes: React.FC = () => {
  const [activeQuotes, setActiveQuotes] = useState<typeof quotes>([]);
  
  useEffect(() => {
    // Randomly select 12-15 quotes
    const shuffled = [...quotes].sort(() => Math.random() - 0.5);
    setActiveQuotes(shuffled.slice(0, 15));
  }, []);
  
  return (
    <div className={styles.container}>
      {activeQuotes.map((quote, index) => (
        <div
          key={index}
          className={styles.quote}
          style={{
            '--delay': `${index * 2}s`,
            '--duration': `${20 + Math.random() * 10}s`,
            '--y-position': `${10 + (index * 6) % 80}%`,
          } as React.CSSProperties}
        >
          {quote.text}
        </div>
      ))}
    </div>
  );
};
```

```css
/* FloatingQuotes.module.css */
.container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.quote {
  position: absolute;
  top: var(--y-position);
  right: -300px;
  
  background: rgba(61, 35, 23, 0.85);
  color: #FFF8E7;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.625rem 1rem;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  animation: float var(--duration) linear var(--delay) infinite;
}

@keyframes float {
  0% {
    transform: translateX(0) rotate(-2deg);
    opacity: 0;
  }
  5% {
    opacity: 1;
  }
  95% {
    opacity: 1;
  }
  100% {
    transform: translateX(calc(-100vw - 600px)) rotate(2deg);
    opacity: 0;
  }
}

/* Pause animation when user prefers reduced motion */
@media (prefers-reduced-motion: reduce) {
  .quote {
    animation: none;
    opacity: 0.7;
    right: auto;
    left: var(--y-position);
  }
}
```

---

## Usage Notes

1. **Don't overdo it** - 10-15 quotes visible at a time max
2. **Keep them in the background** - low opacity, slow movement, don't distract from the main CTA
3. **Randomize on each load** - keeps it fresh
4. **Consider mobile** - maybe disable or simplify on smaller screens
5. **Respect reduced motion** - provide a static fallback

---

## Quick Copy List

For easy copy/paste:

```
"Back in my day..."
"You look tired."
"When are you having kids?"
"Nobody wants to work anymore."
"You should buy a house."
"I saw on Facebook..."
"Have you tried yoga?"
"Sleep when you're dead."
"Everything happens for a reason."
"Do your own research."
"They don't want you to know this."
"It's all connected."
"Follow the money."
"Let's circle back."
"We're like a family here."
"Per my last email..."
"I'm SO busy."
"I barely slept."
"When I ran my marathon..."
"You're too picky."
"Are you still single?"
"You're not getting any younger."
"I'm just asking questions."
"It is what it is."
"Think about it."
```
