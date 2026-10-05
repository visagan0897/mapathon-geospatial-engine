export type LandmarkType =
  | "airport"
  | "hospital"
  | "school"
  | "university"
  | "park"
  | "government"
  | "hotel"
  | "restaurant"
  | "shop"
  | "place_of_worship"
  | "transport"
  | "sports"
  | "residential"
  | "commercial"
  | "building"
  | "road"
  | "general";

export type DestinationInfo = {
  name: string;
  displayName: string;
  type: string;
  category: string;

  landmarkType: LandmarkType;
  landmarkLabel: string;
  landmarkIcon: string;

  latitude: number;
  longitude: number;
};

type NominatimResponse = {
  display_name?: string;
  name?: string;
  type?: string;
  category?: string;

  lat?: string;
  lon?: string;

  address?: {
    amenity?: string;
    building?: string;

    aeroway?: string;
    airport?: string;

    tourism?: string;
    leisure?: string;

    shop?: string;

    highway?: string;

    railway?: string;
    railway_station?: string;

    public_transport?: string;

    office?: string;

    school?: string;
    university?: string;

    hospital?: string;
    clinic?: string;

    healthcare?: string;

    government?: string;

    sport?: string;

    place_of_worship?: string;

    residential?: string;

    commercial?: string;

    road?: string;

    neighbourhood?: string;
    suburb?: string;

    city?: string;
    town?: string;
    village?: string;
  };
};

type LandmarkClassification = {
  landmarkType: LandmarkType;
  landmarkLabel: string;
  landmarkIcon: string;
};

function classifyLandmark(
  data: NominatimResponse,
): LandmarkClassification {
  const address =
    data.address ?? {};

  const rawType =
    (
      data.type ?? ""
    ).toLowerCase();

  const rawCategory =
    (
      data.category ?? ""
    ).toLowerCase();

  const aeroway =
    (
      address.aeroway ?? ""
    ).toLowerCase();

  const amenity =
    (
      address.amenity ?? ""
    ).toLowerCase();

  const tourism =
    (
      address.tourism ?? ""
    ).toLowerCase();

  const leisure =
    (
      address.leisure ?? ""
    ).toLowerCase();

  const shop =
    (
      address.shop ?? ""
    ).toLowerCase();

  const highway =
    (
      address.highway ?? ""
    ).toLowerCase();

  const railway =
    (
      address.railway ?? ""
    ).toLowerCase();

  const publicTransport =
    (
      address.public_transport ?? ""
    ).toLowerCase();

  const sport =
    (
      address.sport ?? ""
    ).toLowerCase();

  /*
   * Airport
   */
  if (
    aeroway === "aerodrome" ||
    aeroway === "airport" ||
    rawType === "aerodrome" ||
    rawCategory === "aeroway"
  ) {
    return {
      landmarkType:
        "airport",

      landmarkLabel:
        "Airport",

      landmarkIcon:
        "✈️",
    };
  }

  /*
   * Hospital / healthcare
   */
  if (
    amenity === "hospital" ||
    address.hospital ||
    address.healthcare ===
      "hospital" ||
    rawType === "hospital"
  ) {
    return {
      landmarkType:
        "hospital",

      landmarkLabel:
        "Hospital",

      landmarkIcon:
        "🏥",
    };
  }

  /*
   * School
   */
  if (
    amenity === "school" ||
    address.school ||
    rawType === "school"
  ) {
    return {
      landmarkType:
        "school",

      landmarkLabel:
        "School",

      landmarkIcon:
        "🏫",
    };
  }

  /*
   * University / college
   */
  if (
    amenity === "university" ||
    address.university ||
    rawType === "university"
  ) {
    return {
      landmarkType:
        "university",

      landmarkLabel:
        "University / College",

      landmarkIcon:
        "🎓",
    };
  }

  /*
   * Park / recreational green space
   */
  if (
    leisure === "park" ||
    leisure === "garden" ||
    leisure === "nature_reserve" ||
    rawType === "park"
  ) {
    return {
      landmarkType:
        "park",

      landmarkLabel:
        "Park / Green Space",

      landmarkIcon:
        "🌳",
    };
  }

  /*
   * Government / public office
   */
  if (
    address.government ||
    address.office ===
      "government" ||
    amenity ===
      "townhall" ||
    amenity ===
      "courthouse" ||
    rawType === "government"
  ) {
    return {
      landmarkType:
        "government",

      landmarkLabel:
        "Government / Public Office",

      landmarkIcon:
        "🏛️",
    };
  }

  /*
   * Hotel / accommodation
   */
  if (
    tourism === "hotel" ||
    tourism === "motel" ||
    tourism === "guest_house" ||
    rawType === "hotel"
  ) {
    return {
      landmarkType:
        "hotel",

      landmarkLabel:
        "Hotel / Accommodation",

      landmarkIcon:
        "🏨",
    };
  }

  /*
   * Restaurant / food
   */
  if (
    amenity === "restaurant" ||
    amenity === "cafe" ||
    amenity === "fast_food" ||
    amenity === "food_court"
  ) {
    return {
      landmarkType:
        "restaurant",

      landmarkLabel:
        "Restaurant / Food",

      landmarkIcon:
        "🍴",
    };
  }

  /*
   * Shop / retail
   */
  if (
    shop &&
    shop !== "no"
  ) {
    return {
      landmarkType:
        "shop",

      landmarkLabel:
        "Shop / Retail",

      landmarkIcon:
        "🛍️",
    };
  }

  /*
   * Place of worship
   */
  if (
    amenity ===
      "place_of_worship" ||
    address.place_of_worship ||
    rawType ===
      "place_of_worship"
  ) {
    return {
      landmarkType:
        "place_of_worship",

      landmarkLabel:
        "Place of Worship",

      landmarkIcon:
        "🛕",
    };
  }

  /*
   * Railway / public transport
   */
  if (
    railway === "station" ||
    railway === "halt" ||
    railway === "tram_stop" ||
    publicTransport ===
      "station" ||
    rawType === "station"
  ) {
    return {
      landmarkType:
        "transport",

      landmarkLabel:
        "Transport Station",

      landmarkIcon:
        "🚉",
    };
  }

  /*
   * Sports
   */
  if (
    leisure === "sports_centre" ||
    leisure === "stadium" ||
    leisure === "pitch" ||
    sport
  ) {
    return {
      landmarkType:
        "sports",

      landmarkLabel:
        "Sports Facility",

      landmarkIcon:
        "🏟️",
    };
  }

  /*
   * Road
   */
  if (
    highway ||
    rawType === "road"
  ) {
    return {
      landmarkType:
        "road",

      landmarkLabel:
        "Road",

      landmarkIcon:
        "🛣️",
    };
  }

  /*
   * Residential
   */
  if (
    address.residential ||
    rawType === "residential"
  ) {
    return {
      landmarkType:
        "residential",

      landmarkLabel:
        "Residential Area",

      landmarkIcon:
        "🏠",
    };
  }

  /*
   * Commercial
   */
  if (
    address.commercial ||
    rawType === "commercial"
  ) {
    return {
      landmarkType:
        "commercial",

      landmarkLabel:
        "Commercial Area",

      landmarkIcon:
        "🏢",
    };
  }

  /*
   * Generic building
   */
  if (
    address.building ||
    rawType === "building"
  ) {
    return {
      landmarkType:
        "building",

      landmarkLabel:
        "Building",

      landmarkIcon:
        "🏢",
    };
  }

  /*
   * Fallback
   */
  return {
    landmarkType:
      "general",

    landmarkLabel:
      "General Location",

    landmarkIcon:
      "📍",
  };
}

function determineCategory(
  data: NominatimResponse,
): string {
  const address =
    data.address ?? {};

  if (
    address.aeroway
  ) {
    return "Aeroway";
  }

  if (
    address.amenity
  ) {
    return "Amenity";
  }

  if (
    address.healthcare
  ) {
    return "Healthcare";
  }

  if (
    address.leisure
  ) {
    return "Leisure";
  }

  if (
    address.tourism
  ) {
    return "Tourism";
  }

  if (
    address.shop
  ) {
    return "Shop";
  }

  if (
    address.highway
  ) {
    return "Road";
  }

  if (
    address.railway
  ) {
    return "Transport";
  }

  if (
    address.building
  ) {
    return "Building";
  }

  return (
    data.category ??
    data.type ??
    "Location"
  );
}

export async function identifyDestination(
  longitude: number,
  latitude: number,
): Promise<DestinationInfo | null> {
  const url =
    new URL(
      "https://nominatim.openstreetmap.org/reverse",
    );

  url.searchParams.set(
    "format",
    "jsonv2",
  );

  url.searchParams.set(
    "lat",
    latitude.toString(),
  );

  url.searchParams.set(
    "lon",
    longitude.toString(),
  );

  url.searchParams.set(
    "zoom",
    "18",
  );

  url.searchParams.set(
    "addressdetails",
    "1",
  );

  try {
    const response =
      await fetch(
        url.toString(),
      );

    if (!response.ok) {
      throw new Error(
        `Destination lookup failed: ${response.status}`,
      );
    }

    const data:
      NominatimResponse =
      await response.json();

    const name =
      data.name ||
      data.address?.amenity ||
      data.address?.building ||
      data.address?.road ||
      "Selected Location";

    const classification =
      classifyLandmark(
        data,
      );

    return {
      name,

      displayName:
        data.display_name ??
        name,

      type:
        data.type ??
        "location",

      category:
        determineCategory(
          data,
        ),

      landmarkType:
        classification
          .landmarkType,

      landmarkLabel:
        classification
          .landmarkLabel,

      landmarkIcon:
        classification
          .landmarkIcon,

      latitude:
        Number(
          data.lat ??
            latitude,
        ),

      longitude:
        Number(
          data.lon ??
            longitude,
        ),
    };
  } catch (error) {
    console.error(
      "Destination identification failed:",
      error,
    );

    return null;
  }
}