import type {
  GeoCoordinate,
  LandmarkContext,
  RouteContext,
  RouteSegmentContext,
  RouteTurnDirection,
} from "./aiTypes";

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

type RouteContextInput = {
  routeGeometry: GeoCoordinate[];

  distanceMeters: number;

  durationSeconds: number;

  steps: RouteStepInput[];

  nearbyLandmarks?: LandmarkContext[];

  destination: DestinationInput;

  currentRoutePosition?: GeoCoordinate | null;
};

/**
 * Converts an OSRM maneuver into the
 * simplified direction model used by the AI layer.
 */
function getTurnDirection(
  modifier?: string,
): RouteTurnDirection {
  if (modifier === "left") {
    return "left";
  }

  if (modifier === "right") {
    return "right";
  }

  return "straight";
}

/**
 * Calculates the bearing between two geographic points.
 */
function calculateBearing(
  start: GeoCoordinate,
  end: GeoCoordinate,
): number {
  const startLongitude =
    (start[0] * Math.PI) / 180;

  const startLatitude =
    (start[1] * Math.PI) / 180;

  const endLongitude =
    (end[0] * Math.PI) / 180;

  const endLatitude =
    (end[1] * Math.PI) / 180;

  const longitudeDifference =
    endLongitude - startLongitude;

  const y =
    Math.sin(longitudeDifference) *
    Math.cos(endLatitude);

  const x =
    Math.cos(startLatitude) *
      Math.sin(endLatitude) -
    Math.sin(startLatitude) *
      Math.cos(endLatitude) *
      Math.cos(longitudeDifference);

  const bearing =
    (Math.atan2(y, x) * 180) /
    Math.PI;

  return (bearing + 360) % 360;
}

/**
 * Calculates the smallest angle between
 * two bearings.
 */
function calculateTurnAngle(
  incomingBearing: number,
  outgoingBearing: number,
): number {
  let angle =
    outgoingBearing -
    incomingBearing;

  if (angle > 180) {
    angle -= 360;
  }

  if (angle < -180) {
    angle += 360;
  }

  return angle;
}

/**
 * Builds route segments from the route geometry.
 */
function buildRouteSegments(
  geometry: GeoCoordinate[],
): RouteSegmentContext[] {
  const segments: RouteSegmentContext[] = [];

  for (
    let index = 0;
    index < geometry.length - 1;
    index += 1
  ) {
    const start = geometry[index];
    const end = geometry[index + 1];

    if (!start || !end) {
      continue;
    }

    const outgoingBearing =
      calculateBearing(
        start,
        end,
      );

    const previousStart =
      geometry[index - 1];

    let turnAngleDegrees = 0;

    if (previousStart) {
      const incomingBearing =
        calculateBearing(
          previousStart,
          start,
        );

      turnAngleDegrees =
        calculateTurnAngle(
          incomingBearing,
          outgoingBearing,
        );
    }

    let direction: RouteTurnDirection =
      "straight";

    if (turnAngleDegrees > 20) {
      direction = "right";
    } else if (turnAngleDegrees < -20) {
      direction = "left";
    }

    segments.push({
      index,
      start,
      end,
      distanceMeters: 0,
      direction,
      turnAngleDegrees,
    });
  }

  return segments;
}

/**
 * Builds a normalized RouteContext object
 * for the AI intelligence layer.
 */
export function buildRouteContext(
  input: RouteContextInput,
): RouteContext {
  const segments =
    buildRouteSegments(
      input.routeGeometry,
    );

  const turns =
    input.steps.map((step) =>
      getTurnDirection(
        step.maneuver.modifier,
      ),
    );

  /*
   * Attach OSRM step distances to the
   * corresponding route segments where possible.
   */
  input.steps.forEach(
    (step, index) => {
      const segment =
        segments[index];

      if (segment) {
        segment.distanceMeters =
          step.distance;
      }
    },
  );

  return {
    routeGeometry:
      input.routeGeometry,

    distanceMeters:
      input.distanceMeters,

    durationSeconds:
      input.durationSeconds,

    turns,

    segments,

    nearbyLandmarks:
      input.nearbyLandmarks ?? [],

    destination: {
      name: input.destination.name,

      category:
        input.destination.category,

      position: [
        input.destination.longitude,
        input.destination.latitude,
      ],
    },

    currentRoutePosition:
      input.currentRoutePosition ??
      input.routeGeometry[0] ??
      null,
  };
}