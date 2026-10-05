import { useEffect, useRef, useState } from "react";
import {
  Map,
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

function App() {
  const mapContainer =
    useRef<HTMLDivElement | null>(null);

  const threeContainer =
    useRef<HTMLDivElement | null>(null);

  const destinationMarker =
    useRef<Marker | null>(null);

  const routeSource =
    useRef<GeoJSONSource | null>(null);

  const mapRef =
    useRef<Map | null>(null);

  const threeSceneRef =
    useRef<ThreeScene | null>(null);

  const navigationControllerRef =
    useRef<NavigationController | null>(null);

  const navigationAnimationRef =
    useRef<number | null>(null);

  const navigationActiveRef =
    useRef(false);

  const [routeInfo, setRouteInfo] =
    useState<RouteResponse | null>(null);

  const [online, setOnline] =
    useState(isOnline());

  const [hasSavedRoute, setHasSavedRoute] =
    useState(
      getSavedRoute() !== null,
    );

  const [abstractionEnabled, setAbstractionEnabled] =
    useState<boolean>(
      VISUALIZATION_CONFIG
        .surroundings
        .abstractionEnabled,
    );

  const [abstractionLevel, setAbstractionLevel] =
    useState<AbstractionLevel>(
      VISUALIZATION_CONFIG
        .surroundings
        .level,
    );

  const [viewMode, setViewMode] =
    useState<"2D" | "3D">(
      VISUALIZATION_CONFIG.mode,
    );

  const [navigationActive, setNavigationActive] =
    useState(false);

  const [navigationCompleted, setNavigationCompleted] =
    useState(false);

  const [navigationPosition, setNavigationPosition] =
    useState<[number, number] | null>(null);

  const [destinationInfo, setDestinationInfo] =
    useState<DestinationInfo | null>(null);

  const [routeAIResult, setRouteAIResult] =
    useState<RouteAIResult | null>(null);

  /*
   * Update the 3D destination landmark
   * using the actual identified destination.
   */
  function updateThreeDestinationLandmark() {
    const scene = threeSceneRef.current;

    if (!scene || !destinationInfo || !routeInfo) {
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
   * Handle interaction with the 3D
   * destination landmark.
   */
  async function handleThreeDestinationLandmarkClick(
    position: [number, number],
  ) {
    try {
      const info =
        await identifyDestination(
          position[0],
          position[1],
        );

      if (!info) {
        return;
      }

      setDestinationInfo(info);

      updateDestinationMarker(info);
    } catch (error) {
      console.error(
        "3D landmark identification failed:",
        error,
      );
    }
  }

  /*
   * Navigation controller
   */
  useEffect(() => {
    navigationControllerRef.current =
      new NavigationController();

    return () => {
      stopNavigationAnimation();

      navigationActiveRef.current =
        false;

      navigationControllerRef.current =
        null;
    };
  }, []);

  /*
   * Network status
   */
  useEffect(() => {
    return subscribeToNetworkStatus(
      setOnline,
    );
  }, []);

  /*
   * Saved route status
   */
  useEffect(() => {
    setHasSavedRoute(
      getSavedRoute() !== null,
    );
  }, [routeInfo]);

  /*
   * Apply visualization settings
   */
  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !map.isStyleLoaded()
    ) {
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
   * Create / destroy 3D scene
   */
  useEffect(() => {
    if (viewMode !== "3D") {
      if (threeSceneRef.current) {
        threeSceneRef.current.dispose();
        threeSceneRef.current = null;
      }

      return;
    }

    if (!threeContainer.current) {
      return;
    }

    threeSceneRef.current =
      new ThreeScene(
        threeContainer.current,
      );

    if (routeInfo) {
      threeSceneRef.current.setRoute(
        routeInfo.geometry.coordinates,
      );

      updateThreeDestinationLandmark();
      updateThreeNavigation();
    }

    return () => {
      if (threeSceneRef.current) {
        threeSceneRef.current.dispose();
        threeSceneRef.current = null;
      }
    };
  }, [viewMode]);

  /*
   * Update route inside 3D scene
   */
  useEffect(() => {
    const scene =
      threeSceneRef.current;

    if (!scene) {
      return;
    }

    if (!routeInfo) {
      scene.setRoute([]);
      return;
    }

    scene.setRoute(
      routeInfo.geometry.coordinates,
    );

    updateThreeDestinationLandmark();
  }, [routeInfo]);

  /*
   * Update 3D landmark when destination
   * identification finishes or the 3D scene
   * is recreated.
   */
  useEffect(() => {
    const scene =
      threeSceneRef.current;

    if (!scene) {
      return;
    }

    scene.setDestinationLandmarkClickHandler(
      (data) => {
        void handleThreeDestinationLandmarkClick(
          data.position,
        );
      },
    );

    if (!destinationInfo || !routeInfo) {
      scene.clearDestinationLandmark();
      return () => {
        scene.setDestinationLandmarkClickHandler(
          null,
        );
      };
    }

    updateThreeDestinationLandmark();

    return () => {
      scene.setDestinationLandmarkClickHandler(
        null,
      );
    };
  }, [destinationInfo, routeInfo, viewMode]);

  /*
   * Initialize MapLibre
   */
  useEffect(() => {
    if (!mapContainer.current) {
      return;
    }

    const map = new Map({
      container:
        mapContainer.current,

      style:
        "https://tiles.openfreemap.org/styles/liberty",

      center:
        MAP_CONFIG.center,

      zoom:
        MAP_CONFIG.zoom,

      minZoom:
        MAP_CONFIG.minZoom,

      maxZoom:
        MAP_CONFIG.maxZoom,
    });

    mapRef.current = map;

    map.addControl(
      new NavigationControl(),
      "top-right",
    );

    /*
     * Current location marker
     */
    new Marker()
      .setLngLat(
        MAP_CONFIG.center,
      )
      .addTo(map);

    /*
     * Map loaded
     */
    map.on("load", () => {
      map.addSource(
        "route",
        {
          type: "geojson",

          data: {
            type:
              "FeatureCollection",

            features: [],
          },
        },
      );

      routeSource.current =
        map.getSource(
          "route",
        ) as GeoJSONSource;

      if (
        VISUALIZATION_CONFIG
          .route.visible
      ) {
        map.addLayer({
          id: "route-line",

          type: "line",

          source: "route",

          layout: {
            "line-cap":
              "round",

            "line-join":
              "round",
          },

          paint: {
            "line-color":
              VISUALIZATION_CONFIG
                .route.color,

            "line-width":
              VISUALIZATION_CONFIG
                .route.width,

            "line-opacity":
              VISUALIZATION_CONFIG
                .route.opacity,
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

      const savedRoute =
        getSavedRoute();

      if (savedRoute) {
        restoreSavedRoute(
          map,
          savedRoute,
        );
      }
    });

    /*
     * Destination click
     */
    map.on(
      "click",
      async (event) => {
        if (!navigator.onLine) {
          console.log(
            "Offline mode: new route calculation unavailable.",
          );

          return;
        }

        resetNavigation();

        setDestinationInfo(null);
        setRouteAIResult(null);

        const destination:
          [number, number] = [
          event.lngLat.lng,
          event.lngLat.lat,
        ];

        /*
         * Remove previous destination
         */
        if (
          destinationMarker.current
        ) {
          destinationMarker.current.remove();
        }

        /*
         * Clear old route
         */
        if (
          routeSource.current
        ) {
          routeSource.current.setData(
            {
              type:
                "FeatureCollection",

              features: [],
            },
          );
        }

        setRouteInfo(null);

        /*
         * Temporary destination marker.
         * It will become an icon marker
         * after OSM identification finishes.
         */
        destinationMarker.current =
          new Marker()
            .setLngLat(
              destination,
            )
            .addTo(map);

        /*
         * Identify destination
         */
        identifyDestination(
          destination[0],
          destination[1],
        ).then((info) => {
          if (!info) {
            return;
          }

          setDestinationInfo(info);

          updateDestinationMarker(
            info,
          );
        });

        /*
         * Calculate route
         */
        try {
          const response =
            await fetch(
              "http://127.0.0.1:8000/route",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  start: {
                    longitude:
                      MAP_CONFIG
                        .center[0],

                    latitude:
                      MAP_CONFIG
                        .center[1],
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

          const route:
            RouteResponse =
            await response.json();

          displayRoute(
            map,
            route,
          );

          const steps =
            route.steps.flatMap(
              (leg) => leg.steps,
            );
            route.steps.flatMap(
              (leg) =>
                leg.steps,
            );

          const savedRoute:
            SavedRoute = {
            id:
              crypto.randomUUID(),

            savedAt:
              new Date().toISOString(),

            start: {
              longitude:
                MAP_CONFIG
                  .center[0],

              latitude:
                MAP_CONFIG
                  .center[1],
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

            geometry:
              route.geometry,

            steps,
          };

          saveRoute(
            savedRoute,
          );

          setHasSavedRoute(
            true,
          );
        } catch (error) {
          console.error(
            "Route calculation failed:",
            error,
          );
        }
      },
    );

    map.on(
      "error",
      (event) => {
        console.error(
          "MapLibre encountered an error:",
          event.error,
        );
      },
    );

    return () => {
      mapRef.current = null;

      map.remove();
    };
  }, []);

  /*
   * Create visual landmark marker
   */
  function updateDestinationMarker(
    info: DestinationInfo,
  ) {
    const marker =
      destinationMarker.current;

    if (!marker) {
      return;
    }

    const element =
      marker.getElement();

    /*
     * Clear default MapLibre marker
     */
    element.innerHTML = "";

    element.style.width =
      "46px";

    element.style.height =
      "46px";

    element.style.borderRadius =
      "50%";

    element.style.background =
      "white";

    element.style.border =
      "3px solid #2563eb";

    element.style.boxShadow =
      "0 3px 10px rgba(0,0,0,0.3)";

    element.style.display =
      "flex";

    element.style.alignItems =
      "center";

    element.style.justifyContent =
      "center";

    element.style.fontSize =
      "25px";

    element.style.cursor =
      "pointer";

    element.style.transform =
      "translateY(-50%)";

    element.textContent =
      info.landmarkIcon;

    /*
     * Small label above the marker
     */
    const label =
      document.createElement(
        "div",
      );

    label.textContent =
      info.landmarkLabel;

    label.style.position =
      "absolute";

    label.style.bottom =
      "48px";

    label.style.left =
      "50%";

    label.style.transform =
      "translateX(-50%)";

    label.style.background =
      "#2563eb";

    label.style.color =
      "white";

    label.style.padding =
      "4px 8px";

    label.style.borderRadius =
      "6px";

    label.style.fontSize =
      "11px";

    label.style.fontWeight =
      "bold";

    label.style.whiteSpace =
      "nowrap";

    label.style.boxShadow =
      "0 2px 6px rgba(0,0,0,0.25)";

    element.appendChild(
      label,
    );

    /*
     * Tooltip
     */
    element.title =
      `${info.landmarkIcon} ${info.landmarkLabel}: ${info.name}`;
  }

  /*
   * Visual abstraction
   */
  function applySurroundingsAbstraction(
    map: Map,
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

    const style =
      map.getStyle();

    for (
      const layer of
      style.layers ?? []
    ) {
      if (
        layer.id ===
        "route-line"
      ) {
        continue;
      }

      if (
        layer.type !==
          "fill" &&
        layer.type !==
          "line" &&
        layer.type !==
          "symbol"
      ) {
        continue;
      }

      try {
        if (
          layer.type ===
          "fill"
        ) {
          map.setPaintProperty(
            layer.id,
            "fill-opacity",
            opacity,
          );
        }

        if (
          layer.type ===
          "line"
        ) {
          map.setPaintProperty(
            layer.id,
            "line-opacity",
            opacity,
          );
        }

        if (
          layer.type ===
          "symbol"
        ) {
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
        // Some style layers do not support these properties.
      }
    }
  }

  /*
   * Route emphasis
   */
  function updateRouteEmphasis(
    map: Map,
    abstractionActive: boolean,
  ) {
    if (
      !map.getLayer(
        "route-line",
      )
    ) {
      return;
    }

    const routeWidth =
      abstractionActive
        ? VISUALIZATION_CONFIG
            .route
            .emphasizedWidth
        : VISUALIZATION_CONFIG
            .route
            .width;

    const routeOpacity =
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
      routeWidth,
    );

    map.setPaintProperty(
      "route-line",
      "line-opacity",
      routeOpacity,
    );
  }

  /*
   * Display route
   */
  function displayRoute(
    map: Map,
    route: RouteResponse,
  ) {
    navigationActiveRef.current =
      false;

    stopNavigationAnimation();

    setRouteInfo(
      route,
    );

    const routeSteps =
      route.steps.flatMap(
        (leg) => leg.steps,
      );

    const destinationCoordinate =
      route.geometry.coordinates[
        route.geometry.coordinates.length - 1
      ];

    if (destinationCoordinate) {
      const aiResult =
        analyzeRoute({
          routeGeometry:
            route.geometry.coordinates,
          distanceMeters:
            route.distance_meters,
          durationSeconds:
            route.duration_seconds,
          steps: routeSteps,
          destination: {
            name:
              destinationInfo?.name ??
              "Route destination",
            category:
              destinationInfo?.category ??
              "destination",
            longitude:
              destinationCoordinate[0],
            latitude:
              destinationCoordinate[1],
          },
          currentRoutePosition:
            route.geometry.coordinates[0] ?? null,
        });

      setRouteAIResult(aiResult);

      if (
        aiResult.intelligence
          .recommendedVisualization !==
        "normal"
      ) {
        setAbstractionEnabled(true);
        setAbstractionLevel(
          aiResult.intelligence
            .recommendedVisualization,
        );
      }
    }

    navigationControllerRef.current?.setRoute(
      route.geometry.coordinates,
    );

    setNavigationActive(
      false,
    );

    setNavigationCompleted(
      false,
    );

    setNavigationPosition(
      route.geometry
        .coordinates[0] ??
        null,
    );

    if (
      routeSource.current
    ) {
      routeSource.current.setData(
        {
          type:
            "Feature",

          properties: {},

          geometry:
            route.geometry,
        },
      );
    }

    const bounds =
      new LngLatBounds();

    for (
      const coordinate of
      route.geometry.coordinates
    ) {
      bounds.extend(
        coordinate,
      );
    }

    map.fitBounds(
      bounds,
      {
        padding: {
          top: 100,
          bottom: 100,
          left: 380,
          right: 100,
        },

        maxZoom: 16,

        duration: 1000,
      },
    );
  }

  /*
   * Restore saved route
   */
  function restoreSavedRoute(
    map: Map,
    savedRoute: SavedRoute,
  ) {
    const restoredRoute:
      RouteResponse = {
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

    if (
      destinationMarker.current
    ) {
      destinationMarker.current.remove();
    }

    destinationMarker.current =
      new Marker()
        .setLngLat([
          savedRoute
            .destination
            .longitude,

          savedRoute
            .destination
            .latitude,
        ])
        .addTo(map);

    setDestinationInfo(
      null,
    );

    identifyDestination(
      savedRoute
        .destination
        .longitude,

      savedRoute
        .destination
        .latitude,
    ).then((info) => {
      if (!info) {
        return;
      }

      setDestinationInfo(
        info,
      );

      updateDestinationMarker(
        info,
      );
    });

    displayRoute(
      map,
      restoredRoute,
    );
  }

  /*
   * Use saved route
   */
  function useSavedRoute() {
    const savedRoute =
      getSavedRoute();

    const map =
      mapRef.current;

    if (
      !savedRoute ||
      !map
    ) {
      return;
    }

    restoreSavedRoute(
      map,
      savedRoute,
    );

    setHasSavedRoute(
      true,
    );
  }

  /*
   * Update 3D navigation
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

    if (
      !state.position
    ) {
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
   * Start navigation
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

    navigationActiveRef.current =
      true;

    setNavigationActive(
      true,
    );

    setNavigationCompleted(
      false,
    );

    setNavigationPosition(
      routeInfo.geometry
        .coordinates[0],
    );

    if (
      viewMode !== "3D"
    ) {
      setViewMode("3D");
    }

    navigationAnimationRef.current =
      requestAnimationFrame(
        runNavigationFrame,
      );
  }

  /*
   * Pause navigation
   */
  function pauseNavigation() {
    navigationActiveRef.current =
      false;

    setNavigationActive(
      false,
    );

    stopNavigationAnimation();
  }

  /*
   * Reset navigation
   */
  function resetNavigation() {
    navigationActiveRef.current =
      false;

    stopNavigationAnimation();

    navigationControllerRef.current?.setRoute(
      routeInfo?.geometry
        .coordinates ?? [],
    );

    setNavigationActive(
      false,
    );

    setNavigationCompleted(
      false,
    );

    setNavigationPosition(
      routeInfo?.geometry
        .coordinates[0] ??
        null,
    );

    if (
      routeInfo &&
      threeSceneRef.current
    ) {
      threeSceneRef.current.setRoute(
        routeInfo.geometry
          .coordinates,
      );

      updateThreeNavigation();
    }
  }

  /*
   * Stop animation
   */
  function stopNavigationAnimation() {
    if (
      navigationAnimationRef.current !==
      null
    ) {
      cancelAnimationFrame(
        navigationAnimationRef.current,
      );

      navigationAnimationRef.current =
        null;
    }
  }

  /*
   * Navigation simulation
   */
  function runNavigationFrame() {
    if (
      !navigationActiveRef.current
    ) {
      navigationAnimationRef.current =
        null;

      return;
    }

    const controller =
      navigationControllerRef.current;

    if (!controller) {
      navigationAnimationRef.current =
        null;

      return;
    }

    /*
     * Keep current tested movement speed.
     */
    controller.advance(
      0.08,
    );

    const state =
      controller.getState();

    setNavigationPosition(
      state.position,
    );

    updateThreeNavigation();

    if (
      state.completed
    ) {
      navigationActiveRef.current =
        false;

      setNavigationActive(
        false,
      );

      setNavigationCompleted(
        true,
      );

      navigationAnimationRef.current =
        null;

      return;
    }

    navigationAnimationRef.current =
      requestAnimationFrame(
        runNavigationFrame,
      );
  }

  const distanceKm =
    routeInfo
      ? (
          routeInfo
            .distance_meters /
          1000
        ).toFixed(2)
      : null;

  const durationMinutes =
    routeInfo
      ? Math.ceil(
          routeInfo
            .duration_seconds /
            60,
        )
      : null;

  const steps =
    routeInfo
      ?.steps?.[0]?.steps ??
    [];

  const visualizationStatus =
    !abstractionEnabled
      ? "Normal"
      : abstractionLevel ===
          "normal"
        ? "Abstraction: Normal"
        : abstractionLevel ===
            "reduced"
          ? "Abstraction: Reduced"
          : "Abstraction: Minimal";

  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        position:
          "relative",
      }}
    >
      {/* 2D MAP */}
      <div
        ref={mapContainer}
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
        ref={threeContainer}
        style={{
          width: "100%",
          height: "100%",
          display:
            viewMode === "3D"
              ? "block"
              : "none",
        }}
      />

      {/* TOP CONTROLS */}
      <div
        style={{
          position:
            "absolute",

          top: "20px",

          right: "60px",

          display: "flex",

          gap: "8px",

          alignItems:
            "center",

          zIndex: 10,
        }}
      >
        <div
          style={{
            background:
              "white",

            padding:
              "8px 12px",

            borderRadius:
              "8px",

            boxShadow:
              "0 2px 8px rgba(0,0,0,0.2)",

            fontFamily:
              "Arial, sans-serif",

            fontSize:
              "14px",

            fontWeight:
              "bold",
          }}
        >
          {online
            ? "🟢 Online"
            : "🔴 Offline"}
        </div>

        <div
          style={{
            background:
              "white",

            padding:
              "8px 12px",

            borderRadius:
              "8px",

            boxShadow:
              "0 2px 8px rgba(0,0,0,0.2)",

            fontFamily:
              "Arial, sans-serif",

            fontSize:
              "14px",

            fontWeight:
              "bold",
          }}
        >
          🎯{" "}
          {visualizationStatus}
        </div>

        <button
          onClick={() =>
            setViewMode("2D")
          }
          style={{
            padding:
              "8px 12px",

            borderRadius:
              "8px",

            border:
              "1px solid #ccc",

            background:
              viewMode === "2D"
                ? "#2563eb"
                : "white",

            color:
              viewMode === "2D"
                ? "white"
                : "black",

            fontWeight:
              "bold",

            cursor:
              "pointer",
          }}
        >
          2D
        </button>

        <button
          onClick={() =>
            setViewMode("3D")
          }
          style={{
            padding:
              "8px 12px",

            borderRadius:
              "8px",

            border:
              "1px solid #ccc",

            background:
              viewMode === "3D"
                ? "#2563eb"
                : "white",

            color:
              viewMode === "3D"
                ? "white"
                : "black",

            fontWeight:
              "bold",

            cursor:
              "pointer",
          }}
        >
          3D
        </button>
      </div>

      {/* DESTINATION INFORMATION */}
      {destinationInfo && (
        <section
          style={{
            position:
              "absolute",

            top: "20px",

            left: "20px",

            background:
              "white",

            padding:
              "14px",

            borderRadius:
              "10px",

            boxShadow:
              "0 3px 12px rgba(0,0,0,0.2)",

            fontFamily:
              "Arial, sans-serif",

            maxWidth:
              "320px",

            zIndex: 11,
          }}
        >
          <strong>
            {destinationInfo.landmarkIcon}{" "}
            Destination
          </strong>

          <h3
            style={{
              margin:
                "8px 0 6px",
            }}
          >
            {destinationInfo.name}
          </h3>

          {/* NEW LANDMARK CLASS */}
          <div
            style={{
              display:
                "inline-flex",

              alignItems:
                "center",

              gap: "6px",

              background:
                "#eff6ff",

              color:
                "#1d4ed8",

              padding:
                "5px 9px",

              borderRadius:
                "6px",

              fontSize:
                "12px",

              fontWeight:
                "bold",

              marginBottom:
                "8px",
            }}
          >
            {destinationInfo.landmarkIcon}

            {destinationInfo.landmarkLabel}
          </div>

          <p
            style={{
              margin:
                "4px 0",

              fontSize:
                "13px",
            }}
          >
            <strong>
              Type:
            </strong>{" "}
            {destinationInfo.category}
          </p>

          <p
            style={{
              margin:
                "4px 0",

              fontSize:
                "12px",

              color:
                "#555",
            }}
          >
            {destinationInfo.displayName}
          </p>

          <p
            style={{
              margin:
                "4px 0",

              fontSize:
                "11px",

              color:
                "#777",
            }}
          >
            {destinationInfo.latitude.toFixed(
              5,
            )}
            {" , "}
            {destinationInfo.longitude.toFixed(
              5,
            )}
          </p>
        </section>
      )}

      {/* 2D CONTROLS */}
      {viewMode === "2D" && (
        <>
          {/* VISUAL ABSTRACTION */}
          <section
            style={{
              position:
                "absolute",

              top: "65px",

              right: "60px",

              background:
                "white",

              padding:
                "12px",

              borderRadius:
                "10px",

              boxShadow:
                "0 2px 8px rgba(0,0,0,0.2)",

              fontFamily:
                "Arial, sans-serif",

              minWidth:
                "190px",

              zIndex: 10,
            }}
          >
            <strong>
              Visual Abstraction
            </strong>

            <label
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap: "8px",

                marginTop:
                  "10px",

                cursor:
                  "pointer",
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
                display:
                  "block",

                marginTop:
                  "10px",
              }}
            >
              Level

              <select
                value={
                  abstractionLevel
                }
                onChange={(event) =>
                  setAbstractionLevel(
                    event.target
                      .value as AbstractionLevel,
                  )
                }
                disabled={
                  !abstractionEnabled
                }
                style={{
                  display:
                    "block",

                  width:
                    "100%",

                  marginTop:
                    "5px",

                  padding:
                    "6px",

                  borderRadius:
                    "6px",

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
          </section>

          {/* OFFLINE SAVED ROUTE */}
          {!online &&
            hasSavedRoute && (
              <button
                onClick={
                  useSavedRoute
                }
                style={{
                  position:
                    "absolute",

                  top: "190px",

                  right: "60px",

                  background:
                    "#2563eb",

                  color:
                    "white",

                  border:
                    "none",

                  padding:
                    "10px 14px",

                  borderRadius:
                    "8px",

                  cursor:
                    "pointer",

                  fontWeight:
                    "bold",

                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.2)",

                  zIndex: 10,
                }}
              >
                Use Saved Route
              </button>
            )}

          {!online &&
            !hasSavedRoute && (
              <div
                style={{
                  position:
                    "absolute",

                  top: "190px",

                  right: "60px",

                  background:
                    "white",

                  padding:
                    "10px 14px",

                  borderRadius:
                    "8px",

                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.2)",

                  fontFamily:
                    "Arial, sans-serif",

                  zIndex: 10,
                }}
              >
                No saved route available
              </div>
            )}

          {/* ROUTE INFORMATION */}
          {routeInfo && (
            <section
              style={{
                position:
                  "absolute",

                top:
                  destinationInfo
                    ? "250px"
                    : "20px",

                left: "20px",

                background:
                  "white",

                padding:
                  "16px",

                borderRadius:
                  "12px",

                boxShadow:
                  "0 4px 16px rgba(0,0,0,0.2)",

                minWidth:
                  "220px",

                maxHeight:
                  "55vh",

                overflowY:
                  "auto",

                fontFamily:
                  "Arial, sans-serif",

                zIndex: 10,
              }}
            >
              <h3
                style={{
                  marginTop:
                    0,
                }}
              >
                Route Information
              </h3>

              <p>
                <strong>
                  Distance:
                </strong>{" "}
                {distanceKm} km
              </p>

              <p>
                <strong>
                  Estimated time:
                </strong>{" "}
                {durationMinutes} min
              </p>

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
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                      }}
                    >
                      <strong>
                        Complexity:
                      </strong>{" "}
                      {routeAIResult.intelligence.routeComplexity}
                    </p>

                    <p
                      style={{
                        margin: "0 0 6px",
                      }}
                    >
                      <strong>
                        Visualization:
                      </strong>{" "}
                      {routeAIResult.intelligence.recommendedVisualization}
                    </p>

                    <p
                      style={{
                        margin: 0,
                        color: "#475569",
                      }}
                    >
                      {routeAIResult.intelligence.reason}
                    </p>
                  </div>
                </>
              )}

              <hr />

              <strong>
                Directions
              </strong>

              <ol>
                {steps.map(
                  (
                    step,
                    index,
                  ) => (
                    <li
                      key={index}
                      style={{
                        marginBottom:
                          "8px",
                      }}
                    >
                      {
                        step
                          .maneuver
                          .type
                      }

                      {step.maneuver
                        .modifier
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

              <strong>
                Navigation
              </strong>

              <div
                style={{
                  marginTop:
                    "10px",

                  display:
                    "flex",

                  gap: "8px",

                  flexWrap:
                    "wrap",
                }}
              >
                {!navigationActive &&
                  !navigationCompleted && (
                    <button
                      onClick={
                        startNavigation
                      }
                      style={{
                        background:
                          "#2563eb",

                        color:
                          "white",

                        border:
                          "none",

                        padding:
                          "8px 12px",

                        borderRadius:
                          "7px",

                        cursor:
                          "pointer",

                        fontWeight:
                          "bold",
                      }}
                    >
                      ▶ Start
                    </button>
                  )}

                {navigationActive && (
                  <button
                    onClick={
                      pauseNavigation
                    }
                    style={{
                      background:
                        "#f59e0b",

                      color:
                        "white",

                      border:
                        "none",

                      padding:
                        "8px 12px",

                      borderRadius:
                        "7px",

                      cursor:
                        "pointer",

                      fontWeight:
                        "bold",
                    }}
                  >
                    ⏸ Pause
                  </button>
                )}

                <button
                  onClick={
                    resetNavigation
                  }
                  style={{
                    background:
                      "#6b7280",

                    color:
                      "white",

                    border:
                      "none",

                    padding:
                      "8px 12px",

                    borderRadius:
                      "7px",

                    cursor:
                      "pointer",

                    fontWeight:
                      "bold",
                  }}
                >
                  🔄 Reset
                </button>
              </div>

              {navigationActive && (
                <p
                  style={{
                    marginBottom:
                      0,

                    color:
                      "#2563eb",

                    fontWeight:
                      "bold",
                  }}
                >
                  🧭 Navigation active
                </p>
              )}

              {navigationCompleted && (
                <p
                  style={{
                    marginBottom:
                      0,

                    color:
                      "#16a34a",

                    fontWeight:
                      "bold",
                  }}
                >
                  🏁 Arrived at destination
                </p>
              )}

              {navigationPosition && (
                <p
                  style={{
                    fontSize:
                      "12px",

                    color:
                      "#555",
                  }}
                >
                  Position:{" "}
                  {navigationPosition[1].toFixed(
                    5,
                  )}
                  ,{" "}
                  {navigationPosition[0].toFixed(
                    5,
                  )}
                </p>
              )}
            </section>
          )}
        </>
      )}

      {/* 3D NAVIGATION CONTROLS */}
      {viewMode === "3D" &&
        routeInfo && (
          <section
            style={{
              position:
                "absolute",

              bottom:
                "25px",

              left:
                "50%",

              transform:
                "translateX(-50%)",

              background:
                "white",

              padding:
                "10px 14px",

              borderRadius:
                "10px",

              boxShadow:
                "0 3px 12px rgba(0,0,0,0.25)",

              fontFamily:
                "Arial, sans-serif",

              zIndex: 10,

              display:
                "flex",

              gap: "8px",

              alignItems:
                "center",
            }}
          >
            {!navigationActive &&
              !navigationCompleted && (
                <button
                  onClick={
                    startNavigation
                  }
                  style={{
                    background:
                      "#2563eb",

                    color:
                      "white",

                    border:
                      "none",

                    padding:
                      "9px 14px",

                    borderRadius:
                      "7px",

                    cursor:
                      "pointer",

                    fontWeight:
                      "bold",
                  }}
                >
                  ▶ Start Navigation
                </button>
              )}

            {navigationActive && (
              <button
                onClick={
                  pauseNavigation
                }
                style={{
                  background:
                    "#f59e0b",

                  color:
                    "white",

                  border:
                    "none",

                  padding:
                    "9px 14px",

                  borderRadius:
                    "7px",

                  cursor:
                    "pointer",

                  fontWeight:
                    "bold",
                }}
              >
                ⏸ Pause
              </button>
            )}

            <button
              onClick={
                resetNavigation
              }
              style={{
                background:
                  "#6b7280",

                color:
                  "white",

                border:
                  "none",

                padding:
                  "9px 14px",

                borderRadius:
                  "7px",

                cursor:
                  "pointer",

                fontWeight:
                  "bold",
              }}
            >
              🔄 Reset
            </button>

            {navigationCompleted && (
              <strong
                style={{
                  color:
                    "#16a34a",
                }}
              >
                🏁 Arrived
              </strong>
            )}
          </section>
        )}
    </main>
  );
}

export default App;