export type AbstractionLevel =
  | "normal"
  | "reduced"
  | "minimal";

export const VISUALIZATION_CONFIG = {
  route: {
    visible: true,
    width: 6,
    emphasizedWidth: 8,
    opacity: 0.9,
    emphasizedOpacity: 1,
    color: "#2563eb",
  },

  surroundings: {
    abstractionEnabled: false,

    level: "normal" as AbstractionLevel,

    opacity: {
      normal: 1,
      reduced: 0.65,
      minimal: 0.35,
    },
  },

  landmarks: {
    visible: true,
  },

  mode: "2D" as "2D" | "3D",
} as const;