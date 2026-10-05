import type {
  LandmarkContext,
  RouteContext,
  RouteIntelligence,
} from "./aiTypes";

import { buildRouteContext } from "./routeContextGenerator";
import { analyzeRouteContext } from "./routeIntelligenceEngine";

type RouteStepInput = {
  name: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
  };
};

type DestinationInput = {
  name: string;
  category: string;
  longitude: number;
  latitude: number;
};

type AnalyzeRouteInput = {
  routeGeometry: [number, number][];

  distanceMeters: number;

  durationSeconds: number;

  steps: RouteStepInput[];

  nearbyLandmarks?: LandmarkContext[];

  destination: DestinationInput;

  currentRoutePosition?: [
    number,
    number,
  ] | null;
};

export type RouteAIResult = {
  context: RouteContext;

  intelligence: RouteIntelligence;
};

/**
 * Builds route context and analyzes it through
 * the Route Context Intelligence layer.
 */
export function analyzeRoute(
  input: AnalyzeRouteInput,
): RouteAIResult {
  const context =
    buildRouteContext({
      routeGeometry:
        input.routeGeometry,

      distanceMeters:
        input.distanceMeters,

      durationSeconds:
        input.durationSeconds,

      steps:
        input.steps,

      nearbyLandmarks:
        input.nearbyLandmarks,

      destination:
        input.destination,

      currentRoutePosition:
        input.currentRoutePosition,
    });

  const intelligence =
    analyzeRouteContext(
      context,
    );

  return {
    context,
    intelligence,
  };
}