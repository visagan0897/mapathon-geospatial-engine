import { useEffect, useRef, useState } from "react";

import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  setWorkerUrl,
} from "maplibre-gl";

import type { GeoJSONSource } from "maplibre-gl";

import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import "maplibre-gl/dist/maplibre-gl.css";

import { MAP_CONFIG } from "./mapConfig";

import {
  VISUALIZATION_CONFIG,
  type AbstractionLevel,
} from "./visualizationConfig";

import {
  saveRoute,
  getSavedRoute,
} from "./routeStorageService";

import type { SavedRoute } from "./routeStorage";

import {
  isOnline,
  subscribeToNetworkStatus,
} from "./networkStatus";

import { ThreeScene } from "./three/ThreeScene";

import { NavigationController } from "./navigation/NavigationController";

import {
  identifyDestination,
  type DestinationInfo,
} from "./landmarkService";

import {
  analyzeRoute,
  type RouteAIResult,
} from "./ai/routeAIService";

setWorkerUrl(workerUrl);

type RouteStep = {
  name: string;
  distance: number;
  duration: number;
  maneuver: {
    type: string;
    modifier?: string;
  };
};

type RouteResponse = {
  distance_meters: number;
  duration_seconds: number;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  steps: Array<{
    steps: RouteStep[];
  }>;
};

type LandmarkSelection = {
  name: string;
  label: string;
  icon: string;
  position: [number, number];
};

type PanelName =
  | "destination"
  | "route"
  | "navigation"
  | "savedRoute"
  | "mapOptions";

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const threeContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const threeSceneRef = useRef<ThreeScene | null>(null);
  const routeSourceRef = useRef<GeoJSONSource | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const navigationControllerRef =
    useRef<NavigationController | null>(null);
  const navigationAnimationRef =
    useRef<number | null>(null);
  const navigationActiveRef = useRef(false);

  const [routeInfo, setRouteInfo] =
    useState<RouteResponse | null>(null);

  const [online, setOnline] =
    useState<boolean>(isOnline());

  const [hasSavedRoute, setHasSavedRoute] =
    useState<boolean>(getSavedRoute() !== null);

  const [
    abstractionEnabled,
    setAbstractionEnabled,
  ] = useState<boolean>(
    VISUALIZATION_CONFIG.surroundings.abstractionEnabled,
  );

  const [
    abstractionLevel,
    setAbstractionLevel,
  ] = useState<AbstractionLevel>(
    VISUALIZATION_CONFIG.surroundings.level,
  );

  const [viewMode, setViewMode] =
    useState<"2D" | "3D">(
      VISUALIZATION_CONFIG.mode,
    );

  const [destinationInfo, setDestinationInfo] =
    useState<DestinationInfo | null>(null);

  const [selectedLandmark, setSelectedLandmark] =
    useState<LandmarkSelection | null>(null);

  const [routeAIResult, setRouteAIResult] =
    useState<RouteAIResult | null>(null);

  const [navigationActive, setNavigationActive] =
    useState(false);

  const [navigationCompleted, setNavigationCompleted] =
    useState(false);

  const [navigationPosition, setNavigationPosition] =
    useState<[number, number] | null>(null);

  const [navigationDirection, setNavigationDirection] =
    useState<"straight" | "left" | "right">("straight");

  const [turnDetected, setTurnDetected] =
    useState(false);

  const [distanceProgress, setDistanceProgress] =
    useState(0);

  /*
   * ============================================================
   * MENU / PANEL STATE
   * ============================================================
   *
   * ☰ menu contains names only.
   * Clicking a name opens its corresponding panel.
   */

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [optionsOpen, setOptionsOpen] =
    useState(false);

  const [destinationPanelOpen, setDestinationPanelOpen] =
    useState(false);

  const [routePanelOpen, setRoutePanelOpen] =
    useState(false);

  const [navigationPanelOpen, setNavigationPanelOpen] =
    useState(false);

  /*
   * ============================================================
   * NAVIGATION CONTROLLER
   * ============================================================
   */

  useEffect(() => {
    navigationControllerRef.current =
      new NavigationController();

    return () => {
      stopNavigationAnimation();
      navigationActiveRef.current = false;
      navigationControllerRef.current = null;
    };
  }, []);

  /*
   * ============================================================
   * NETWORK STATUS
   * ============================================================
   */

  useEffect(() => {
    return subscribeToNetworkStatus(setOnline);
  }, []);

  /*
   * ============================================================
   * SAVED ROUTE STATUS
   * ============================================================
   */

  useEffect(() => {
    setHasSavedRoute(getSavedRoute() !== null);
  }, [routeInfo]);

  /*
   * ============================================================
   * VISUAL ABSTRACTION
   * ============================================================
   */

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    applySurroundingsAbstraction(
      map,
      abstractionEnabled,
      abstractionLevel,
    );

    updateRouteEmphasis(
      map,
      abstractionEnabled,
    );
  }, [
    abstractionEnabled,
    abstractionLevel,
  ]);

  /*
   * ============================================================
   * 3D SCENE
   * ============================================================
   */

  useEffect(() => {
    if (viewMode !== "3D") {
      if (threeSceneRef.current) {
        threeSceneRef.current.dispose();
        threeSceneRef.current = null;
      }

      return;
    }

    if (!threeContainerRef.current) {
      return;
    }

    const scene = new ThreeScene(
      threeContainerRef.current,
    );

    threeSceneRef.current = scene;

    scene.setDestinationLandmarkClickHandler(
      (data) => {
        setSelectedLandmark({
          name: data.name,
          label: data.label,
          icon: data.icon,
          position: data.position,
        });
      },
    );

    if (routeInfo) {
      scene.setRoute(
        routeInfo.geometry.coordinates,
      );

      updateThreeDestinationLandmark();
      updateThreeNavigation();
    }

    return () => {
      scene.setDestinationLandmarkClickHandler(null);
      scene.dispose();

      if (threeSceneRef.current === scene) {
        threeSceneRef.current = null;
      }
    };
  }, [viewMode]);

  /*
   * ============================================================
   * UPDATE 3D ROUTE
   * ============================================================
   */

  useEffect(() => {
    const scene = threeSceneRef.current;

    if (!scene) {
      return;
    }

    if (!routeInfo) {
      scene.setRoute([]);
      scene.clearDestinationLandmark();
      return;
    }

    scene.setRoute(
      routeInfo.geometry.coordinates,
    );

    updateThreeDestinationLandmark();
    updateThreeNavigation();
  }, [
    routeInfo,
    destinationInfo,
  ]);

  /*
   * ============================================================
   * MAP INITIALIZATION
   * ============================================================
   */

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style:
        "https://tiles.openfreemap.org/styles/liberty",
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
    });

    mapRef.current = map;

    map.addControl(
      new NavigationControl(),
      "top-right",
    );

    new Marker()
      .setLngLat(MAP_CONFIG.center)
      .addTo(map);

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      routeSourceRef.current =
        map.getSource("route") as GeoJSONSource;

      if (VISUALIZATION_CONFIG.route.visible) {
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color":
              VISUALIZATION_CONFIG.route.color,
            "line-width":
              VISUALIZATION_CONFIG.route.width,
            "line-opacity":
              VISUALIZATION_CONFIG.route.opacity,
          },
        });
      }

      applySurroundingsAbstraction(
        map,
        abstractionEnabled,
        abstractionLevel,
      );

      updateRouteEmphasis(
        map,
        abstractionEnabled,
      );

      const savedRoute = getSavedRoute();

      if (savedRoute) {
        void restoreSavedRoute(
          map,
          savedRoute,
        );
      }
    });

    /*
     * MAP CLICK → DESTINATION → ROUTE
     */

    map.on("click", async (event) => {
      if (!navigator.onLine) {
        console.log(
          "Offline mode: new route calculation unavailable.",
        );
        return;
      }

      resetNavigation();

      setDestinationInfo(null);
      setSelectedLandmark(null);
      setRouteAIResult(null);

      /*
       * A newly selected destination automatically
       * opens Destination + Route Information.
       */

      setDestinationPanelOpen(true);
      setRoutePanelOpen(true);
      setNavigationPanelOpen(false);

      const destination: [number, number] = [
        event.lngLat.lng,
        event.lngLat.lat,
      ];

      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
        destinationMarkerRef.current = null;
      }

      if (routeSourceRef.current) {
        routeSourceRef.current.setData({
          type: "FeatureCollection",
          features: [],
        });
      }

      setRouteInfo(null);

      destinationMarkerRef.current =
        new Marker()
          .setLngLat(destination)
          .addTo(map);

      try {
        const info =
          await identifyDestination(
            destination[0],
            destination[1],
          );

        if (info) {
          setDestinationInfo(info);
          updateDestinationMarker(info);
        }
      } catch (error) {
        console.error(
          "Destination identification failed:",
          error,
        );
      }

      try {
        const response = await fetch(
          "http://127.0.0.1:8000/route",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              start: {
                longitude:
                  MAP_CONFIG.center[0],
                latitude:
                  MAP_CONFIG.center[1],
              },
              destination: {
                longitude:
                  destination[0],
                latitude:
                  destination[1],
              },
            }),
          },
        );

        if (!response.ok) {
          throw new Error(
            `Routing request failed: ${response.status}`,
          );
        }

        const route =
          (await response.json()) as RouteResponse;

        displayRoute(map, route);

        const steps =
          route.steps.flatMap(
            (leg) => leg.steps,
          );

        const savedRoute: SavedRoute = {
          id: crypto.randomUUID(),
          savedAt: new Date().toISOString(),

          start: {
            longitude:
              MAP_CONFIG.center[0],
            latitude:
              MAP_CONFIG.center[1],
          },

          destination: {
            longitude:
              destination[0],
            latitude:
              destination[1],
          },

          distanceMeters:
            route.distance_meters,

          durationSeconds:
            route.duration_seconds,

          geometry: route.geometry,
          steps,
        };

        saveRoute(savedRoute);
        setHasSavedRoute(true);
      } catch (error) {
        console.error(
          "Route calculation failed:",
          error,
        );
      }
    });

    map.on("error", (event) => {
      console.error(
        "MapLibre error:",
        event.error,
      );
    });

    return () => {
      mapRef.current = null;
      routeSourceRef.current = null;
      map.remove();
    };
  }, []);

  /*
   * ============================================================
   * DESTINATION LANDMARK
   * ============================================================
   */

  function updateThreeDestinationLandmark() {
    const scene = threeSceneRef.current;

    if (
      !scene ||
      !destinationInfo ||
      !routeInfo
    ) {
      return;
    }

    scene.setDestinationLandmark({
      name: destinationInfo.name,
      label: destinationInfo.landmarkLabel,
      icon: destinationInfo.landmarkIcon,
      position: [
        destinationInfo.longitude,
        destinationInfo.latitude,
      ],
    });
  }

  /*
   * ============================================================
   * DESTINATION MARKER
   * ============================================================
   */

  function updateDestinationMarker(
    info: DestinationInfo,
  ) {
    const marker =
      destinationMarkerRef.current;

    if (!marker) {
      return;
    }

    const element = marker.getElement();

    element.innerHTML = "";
    element.style.width = "46px";
    element.style.height = "46px";
    element.style.borderRadius = "50%";
    element.style.background = "white";
    element.style.border =
      "3px solid #2563eb";
    element.style.boxShadow =
      "0 3px 10px rgba(0,0,0,0.3)";
    element.style.display = "flex";
    element.style.alignItems = "center";
    element.style.justifyContent = "center";
    element.style.fontSize = "25px";
    element.style.cursor = "pointer";
    element.style.transform =
      "translateY(-50%)";
    element.textContent =
      info.landmarkIcon;

    const label =
      document.createElement("div");

    label.textContent =
      info.landmarkLabel;

    label.style.position = "absolute";
    label.style.bottom = "48px";
    label.style.left = "50%";
    label.style.transform =
      "translateX(-50%)";
    label.style.background = "#2563eb";
    label.style.color = "white";
    label.style.padding = "4px 8px";
    label.style.borderRadius = "6px";
    label.style.fontSize = "11px";
    label.style.fontWeight = "bold";
    label.style.whiteSpace = "nowrap";
    label.style.boxShadow =
      "0 2px 6px rgba(0,0,0,0.25)";

    element.appendChild(label);

    element.title =
      `${info.landmarkIcon} ${info.landmarkLabel}: ${info.name}`;
  }

  /*
   * ============================================================
   * VISUAL ABSTRACTION
   * ============================================================
   */

  function applySurroundingsAbstraction(
    map: MapLibreMap,
    enabled: boolean,
    level: AbstractionLevel,
  ) {
    const opacity =
      enabled
        ? VISUALIZATION_CONFIG
            .surroundings
            .opacity[level]
        : VISUALIZATION_CONFIG
            .surroundings
            .opacity
            .normal;

    const style = map.getStyle();

    for (const layer of style.layers ?? []) {
      if (layer.id === "route-line") {
        continue;
      }

      if (
        layer.type !== "fill" &&
        layer.type !== "line" &&
        layer.type !== "symbol"
      ) {
        continue;
      }

      try {
        if (layer.type === "fill") {
          map.setPaintProperty(
            layer.id,
            "fill-opacity",
            opacity,
          );
        }

        if (layer.type === "line") {
          map.setPaintProperty(
            layer.id,
            "line-opacity",
            opacity,
          );
        }

        if (layer.type === "symbol") {
          map.setPaintProperty(
            layer.id,
            "text-opacity",
            opacity,
          );

          map.setPaintProperty(
            layer.id,
            "icon-opacity",
            opacity,
          );
        }
      } catch {
        // Some layers may not support these properties.
      }
    }
  }

  /*
   * ============================================================
   * ROUTE EMPHASIS
   * ============================================================
   */

  function updateRouteEmphasis(
    map: MapLibreMap,
    abstractionActive: boolean,
  ) {
    if (!map.getLayer("route-line")) {
      return;
    }

    const width =
      abstractionActive
        ? VISUALIZATION_CONFIG
            .route
            .emphasizedWidth
        : VISUALIZATION_CONFIG
            .route
            .width;

    const opacity =
      abstractionActive
        ? VISUALIZATION_CONFIG
            .route
            .emphasizedOpacity
        : VISUALIZATION_CONFIG
            .route
            .opacity;

    map.setPaintProperty(
      "route-line",
      "line-width",
      width,
    );

    map.setPaintProperty(
      "route-line",
      "line-opacity",
      opacity,
    );
  }

  /*
   * ============================================================
   * DISPLAY ROUTE
   * ============================================================
   */

  function displayRoute(
    map: MapLibreMap,
    route: RouteResponse,
  ) {
    stopNavigationAnimation();

    navigationActiveRef.current = false;

    setNavigationActive(false);
    setNavigationCompleted(false);
    setRouteInfo(route);

    navigationControllerRef.current?.setRoute(
      route.geometry.coordinates,
    );

    setNavigationPosition(
      route.geometry.coordinates[0] ?? null,
    );

    setNavigationDirection("straight");
    setTurnDetected(false);
    setDistanceProgress(0);

    if (routeSourceRef.current) {
      routeSourceRef.current.setData({
        type: "Feature",
        properties: {},
        geometry: route.geometry,
      });
    }

    const bounds = new LngLatBounds();

    for (
      const coordinate of
      route.geometry.coordinates
    ) {
      bounds.extend(coordinate);
    }

    map.fitBounds(bounds, {
      padding: {
        top: 100,
        bottom: 100,
        left: 380,
        right: 100,
      },
      maxZoom: 16,
      duration: 1000,
    });

    /*
     * Route Information automatically opens
     * whenever a route is successfully created.
     */

    setRoutePanelOpen(true);
  }

  /*
   * ============================================================
   * AI ROUTE INTELLIGENCE
   * ============================================================
   */

  useEffect(() => {
    if (!routeInfo) {
      setRouteAIResult(null);
      return;
    }

    const coordinates =
      routeInfo.geometry.coordinates;

    const destination =
      coordinates[
        coordinates.length - 1
      ];

    if (!destination) {
      return;
    }

    const steps =
      routeInfo.steps.flatMap(
        (leg) => leg.steps,
      );

    const result = analyzeRoute({
      routeGeometry: coordinates,

      distanceMeters:
        routeInfo.distance_meters,

      durationSeconds:
        routeInfo.duration_seconds,

      steps,

      nearbyLandmarks: [],

      destination: {
        name:
          destinationInfo?.name ??
          "Route destination",

        category:
          destinationInfo?.category ??
          "destination",

        longitude:
          destination[0],

        latitude:
          destination[1],
      },

      currentRoutePosition:
        coordinates[0] ?? null,
    });

    setRouteAIResult(result);

    const recommended =
      result.intelligence
        .recommendedVisualization;

    if (recommended === "normal") {
      setAbstractionEnabled(false);
      setAbstractionLevel("normal");
    } else {
      setAbstractionEnabled(true);
      setAbstractionLevel(recommended);
    }
  }, [
    routeInfo,
    destinationInfo,
  ]);

  /*
   * ============================================================
   * RESTORE SAVED ROUTE
   * ============================================================
   */

  async function restoreSavedRoute(
    map: MapLibreMap,
    savedRoute: SavedRoute,
  ) {
    const restoredRoute: RouteResponse = {
      distance_meters:
        savedRoute.distanceMeters,

      duration_seconds:
        savedRoute.durationSeconds,

      geometry:
        savedRoute.geometry,

      steps: [
        {
          steps:
            savedRoute.steps,
        },
      ],
    };

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    destinationMarkerRef.current =
      new Marker()
        .setLngLat([
          savedRoute.destination.longitude,
          savedRoute.destination.latitude,
        ])
        .addTo(map);

    setDestinationInfo(null);

    setDestinationPanelOpen(true);
    setRoutePanelOpen(true);

    try {
      const info =
        await identifyDestination(
          savedRoute.destination.longitude,
          savedRoute.destination.latitude,
        );

      if (info) {
        setDestinationInfo(info);
        updateDestinationMarker(info);
      }
    } catch (error) {
      console.error(
        "Saved destination identification failed:",
        error,
      );
    }

    displayRoute(
      map,
      restoredRoute,
    );
  }

  /*
   * ============================================================
   * USE SAVED ROUTE
   * ============================================================
   */

  function useSavedRoute() {
    const savedRoute = getSavedRoute();
    const map = mapRef.current;

    if (!savedRoute || !map) {
      return;
    }

    void restoreSavedRoute(
      map,
      savedRoute,
    );

    setHasSavedRoute(true);
    setMenuOpen(false);
  }

  /*
   * ============================================================
   * 3D NAVIGATION
   * ============================================================
   */

  function updateThreeNavigation() {
    const controller =
      navigationControllerRef.current;

    const scene =
      threeSceneRef.current;

    if (
      !controller ||
      !scene ||
      !routeInfo
    ) {
      return;
    }

    const state =
      controller.getState();

    if (!state.position) {
      return;
    }

    const coordinates =
      routeInfo.geometry.coordinates;

    const nextIndex =
      Math.min(
        state.currentIndex + 1,
        coordinates.length - 1,
      );

    const nextPosition =
      coordinates[nextIndex];

    if (!nextPosition) {
      return;
    }

    scene.updateNavigationArrow(
      state.position,
      nextPosition,
    );

    scene.updateNavigationCamera(
      state.position,
      nextPosition,
    );
  }

  /*
   * ============================================================
   * START NAVIGATION
   * ============================================================
   */

  function startNavigation() {
    if (
      !routeInfo ||
      routeInfo.geometry.coordinates.length < 2
    ) {
      return;
    }

    stopNavigationAnimation();

    navigationControllerRef.current?.setRoute(
      routeInfo.geometry.coordinates,
    );

    navigationActiveRef.current = true;

    setNavigationActive(true);
    setNavigationCompleted(false);

    setNavigationPosition(
      routeInfo.geometry.coordinates[0],
    );

    setDistanceProgress(0);
    setNavigationDirection("straight");
    setTurnDetected(false);

    if (viewMode !== "3D") {
      setViewMode("3D");
    }

    navigationAnimationRef.current =
      requestAnimationFrame(
        runNavigationFrame,
      );
  }

  /*
   * ============================================================
   * PAUSE NAVIGATION
   * ============================================================
   */

  function pauseNavigation() {
    navigationActiveRef.current = false;
    setNavigationActive(false);
    stopNavigationAnimation();
  }

  /*
   * ============================================================
   * RESET NAVIGATION
   * ============================================================
   */

  function resetNavigation() {
    navigationActiveRef.current = false;
    stopNavigationAnimation();

    navigationControllerRef.current?.setRoute(
      routeInfo?.geometry.coordinates ?? [],
    );

    setNavigationActive(false);
    setNavigationCompleted(false);
    setNavigationDirection("straight");
    setTurnDetected(false);
    setDistanceProgress(0);

    setNavigationPosition(
      routeInfo?.geometry.coordinates[0] ??
      null,
    );

    if (
      routeInfo &&
      threeSceneRef.current
    ) {
      threeSceneRef.current.setRoute(
        routeInfo.geometry.coordinates,
      );

      updateThreeDestinationLandmark();
      updateThreeNavigation();
    }
  }

  /*
   * ============================================================
   * STOP NAVIGATION ANIMATION
   * ============================================================
   */

  function stopNavigationAnimation() {
    if (
      navigationAnimationRef.current !==
      null
    ) {
      cancelAnimationFrame(
        navigationAnimationRef.current,
      );

      navigationAnimationRef.current = null;
    }
  }

  /*
   * ============================================================
   * NAVIGATION SIMULATION
   * ============================================================
   */

  function runNavigationFrame() {
    if (!navigationActiveRef.current) {
      navigationAnimationRef.current = null;
      return;
    }

    const controller =
      navigationControllerRef.current;

    if (!controller) {
      navigationAnimationRef.current = null;
      return;
    }

    controller.advance(0.025);

    const state =
      controller.getState();

    setNavigationPosition(state.position);
    setNavigationDirection(state.direction);
    setTurnDetected(state.turnDetected);
    setDistanceProgress(
      state.distanceProgress,
    );

    if (
      state.position &&
      routeInfo
    ) {
      const coordinates =
        routeInfo.geometry.coordinates;

      const nextIndex =
        Math.min(
          state.currentIndex + 1,
          coordinates.length - 1,
        );

      const nextPosition =
        coordinates[nextIndex];

      if (nextPosition) {
        const scene =
          threeSceneRef.current;

        if (scene) {
          scene.updateNavigationCamera(
            state.position,
            nextPosition,
          );

          scene.updateNavigationArrow(
            state.position,
            nextPosition,
          );
        }
      }
    }

    if (state.completed) {
      navigationActiveRef.current = false;

      setNavigationActive(false);
      setNavigationCompleted(true);
      setDistanceProgress(1);

      navigationAnimationRef.current = null;
      return;
    }

    navigationAnimationRef.current =
      requestAnimationFrame(
        runNavigationFrame,
      );
  }

  /*
   * ============================================================
   * MENU ITEM HANDLER
   * ============================================================
   *
   * The ☰ menu shows names only.
   *
   * Destination Information:
   *   opens destination panel.
   *
   * Route Information:
   *   opens route panel again after it was closed.
   *
   * Navigation:
   *   opens navigation panel.
   *
   * Saved Route:
   *   restores the saved route.
   *
   * Map Options:
   *   opens the map options panel.
   */

  function openMenuPanel(
    panel: PanelName,
  ) {
    setDestinationPanelOpen(false);
    setRoutePanelOpen(false);
    setNavigationPanelOpen(false);
    setOptionsOpen(false);

    if (
      panel === "destination" &&
      destinationInfo
    ) {
      setDestinationPanelOpen(true);
    }

    if (
      panel === "route" &&
      routeInfo
    ) {
      setRoutePanelOpen(true);
    }

    if (
      panel === "navigation" &&
      routeInfo
    ) {
      setNavigationPanelOpen(true);
    }

    if (
      panel === "savedRoute" &&
      hasSavedRoute
    ) {
      useSavedRoute();
      return;
    }

    if (panel === "mapOptions") {
      setOptionsOpen(true);
    }

    setMenuOpen(false);
  }

  /*
   * ============================================================
   * DERIVED VALUES
   * ============================================================
   */

  const distanceKm =
    routeInfo
      ? (
          routeInfo.distance_meters /
          1000
        ).toFixed(2)
      : null;

  const durationMinutes =
    routeInfo
      ? Math.ceil(
          routeInfo.duration_seconds /
          60,
        )
      : null;

  const steps =
    routeInfo?.steps?.flatMap(
      (leg) => leg.steps,
    ) ?? [];

  const visualizationStatus =
    !abstractionEnabled
      ? "Normal"
      : abstractionLevel === "normal"
        ? "Abstraction: Normal"
        : abstractionLevel === "reduced"
          ? "Abstraction: Reduced"
          : "Abstraction: Minimal";

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 2D MAP */}

      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          display:
            viewMode === "2D"
              ? "block"
              : "none",
        }}
      />

      {/* 3D MAP */}

      <div
        ref={threeContainerRef}
        style={{
          width: "100%",
          height: "100%",
          display:
            viewMode === "3D"
              ? "block"
              : "none",
        }}
      />

      {/* MENU BUTTON */}

      <button
        onClick={() =>
          setMenuOpen(
            (value) => !value,
          )
        }
        title="Open menu"
        aria-label="Open menu"
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          width: "44px",
          height: "44px",
          border: "none",
          borderRadius: "10px",
          background: "white",
          boxShadow:
            "0 3px 12px rgba(0,0,0,0.25)",
          cursor: "pointer",
          fontSize: "22px",
          fontWeight: "bold",
          zIndex: 40,
        }}
      >
        ☰
      </button>

      {/* TOP STATUS BAR */}

      <div
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          zIndex: 30,
          fontFamily:
            "Arial, sans-serif",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <div style={statusBoxStyle}>
          {online
            ? "🟢 Online"
            : "🔴 Offline"}
        </div>

        <div style={statusBoxStyle}>
          🎯 {visualizationStatus}
        </div>

        <button
          onClick={() => setViewMode("2D")}
          style={{
            ...viewButtonStyle,
            background:
              viewMode === "2D"
                ? "#2563eb"
                : "white",
            color:
              viewMode === "2D"
                ? "white"
                : "black",
          }}
        >
          2D
        </button>

        <button
          onClick={() => setViewMode("3D")}
          style={{
            ...viewButtonStyle,
            background:
              viewMode === "3D"
                ? "#2563eb"
                : "white",
            color:
              viewMode === "3D"
                ? "white"
                : "black",
          }}
        >
          3D
        </button>

        <button
          onClick={() =>
            setOptionsOpen(
              (value) => !value,
            )
          }
          title="Map options"
          aria-label="Map options"
          style={{
            width: "44px",
            height: "44px",
            border: "none",
            borderRadius: "10px",
            background: "white",
            boxShadow:
              "0 3px 12px rgba(0,0,0,0.25)",
            cursor: "pointer",
            fontSize: "22px",
            fontWeight: "bold",
          }}
        >
          ⋮
        </button>
      </div>

      {/* ======================================================
          ☰ MENU
          NAMES ONLY
          ====================================================== */}

      {menuOpen && (
        <section
          style={{
            position: "absolute",
            top: "76px",
            left: "20px",
            background: "white",
            padding: "10px",
            borderRadius: "12px",
            boxShadow:
              "0 4px 18px rgba(0,0,0,0.25)",
            width: "250px",
            maxWidth:
              "calc(100vw - 40px)",
            fontFamily:
              "Arial, sans-serif",
            zIndex: 39,
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              fontWeight: "bold",
              fontSize: "15px",
              borderBottom:
                "1px solid #e5e7eb",
              marginBottom: "4px",
            }}
          >
            🗺️ Mapathon Engine
          </div>

          <button
            onClick={() =>
              openMenuPanel(
                "destination",
              )
            }
            disabled={!destinationInfo}
            style={{
              ...menuItemStyle,
              opacity:
                destinationInfo
                  ? 1
                  : 0.45,
            }}
          >
            📍 Destination Information
          </button>

          <button
            onClick={() =>
              openMenuPanel("route")
            }
            disabled={!routeInfo}
            style={{
              ...menuItemStyle,
              opacity:
                routeInfo ? 1 : 0.45,
            }}
          >
            🧭 Route Information
          </button>

          <button
            onClick={() =>
              openMenuPanel(
                "navigation",
              )
            }
            disabled={!routeInfo}
            style={{
              ...menuItemStyle,
              opacity:
                routeInfo ? 1 : 0.45,
            }}
          >
            🚗 Navigation
          </button>

          <button
            onClick={() =>
              openMenuPanel(
                "savedRoute",
              )
            }
            disabled={!hasSavedRoute}
            style={{
              ...menuItemStyle,
              opacity:
                hasSavedRoute
                  ? 1
                  : 0.45,
            }}
          >
            💾 Saved Route
          </button>

          <button
            onClick={() =>
              openMenuPanel(
                "mapOptions",
              )
            }
            style={menuItemStyle}
          >
            ⚙️ Map Options
          </button>
        </section>
      )}

      {/* ======================================================
          MAP OPTIONS
          ====================================================== */}

      {optionsOpen && (
        <section
          style={{
            position: "absolute",
            top: "76px",
            right: "20px",
            background: "white",
            padding: "14px",
            borderRadius: "10px",
            boxShadow:
              "0 3px 12px rgba(0,0,0,0.22)",
            minWidth: "220px",
            zIndex: 35,
            fontFamily:
              "Arial, sans-serif",
          }}
        >
          <PanelHeader
            title="⚙️ Map Options"
            onClose={() =>
              setOptionsOpen(false)
            }
          />

          {viewMode === "2D" && (
            <>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "14px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    abstractionEnabled
                  }
                  onChange={(event) =>
                    setAbstractionEnabled(
                      event.target.checked,
                    )
                  }
                />

                Reduce surroundings
              </label>

              <label
                style={{
                  display: "block",
                  marginTop: "10px",
                  fontSize: "13px",
                }}
              >
                Abstraction level

                <select
                  value={abstractionLevel}
                  onChange={(event) =>
                    setAbstractionLevel(
                      event.target.value as AbstractionLevel,
                    )
                  }
                  disabled={
                    !abstractionEnabled
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "5px",
                    padding: "6px",
                    borderRadius: "6px",
                    border:
                      "1px solid #ccc",
                  }}
                >
                  <option value="normal">
                    Normal
                  </option>

                  <option value="reduced">
                    Reduced
                  </option>

                  <option value="minimal">
                    Minimal
                  </option>
                </select>
              </label>
            </>
          )}

          <hr />

          <strong>Saved Route</strong>

          {hasSavedRoute ? (
            <button
              onClick={useSavedRoute}
              style={{
                display: "block",
                width: "100%",
                marginTop: "8px",
                background: "#2563eb",
                color: "white",
                border: "none",
                padding: "9px",
                borderRadius: "7px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              📍 Restore Saved Route
            </button>
          ) : (
            <div
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color: "#666",
              }}
            >
              No saved route available.
            </div>
          )}
        </section>
      )}

      {/* ======================================================
          DESTINATION INFORMATION
          ====================================================== */}

      {destinationInfo &&
        destinationPanelOpen && (
          <section
            style={{
              position: "absolute",
              top: "80px",
              left: "20px",
              background: "white",
              padding: "16px",
              borderRadius: "12px",
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.22)",
              maxWidth: "340px",
              width:
                "calc(100vw - 40px)",
              fontFamily:
                "Arial, sans-serif",
              zIndex: 20,
            }}
          >
            <PanelHeader
              title="📍 Destination Information"
              onClose={() =>
                setDestinationPanelOpen(
                  false,
                )
              }
            />

            <h3
              style={{
                margin:
                  "10px 0 8px",
              }}
            >
              {destinationInfo.name}
            </h3>

            <div
              style={{
                display:
                  "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#eff6ff",
                color: "#1d4ed8",
                padding: "5px 9px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              {destinationInfo.landmarkIcon}
              {destinationInfo.landmarkLabel}
            </div>

            <p
              style={{
                margin:
                  "10px 0 5px",
                fontSize: "13px",
              }}
            >
              <strong>Type:</strong>{" "}
              {destinationInfo.category}
            </p>

            <p
              style={{
                margin: "5px 0",
                fontSize: "12px",
                color: "#555",
              }}
            >
              {destinationInfo.displayName}
            </p>

            <p
              style={{
                margin:
                  "5px 0 0",
                fontSize: "11px",
                color: "#777",
              }}
            >
              Coordinates:{" "}
              {destinationInfo.latitude.toFixed(5)}
              {" , "}
              {destinationInfo.longitude.toFixed(5)}
            </p>
          </section>
        )}

      {/* ======================================================
          SELECTED 3D LANDMARK
          ====================================================== */}

      {selectedLandmark && (
        <section
          style={{
            position: "absolute",
            top:
              destinationInfo &&
              destinationPanelOpen
                ? "270px"
                : "80px",
            left: "20px",
            background: "white",
            padding: "12px",
            borderRadius: "10px",
            boxShadow:
              "0 3px 12px rgba(0,0,0,0.2)",
            fontFamily:
              "Arial, sans-serif",
            zIndex: 19,
            maxWidth: "300px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <strong>
              {selectedLandmark.icon}{" "}
              {selectedLandmark.name}
            </strong>

            <button
              onClick={() =>
                setSelectedLandmark(null)
              }
              style={{
                border: "none",
                background: "#f1f5f9",
                borderRadius: "6px",
                width: "26px",
                height: "26px",
                cursor: "pointer",
                fontSize: "17px",
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              marginTop: "6px",
              fontSize: "12px",
              color: "#475569",
            }}
          >
            {selectedLandmark.label}
          </div>
        </section>
      )}

      {/* ======================================================
          ROUTE INFORMATION
          ====================================================== */}

      {routeInfo &&
        routePanelOpen && (
          <section
            style={{
              position: "absolute",
              top:
                destinationInfo &&
                destinationPanelOpen
                  ? "370px"
                  : "80px",
              left: "20px",
              background: "white",
              padding: "16px",
              borderRadius: "12px",
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.22)",
              width: "340px",
              maxWidth:
                "calc(100vw - 40px)",
              maxHeight: "65vh",
              overflowY: "auto",
              fontFamily:
                "Arial, sans-serif",
              zIndex: 18,
            }}
          >
            <PanelHeader
              title="🧭 Route Information"
              onClose={() =>
                setRoutePanelOpen(false)
              }
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              <InfoCard
                label="Distance"
                value={`${distanceKm} km`}
              />

              <InfoCard
                label="Estimated time"
                value={`${durationMinutes} min`}
              />
            </div>

            {routeAIResult && (
              <>
                <hr />

                <strong>
                  🤖 Route Intelligence
                </strong>

                <div
                  style={{
                    marginTop: "8px",
                    padding: "10px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border:
                      "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                >
                  <p
                    style={{
                      margin:
                        "0 0 6px",
                    }}
                  >
                    <strong>
                      Complexity:
                    </strong>{" "}
                    {
                      routeAIResult
                        .intelligence
                        .routeComplexity
                    }
                  </p>

                  <p
                    style={{
                      margin:
                        "0 0 6px",
                    }}
                  >
                    <strong>
                      Visualization:
                    </strong>{" "}
                    {
                      routeAIResult
                        .intelligence
                        .recommendedVisualization
                    }
                  </p>

                  <p
                    style={{
                      margin: 0,
                      color: "#475569",
                    }}
                  >
                    {
                      routeAIResult
                        .intelligence
                        .reason
                    }
                  </p>
                </div>
              </>
            )}

            <hr />

            <strong>Directions</strong>

            <ol
              style={{
                paddingLeft: "22px",
              }}
            >
              {steps.map(
                (step, index) => (
                  <li
                    key={index}
                    style={{
                      marginBottom:
                        "8px",
                      fontSize:
                        "13px",
                    }}
                  >
                    {step.maneuver.type}

                    {step.maneuver.modifier
                      ? ` ${step.maneuver.modifier}`
                      : ""}

                    {step.name
                      ? ` — ${step.name}`
                      : ""}
                  </li>
                ),
              )}
            </ol>

            <hr />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "10px",
              }}
            >
              <strong>Navigation</strong>

              <button
                onClick={() =>
                  setNavigationPanelOpen(
                    true,
                  )
                }
                style={{
                  border: "none",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "6px 9px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                Open
              </button>
            </div>
          </section>
        )}

      {/* ======================================================
          NAVIGATION INFORMATION
          ====================================================== */}

      {routeInfo &&
        navigationPanelOpen && (
          <section
            style={{
              position: "absolute",
              top: "80px",
              right: "20px",
              background: "white",
              padding: "16px",
              borderRadius: "12px",
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.22)",
              width: "300px",
              maxWidth:
                "calc(100vw - 40px)",
              fontFamily:
                "Arial, sans-serif",
              zIndex: 20,
            }}
          >
            <PanelHeader
              title="🚗 Navigation"
              onClose={() =>
                setNavigationPanelOpen(
                  false,
                )
              }
            />

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {!navigationActive &&
                !navigationCompleted && (
                  <button
                    onClick={
                      startNavigation
                    }
                    style={
                      primaryButtonStyle
                    }
                  >
                    ▶ Start
                  </button>
                )}

              {navigationActive && (
                <button
                  onClick={
                    pauseNavigation
                  }
                  style={
                    warningButtonStyle
                  }
                >
                  ⏸ Pause
                </button>
              )}

              <button
                onClick={
                  resetNavigation
                }
                style={
                  secondaryButtonStyle
                }
              >
                🔄 Reset
              </button>
            </div>

            {navigationActive && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  background: "#eff6ff",
                  borderRadius: "8px",
                  color: "#1d4ed8",
                  fontSize: "12px",
                }}
              >
                <strong>
                  🧭 Navigation active
                </strong>

                <p>
                  Direction:{" "}
                  <strong>
                    {navigationDirection}
                  </strong>
                </p>

                {turnDetected && (
                  <p
                    style={{
                      fontWeight: "bold",
                    }}
                  >
                    ↪ Turn detected
                  </p>
                )}

                <p>
                  Progress:{" "}
                  {Math.round(
                    distanceProgress * 100,
                  )}
                  %
                </p>
              </div>
            )}

            {navigationCompleted && (
              <p
                style={{
                  color: "#16a34a",
                  fontWeight: "bold",
                }}
              >
                🏁 Arrived at destination
              </p>
            )}

            {navigationPosition && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#555",
                }}
              >
                Position:{" "}
                {navigationPosition[1].toFixed(5)}
                {", "}
                {navigationPosition[0].toFixed(5)}
              </p>
            )}
          </section>
        )}

      {/* ======================================================
          3D NAVIGATION BAR
          ====================================================== */}

      {viewMode === "3D" &&
        routeInfo && (
          <section
            style={{
              position: "absolute",
              bottom: "25px",
              left: "50%",
              transform:
                "translateX(-50%)",
              background: "white",
              padding: "10px 14px",
              borderRadius: "10px",
              boxShadow:
                "0 3px 12px rgba(0,0,0,0.25)",
              fontFamily:
                "Arial, sans-serif",
              zIndex: 25,
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {!navigationActive &&
              !navigationCompleted && (
                <button
                  onClick={
                    startNavigation
                  }
                  style={
                    primaryButtonStyle
                  }
                >
                  ▶ Start Navigation
                </button>
              )}

            {navigationActive && (
              <button
                onClick={
                  pauseNavigation
                }
                style={
                  warningButtonStyle
                }
              >
                ⏸ Pause
              </button>
            )}

            <button
              onClick={
                resetNavigation
              }
              style={
                secondaryButtonStyle
              }
            >
              🔄 Reset
            </button>

            {navigationActive && (
              <span
                style={{
                  color: "#2563eb",
                  fontWeight: "bold",
                  fontSize: "13px",
                }}
              >
                {navigationDirection ===
                "left"
                  ? "↰ LEFT"
                  : navigationDirection ===
                      "right"
                    ? "↱ RIGHT"
                    : "↑ STRAIGHT"}
              </span>
            )}

            {navigationCompleted && (
              <strong
                style={{
                  color: "#16a34a",
                }}
              >
                🏁 Arrived
              </strong>
            )}
          </section>
        )}

      {/* GLOBAL STYLES */}

      <style>
        {`
          * {
            box-sizing: border-box;
          }

          html,
          body,
          #root {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
          }

          button {
            font-family:
              Arial,
              sans-serif;
          }

          button:focus-visible,
          input:focus-visible,
          select:focus-visible {
            outline:
              2px solid #2563eb;
            outline-offset:
              2px;
          }

          button:hover:not(:disabled) {
            filter: brightness(0.97);
          }

          button:disabled {
            cursor: not-allowed;
          }

          @media (max-width: 700px) {
            section {
              max-width:
                calc(100vw - 40px);
            }
          }
        `}
      </style>
    </main>
  );
}

/*
 * ============================================================
 * UI HELPERS
 * ============================================================
 */

const statusBoxStyle: React.CSSProperties = {
  background: "white",
  padding: "8px 12px",
  borderRadius: "8px",
  boxShadow:
    "0 2px 8px rgba(0,0,0,0.2)",
  fontSize: "14px",
  fontWeight: "bold",
};

const viewButtonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  fontWeight: "bold",
  cursor: "pointer",
};

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  border: "none",
  background: "white",
  padding: "11px 10px",
  textAlign: "left",
  borderRadius: "7px",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "600",
  color: "#1f2937",
  marginBottom: "2px",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: "bold",
};

const warningButtonStyle: React.CSSProperties = {
  background: "#f59e0b",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: "bold",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#6b7280",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: "7px",
  cursor: "pointer",
  fontWeight: "bold",
};

function PanelHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent:
          "space-between",
        gap: "12px",
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: "17px",
        }}
      >
        {title}
      </h3>

      <button
        onClick={onClose}
        title="Close"
        aria-label="Close"
        style={{
          width: "28px",
          height: "28px",
          border: "none",
          borderRadius: "7px",
          background: "#f1f5f9",
          color: "#475569",
          cursor: "pointer",
          fontSize: "18px",
          lineHeight: 1,
          fontWeight: "bold",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border:
          "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "10px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "#64748b",
          marginBottom: "3px",
        }}
      >
        {label}
      </div>

      <strong
        style={{
          fontSize: "14px",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default App;