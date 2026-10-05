import type { RouteCoordinate } from "../three/ThreeScene";

export type NavigationDirection =
  | "straight"
  | "left"
  | "right";

export type NavigationState = {
  active: boolean;
  completed: boolean;

  currentIndex: number;
  progress: number;

  position: RouteCoordinate | null;

  direction: NavigationDirection;

  turnDetected: boolean;

  distanceProgress: number;
};

export class NavigationController {
  private route: RouteCoordinate[] = [];

  private state: NavigationState = {
    active: false,
    completed: false,

    currentIndex: 0,
    progress: 0,

    position: null,

    direction: "straight",

    turnDetected: false,

    distanceProgress: 0,
  };

  setRoute(route: RouteCoordinate[]) {
    this.route = route;

    this.state = {
      active: route.length >= 2,

      completed: false,

      currentIndex: 0,

      progress: 0,

      position:
        route.length > 0
          ? route[0]
          : null,

      direction: "straight",

      turnDetected: false,

      distanceProgress: 0,
    };

    this.updatePosition();
    this.updateNavigationDirection();
    this.updateDistanceProgress();
  }

  getState(): NavigationState {
    return {
      ...this.state,
    };
  }

  reset() {
    this.state = {
      active: false,

      completed: false,

      currentIndex: 0,

      progress: 0,

      position: null,

      direction: "straight",

      turnDetected: false,

      distanceProgress: 0,
    };
  }

  advance(progressStep = 0.025) {
    if (
      !this.state.active ||
      this.state.completed ||
      this.route.length < 2
    ) {
      return;
    }

    if (progressStep <= 0) {
      return;
    }

    this.state.progress += progressStep;

    while (
      this.state.progress >= 1 &&
      this.state.currentIndex <
        this.route.length - 2
    ) {
      this.state.progress -= 1;

      this.state.currentIndex += 1;
    }

    if (
      this.state.currentIndex >=
      this.route.length - 2
    ) {
      this.state.currentIndex =
        this.route.length - 2;

      this.state.progress = 1;

      this.state.completed = true;

      this.state.active = false;
    }

    this.updatePosition();

    this.updateNavigationDirection();

    this.updateDistanceProgress();
  }

  private updatePosition() {
    if (this.route.length < 2) {
      this.state.position =
        this.route.length === 1
          ? this.route[0]
          : null;

      return;
    }

    const index =
      this.state.currentIndex;

    const start =
      this.route[index];

    const end =
      this.route[index + 1];

    if (!start || !end) {
      return;
    }

    const progress =
      this.state.progress;

    const longitude =
      start[0] +
      (end[0] - start[0]) *
        progress;

    const latitude =
      start[1] +
      (end[1] - start[1]) *
        progress;

    this.state.position = [
      longitude,
      latitude,
    ];
  }

  private updateNavigationDirection() {
    const index =
      this.state.currentIndex;

    const previous =
      this.route[index - 1];

    const current =
      this.route[index];

    const next =
      this.route[index + 1];

    if (
      !current ||
      !next
    ) {
      this.state.direction =
        "straight";

      this.state.turnDetected =
        false;

      return;
    }

    /*
     * The first route segment has no
     * previous point, so its direction
     * is treated as straight.
     */
    if (!previous) {
      this.state.direction =
        "straight";

      this.state.turnDetected =
        false;

      return;
    }

    const incomingBearing =
      this.calculateBearing(
        previous,
        current,
      );

    const outgoingBearing =
      this.calculateBearing(
        current,
        next,
      );

    let angle =
      outgoingBearing -
      incomingBearing;

    /*
     * Normalize angle to
     * -180° ... +180°.
     */
    if (angle > 180) {
      angle -= 360;
    }

    if (angle < -180) {
      angle += 360;
    }

    const turnThreshold = 20;

    /*
     * Small heading changes are treated
     * as straight movement.
     */
    if (
      Math.abs(angle) <
      turnThreshold
    ) {
      this.state.direction =
        "straight";

      this.state.turnDetected =
        false;

      return;
    }

    this.state.turnDetected =
      true;

    this.state.direction =
      angle > 0
        ? "right"
        : "left";
  }

  private calculateBearing(
    start: RouteCoordinate,
    end: RouteCoordinate,
  ): number {
    const startLongitude =
      (start[0] * Math.PI) /
      180;

    const startLatitude =
      (start[1] * Math.PI) /
      180;

    const endLongitude =
      (end[0] * Math.PI) /
      180;

    const endLatitude =
      (end[1] * Math.PI) /
      180;

    const longitudeDifference =
      endLongitude -
      startLongitude;

    const y =
      Math.sin(
        longitudeDifference,
      ) *
      Math.cos(endLatitude);

    const x =
      Math.cos(startLatitude) *
        Math.sin(endLatitude) -
      Math.sin(startLatitude) *
        Math.cos(endLatitude) *
        Math.cos(
          longitudeDifference,
        );

    const bearing =
      (Math.atan2(y, x) * 180) /
      Math.PI;

    return (
      (bearing + 360) %
      360
    );
  }

  private updateDistanceProgress() {
    if (
      this.route.length < 2
    ) {
      this.state.distanceProgress =
        0;

      return;
    }

    const totalSegments =
      this.route.length - 1;

    const completedSegments =
      this.state.currentIndex;

    const currentSegmentProgress =
      this.state.progress;

    const progress =
      (completedSegments +
        currentSegmentProgress) /
      totalSegments;

    this.state.distanceProgress =
      Math.min(
        Math.max(
          progress,
          0,
        ),
        1,
      );
  }
}