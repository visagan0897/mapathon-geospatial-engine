import * as THREE from "three";
import type { LandmarkType } from "../landmarkService";

export type LandmarkModel = {
  group: THREE.Group;
  setPosition: (
    position: THREE.Vector3,
  ) => void;
  dispose: () => void;
};

function createBox(
  width: number,
  height: number,
  depth: number,
  y: number,
): THREE.Mesh {
  const geometry =
    new THREE.BoxGeometry(
      width,
      height,
      depth,
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.position.y = y;

  return mesh;
}

function createCylinder(
  radius: number,
  height: number,
  y: number,
): THREE.Mesh {
  const geometry =
    new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      24,
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.position.y = y;

  return mesh;
}

function createCone(
  radius: number,
  height: number,
  y: number,
): THREE.Mesh {
  const geometry =
    new THREE.ConeGeometry(
      radius,
      height,
      24,
    );

  const material =
    new THREE.MeshStandardMaterial({
      color: 0x2563eb,
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.position.y = y;

  return mesh;
}

function createAirportModel(
  group: THREE.Group,
) {
  const building =
    createBox(
      3.2,
      1.2,
      2.2,
      0.6,
    );

  group.add(
    building,
  );

  const tower =
    createBox(
      0.5,
      2.5,
      0.5,
      1.85,
    );

  group.add(
    tower,
  );

  const roof =
    createCone(
      1.4,
      0.8,
      1.6,
    );

  roof.rotation.y =
    Math.PI / 4;

  group.add(
    roof,
  );

  const runway =
    createBox(
      5.5,
      0.08,
      0.7,
      0.04,
    );

  group.add(
    runway,
  );
}

function createHospitalModel(
  group: THREE.Group,
) {
  const building =
    createBox(
      3,
      2,
      2,
      1,
    );

  group.add(
    building,
  );

  const crossVertical =
    createBox(
      0.45,
      1.2,
      0.12,
      2.2,
    );

  const crossHorizontal =
    createBox(
      1.2,
      0.45,
      0.12,
      2.2,
    );

  crossVertical.position.z =
    -1.08;

  crossHorizontal.position.z =
    -1.08;

  group.add(
    crossVertical,
    crossHorizontal,
  );
}

function createSchoolModel(
  group: THREE.Group,
) {
  const building =
    createBox(
      3.2,
      1.8,
      2,
      0.9,
    );

  group.add(
    building,
  );

  const roof =
    createCone(
      2.2,
      1,
      2.3,
    );

  roof.rotation.y =
    Math.PI / 4;

  group.add(
    roof,
  );

  const flagPole =
    createCylinder(
      0.06,
      2.2,
      2.9,
    );

  group.add(
    flagPole,
  );
}

function createParkModel(
  group: THREE.Group,
) {
  const ground =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        2.8,
        2.8,
        0.15,
        32,
      ),

      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
      }),
    );

  ground.position.y =
    0.075;

  group.add(
    ground,
  );

  const treePositions = [
    [-1.4, 1.2],
    [1.3, 1.1],
    [0, -1.1],
  ];

  for (
    const [
      x,
      z,
    ] of treePositions
  ) {
    const trunk =
      createCylinder(
        0.18,
        1.2,
        0.6,
      );

    trunk.position.x =
      x;

    trunk.position.z =
      z;

    trunk.material =
      new THREE.MeshStandardMaterial({
        color: 0x92400e,
      });

    const leaves =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          0.75,
          16,
          16,
        ),

        new THREE.MeshStandardMaterial({
          color: 0x16a34a,
        }),
      );

    leaves.position.set(
      x,
      1.45,
      z,
    );

    group.add(
      trunk,
      leaves,
    );
  }
}

function createHotelModel(
  group: THREE.Group,
) {
  const building =
    createBox(
      2.5,
      3.5,
      2,
      1.75,
    );

  group.add(
    building,
  );

  const roof =
    createBox(
      2.8,
      0.2,
      2.3,
      3.55,
    );

  group.add(
    roof,
  );
}

function createRestaurantModel(
  group: THREE.Group,
) {
  const building =
    createBox(
      2.6,
      1.5,
      2,
      0.75,
    );

  group.add(
    building,
  );

  const roof =
    createCone(
      1.8,
      0.8,
      1.9,
    );

  roof.rotation.y =
    Math.PI / 4;

  group.add(
    roof,
  );
}

function createGenericModel(
  group: THREE.Group,
) {
  const base =
    createCylinder(
      0.9,
      0.3,
      0.15,
    );

  group.add(
    base,
  );

  const tower =
    createCylinder(
      0.35,
      2,
      1.15,
    );

  group.add(
    tower,
  );

  const top =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.55,
        20,
        20,
      ),

      new THREE.MeshStandardMaterial({
        color: 0xef4444,
      }),
    );

  top.position.y =
    2.35;

  group.add(
    top,
  );
}

export function createLandmarkModel(
  type: LandmarkType,
): LandmarkModel {
  const group =
    new THREE.Group();

  group.name =
    `destination-landmark-${type}`;

  switch (type) {
    case "airport":
      createAirportModel(
        group,
      );
      break;

    case "hospital":
      createHospitalModel(
        group,
      );
      break;

    case "school":
      createSchoolModel(
        group,
      );
      break;

    case "university":
      createSchoolModel(
        group,
      );
      break;

    case "park":
      createParkModel(
        group,
      );
      break;

    case "hotel":
      createHotelModel(
        group,
      );
      break;

    case "restaurant":
      createRestaurantModel(
        group,
      );
      break;

    case "government":
    case "commercial":
    case "residential":
    case "building":
    case "shop":
    case "transport":
    case "sports":
    case "place_of_worship":
    case "road":
    case "general":
    default:
      createGenericModel(
        group,
      );
      break;
  }

  group.scale.set(
    1,
    1,
    1,
  );

  return {
    group,

    setPosition(
      position: THREE.Vector3,
    ) {
      group.position.copy(
        position,
      );
    },

    dispose() {
      group.traverse(
        (object) => {
          if (
            object instanceof
            THREE.Mesh
          ) {
            object.geometry.dispose();

            if (
              Array.isArray(
                object.material,
              )
            ) {
              object.material.forEach(
                (
                  material,
                ) => {
                  material.dispose();
                },
              );
            } else {
              object.material.dispose();
            }
          }
        },
      );
    },
  };
}