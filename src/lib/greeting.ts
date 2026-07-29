/**
 * Soft, human greetings — the product should feel like it cares, not like a toll booth.
 */

export type GreetingContext = {
  name?: string | null;
  hour?: number;
};

function firstName(name?: string | null) {
  if (!name?.trim()) return null;
  return name.trim().split(/\s+/)[0] || null;
}

export function timeOfDayGreeting(hour = new Date().getHours()) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Hey";
}

export function welcomeLine(ctx: GreetingContext = {}) {
  const hour = ctx.hour ?? new Date().getHours();
  const hello = timeOfDayGreeting(hour);
  const name = firstName(ctx.name);
  if (name) return `${hello}, ${name}.`;
  return `${hello}.`;
}

export function uploadCareLine() {
  const lines = [
    "Pick the clips you love. We’ll listen for the laughs and keep the story warm.",
    "Your gallery already holds the magic — we just help it breathe.",
    "Take your time choosing. Confirmation before we start is part of the care.",
  ];
  return lines[Math.floor(Date.now() / 120_000) % lines.length];
}

export function processingCareLine() {
  const lines = [
    "We’re watching every frame for the moments that feel like you.",
    "Almost there — your memories deserve a calm cut, not a rush job.",
    "Sit with us a minute. Good stories take a little care.",
    "Finding the smiles, the hugs, the quiet in-between…",
  ];
  return lines[Math.floor(Date.now() / 45_000) % lines.length];
}

export function resultCareLine() {
  return "There it is — your story, lighter to watch, ready to share with people who matter.";
}

export function dashboardCareLine(count: number) {
  if (count === 0) {
    return "Whenever you’re ready, bring a few videos. We’ll treat them gently.";
  }
  if (count === 1) {
    return "Your first recap is here. Come back anytime — we’ll remember how you like it.";
  }
  return `${count} stories kept safe. Glad you’re building a place for them.`;
}

export function softProNudgeLine() {
  return "When you’re ready for 4K and a cleaner frame, Pro is waiting — no pressure.";
}

export function creditsRestoredLine() {
  return "That one’s on us. Credits are back. Whenever you’re ready, we’ll try again together.";
}
