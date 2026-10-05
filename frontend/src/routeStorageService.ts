import type { SavedRoute } from "./routeStorage";

const STORAGE_KEY = "mapathon-saved-route";

export function saveRoute(route: SavedRoute): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(route));
}

export function getSavedRoute(): SavedRoute | null {
  const savedRoute = localStorage.getItem(STORAGE_KEY);

  if (!savedRoute) {
    return null;
  }

  try {
    return JSON.parse(savedRoute) as SavedRoute;
  } catch (error) {
    console.error("Failed to read saved route:", error);
    return null;
  }
}

export function clearSavedRoute(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasSavedRoute(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}