from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

from config import PROJECT_CONFIG


app = FastAPI(
    title=PROJECT_CONFIG["name"],
    version=PROJECT_CONFIG["version"],
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Location(BaseModel):
    longitude: float
    latitude: float


class RouteRequest(BaseModel):
    start: Location
    destination: Location


@app.get("/")
def root():
    return {
        "message": f'{PROJECT_CONFIG["name"]} backend is running',
        "status": "ok",
        "version": PROJECT_CONFIG["version"],
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/route")
async def calculate_route(request: RouteRequest):
    start = request.start
    destination = request.destination

    osrm_url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{start.longitude},{start.latitude};"
        f"{destination.longitude},{destination.latitude}"
    )

    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(osrm_url, params=params)

        response.raise_for_status()
        data = response.json()

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"Routing service error: {error}",
        )

    if data.get("code") != "Ok" or not data.get("routes"):
        raise HTTPException(
            status_code=404,
            detail="No route could be found.",
        )

    route = data["routes"][0]

    return {
        "distance_meters": route["distance"],
        "duration_seconds": route["duration"],
        "geometry": route["geometry"],
        "steps": route.get("legs", []),
    }