import type {
  LandmarkContext,
  RouteComplexity,
  RouteContext,
  RouteIntelligence,
  RecommendedVisualization,
} from "./aiTypes";

/**
 * Determines route complexity from the amount of
 * navigation information the route contains.
 *
 * This is intentionally explainable so the system
 * can later be replaced or enhanced by an ML model.
 */
function calculateRouteComplexity(
  context: RouteContext,
): RouteComplexity {
  const turnCount =
    context.turns.filter(
      (turn) => turn !== "straight",
    ).length;

  const segmentCount =
    context.segments.length;

  const routeDistanceKm =
    context.distanceMeters / 1000;

  /*
   * Complexity score combines:
   * - number of meaningful turns
   * - route segmentation
   * - route length
   */
  let score = 0;

  if (turnCount >= 8) {
    score += 3;
  } else if (turnCount >= 4) {
    score += 2;
  } else if (turnCount >= 1) {
    score += 1;
  }

  if (segmentCount >= 40) {
    score += 2;
  } else if (segmentCount >= 20) {
    score += 1;
  }

  if (routeDistanceKm >= 10) {
    score += 2;
  } else if (routeDistanceKm >= 5) {
    score += 1;
  }

  if (score >= 5) {
    return "high";
  }

  if (score >= 2) {
    return "medium";
  }

  return "low";
}

/**
 * Selects landmarks that are most useful to the
 * current navigation context.
 */
function selectImportantLandmarks(
  context: RouteContext,
): LandmarkContext[] {
  return [...context.nearbyLandmarks]
    .sort(
      (first, second) =>
        first.distanceFromCurrentPositionMeters -
        second.distanceFromCurrentPositionMeters,
    )
    .slice(0, 5);
}

/**
 * Finds route segments containing significant turns.
 */
function selectImportantSegments(
  context: RouteContext,
): number[] {
  return context.segments
    .filter(
      (segment) =>
        Math.abs(
          segment.turnAngleDegrees,
        ) >= 20,
    )
    .map(
      (segment) => segment.index,
    );
}

/**
 * Recommends how much surrounding information
 * should be visually emphasized.
 */
function recommendVisualization(
  complexity: RouteComplexity,
): RecommendedVisualization {
  if (complexity === "high") {
    return "minimal";
  }

  if (complexity === "medium") {
    return "reduced";
  }

  return "normal";
}

/**
 * Generates a human-readable explanation for
 * the intelligence decision.
 */
function generateReason(
  context: RouteContext,
  complexity: RouteComplexity,
  importantLandmarks: LandmarkContext[],
  importantSegments: number[],
): string {
  const turnCount =
    context.turns.filter(
      (turn) => turn !== "straight",
    ).length;

  const landmarkCount =
    importantLandmarks.length;

  if (complexity === "high") {
    return (
      `High route complexity with ${turnCount} ` +
      `significant turns and ${importantSegments.length} ` +
      `important route segments. Emphasize the ` +
      `route and nearby landmarks.`
    );
  }

  if (complexity === "medium") {
    return (
      `Moderate route complexity with ${turnCount} ` +
      `significant turns and ${landmarkCount} ` +
      `nearby landmarks. Keep the route prominent ` +
      `while reducing unnecessary surroundings.`
    );
  }

  return (
    `Low route complexity with ${turnCount} ` +
    `significant turns. Normal visualization is ` +
    `sufficient for this route.`
  );
}

/**
 * Main Route Context Intelligence engine.
 *
 * Converts geographic route context into an
 * explainable visualization/navigation decision.
 */
export function analyzeRouteContext(
  context: RouteContext,
): RouteIntelligence {
  const routeComplexity =
    calculateRouteComplexity(
      context,
    );

  const importantLandmarks =
    selectImportantLandmarks(
      context,
    );

  const importantSegments =
    selectImportantSegments(
      context,
    );

  const recommendedVisualization =
    recommendVisualization(
      routeComplexity,
    );

  const reason =
    generateReason(
      context,
      routeComplexity,
      importantLandmarks,
      importantSegments,
    );

  return {
    importantLandmarks,

    routeComplexity,

    importantSegments,

    recommendedVisualization,

    reason,
  };
}