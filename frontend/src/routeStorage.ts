export type SavedRoute = {
  id: string;

  savedAt: string;

  start: {
    longitude: number;
    latitude: number;
  };

  destination: {
    longitude: number;
    latitude: number;
  };

  distanceMeters: number;

  durationSeconds: number;

  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };

  steps: Array<{
    name: string;
    distance: number;
    duration: number;
    maneuver: {
      type: string;
      modifier?: string;
    };
  }>;
};