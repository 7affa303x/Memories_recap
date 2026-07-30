/**
 * Professionals / professors testimonials — hidden until PROFS_ENABLED=true.
 * Kept in code so marketing can flip the flag without a redesign.
 */
export type ProfProfile = {
  id: string;
  name: string;
  title: string;
  quote: string;
  focus: string;
};

export const PROFS: ProfProfile[] = [
  {
    id: "prof-archives",
    name: "Dr. Layla Mansouri",
    title: "Digital Memory Archivist",
    quote:
      "Families don’t need another editor. They need a calm cut that respects the day as it was lived.",
    focus: "Family archives · oral history",
  },
  {
    id: "prof-media",
    name: "Karim Benali",
    title: "Media Literacy Lecturer",
    quote:
      "The best recap feels hand-made without demanding a studio. That’s the bar for tools people will actually finish.",
    focus: "Youth media · storytelling",
  },
  {
    id: "prof-film",
    name: "Sofia Hartmann",
    title: "Documentary Producer",
    quote:
      "Vertical and landscape from one honest timeline — that’s how memory travels in 2026.",
    focus: "Documentary · social distribution",
  },
];
