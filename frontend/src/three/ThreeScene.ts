import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  DestinationLandmark3D,
  type DestinationLandmarkData,
} from "./DestinationLandmark3D";

export type RouteCoordinate = [
  longitude: number,
  latitude: number,
];

export class ThreeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver;

  private placeholderGroup: THREE.Group;
  private routeGroup: THREE.Group;
  private navigationArrow: THREE.Group | null = null;
  private destinationLandmark: DestinationLandmark3D;

  private routeOrigin: RouteCoordinate | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private readonly coordinateScale = 0.0025;
  private readonly roadWidth = 6;

  constructor(container: HTMLDivElement) {
    this.scene = new THREE.Scene();

    this.scene.background = new THREE.Color(
      0xf2f2f2,
    );

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth /
        container.clientHeight,
      0.1,
      1000,
    );

    this.camera.position.set(
      0,
      12,
      18,
    );

    this.renderer =
      new THREE.WebGLRenderer({
        antialias: true,
      });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2,
      ),
    );

    this.renderer.setSize(
      container.clientWidth,
      container.clientHeight,
    );

    container.appendChild(
      this.renderer.domElement,
    );

    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.controls =
      new OrbitControls(
        this.camera,
        this.renderer.domElement,
      );

    this.controls.enableDamping = true;

    this.controls.target.set(
      0,
      0,
      0,
    );

    this.controls.maxPolarAngle =
      Math.PI / 2.05;

    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;

    this.placeholderGroup =
      new THREE.Group();

    this.routeGroup =
      new THREE.Group();

    this.destinationLandmark =
      new DestinationLandmark3D();

    this.scene.add(
      this.placeholderGroup,
    );

    this.scene.add(
      this.routeGroup,
    );

    this.scene.add(
      this.destinationLandmark.getObject(),
    );

    this.destinationLandmark.setVisible(
      false,
    );

    this.addLighting();
    this.addGround();
    this.addPlaceholderRoad();
    this.addCurrentLocationMarker();
    this.addDirectionArrow();
    this.createNavigationArrow();

    this.resizeObserver =
      new ResizeObserver(() => {
        this.handleResize(container);
      });

    this.resizeObserver.observe(
      container,
    );

    this.animate();
  }

  private addLighting() {
    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        1.5,
      );

    this.scene.add(
      ambientLight,
    );

    const directionalLight =
      new THREE.DirectionalLight(
        0xffffff,
        2,
      );

    directionalLight.position.set(
      10,
      20,
      10,
    );

    this.scene.add(
      directionalLight,
    );
  }

  private addGround() {
    const groundGeometry =
      new THREE.PlaneGeometry(
        200,
        200,
      );

    const groundMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xdfe7d8,
      });

    const ground =
      new THREE.Mesh(
        groundGeometry,
        groundMaterial,
      );

    ground.rotation.x =
      -Math.PI / 2;

    this.scene.add(
      ground,
    );
  }

  private addPlaceholderRoad() {
    const roadGeometry =
      new THREE.PlaneGeometry(
        8,
        70,
      );

    const roadMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x555555,
      });

    const road =
      new THREE.Mesh(
        roadGeometry,
        roadMaterial,
      );

    road.rotation.x =
      -Math.PI / 2;

    road.position.y = 0.02;

    this.placeholderGroup.add(
      road,
    );

    const centerLineMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
      });

    for (
      let z = -32;
      z <= 32;
      z += 6
    ) {
      const lineGeometry =
        new THREE.PlaneGeometry(
          0.2,
          3,
        );

      const line =
        new THREE.Mesh(
          lineGeometry,
          centerLineMaterial,
        );

      line.rotation.x =
        -Math.PI / 2;

      line.position.set(
        0,
        0.04,
        z,
      );

      this.placeholderGroup.add(
        line,
      );
    }
  }

  private addCurrentLocationMarker() {
    const markerGeometry =
      new THREE.CylinderGeometry(
        0.8,
        0.8,
        0.25,
        32,
      );

    const markerMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
      });

    const marker =
      new THREE.Mesh(
        markerGeometry,
        markerMaterial,
      );

    marker.position.set(
      0,
      0.3,
      25,
    );

    this.placeholderGroup.add(
      marker,
    );

    const coneGeometry =
      new THREE.ConeGeometry(
        0.35,
        0.8,
        4,
      );

    const cone =
      new THREE.Mesh(
        coneGeometry,
        markerMaterial,
      );

    cone.rotation.x =
      Math.PI / 2;

    cone.position.set(
      0,
      0.35,
      24.2,
    );

    this.placeholderGroup.add(
      cone,
    );
  }

  private addDirectionArrow() {
    const arrowMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
      });

    const shaftGeometry =
      new THREE.BoxGeometry(
        0.35,
        0.25,
        3,
      );

    const shaft =
      new THREE.Mesh(
        shaftGeometry,
        arrowMaterial,
      );

    shaft.position.set(
      0,
      0.25,
      15,
    );

    this.placeholderGroup.add(
      shaft,
    );

    const arrowHeadGeometry =
      new THREE.ConeGeometry(
        0.9,
        1.8,
        4,
      );

    const arrowHead =
      new THREE.Mesh(
        arrowHeadGeometry,
        arrowMaterial,
      );

    arrowHead.rotation.x =
      Math.PI / 2;

    arrowHead.position.set(
      0,
      0.25,
      13.2,
    );

    this.placeholderGroup.add(
      arrowHead,
    );
  }

  private createNavigationArrow() {
    const arrow =
      new THREE.Group();

    const material =
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
      });

    const shaftGeometry =
      new THREE.CylinderGeometry(
        0.22,
        0.22,
        2.5,
        16,
      );

    const shaft =
      new THREE.Mesh(
        shaftGeometry,
        material,
      );

    shaft.rotation.x =
      Math.PI / 2;

    shaft.position.z = -0.8;

    arrow.add(
      shaft,
    );

    const headGeometry =
      new THREE.ConeGeometry(
        0.65,
        1.4,
        4,
      );

    const head =
      new THREE.Mesh(
        headGeometry,
        material,
      );

    head.rotation.x =
      Math.PI / 2;

    head.position.z = 0.8;

    arrow.add(
      head,
    );

    arrow.position.y = 0.45;

    arrow.visible = false;

    this.scene.add(
      arrow,
    );

    this.navigationArrow =
      arrow;
  }

  setRoute(
    coordinates: RouteCoordinate[],
  ) {
    this.clearRoute();

    this.routeOrigin =
      coordinates.length > 0
        ? coordinates[0]
        : null;

    if (
      this.navigationArrow
    ) {
      this.navigationArrow.visible =
        false;
    }

    if (
      coordinates.length < 2
    ) {
      this.placeholderGroup.visible =
        true;

      return;
    }

    this.placeholderGroup.visible =
      false;

    const origin =
      coordinates[0];

    const points =
      coordinates.map(
        ([longitude, latitude]) =>
          this.toLocalPosition(
            longitude,
            latitude,
            origin,
          ),
      );

    this.addContinuousRoad(
      points,
    );

    this.addCenterLine(
      points,
    );

    this.addRouteStartMarker(
      points[0],
    );

    this.addDestinationMarker(
      points[
        points.length - 1
      ],
    );

    this.focusCameraOnRoute(
      points,
    );

    this.updateNavigationArrow(
      coordinates[0],
      coordinates[1],
    );
  }

  setDestinationLandmark(
    data: DestinationLandmarkData,
  ) {
    if (!this.routeOrigin) {
      return;
    }

    const localPosition =
      this.toLocalPosition(
        data.position[0],
        data.position[1],
        this.routeOrigin,
      );

    this.destinationLandmark.setPosition(
      localPosition,
    );

    this.destinationLandmark.update(
      data,
    );

    this.destinationLandmark.setVisible(
      true,
    );
  }

  clearDestinationLandmark() {
    this.destinationLandmark.setVisible(
      false,
    );
  }

  setDestinationLandmarkClickHandler(
  handler:
    ((data: DestinationLandmarkData) => void) | null,
) {
  this.destinationLandmark.setInteractionHandler(
    handler,
  );
}

  private handlePointerDown = (
    event: PointerEvent,
  ) => {
    if (
      !this.destinationLandmark.getObject()
        .visible
    ) {
      return;
    }

    const rect =
      this.renderer.domElement.getBoundingClientRect();

    if (
      rect.width === 0 ||
      rect.height === 0
    ) {
      return;
    }

    this.pointer.x =
      ((event.clientX - rect.left) /
        rect.width) *
        2 -
      1;

    this.pointer.y =
      -(
        ((event.clientY - rect.top) /
          rect.height) *
          2 -
        1
      );

    this.raycaster.setFromCamera(
      this.pointer,
      this.camera,
    );

    const intersections =
      this.raycaster.intersectObject(
        this.destinationLandmark.getObject(),
        true,
      );

    if (
      intersections.length === 0
    ) {
      return;
    }

    this.destinationLandmark.handleInteraction();
  };

  updateNavigationCamera(
    position: RouteCoordinate,
    nextPosition?: RouteCoordinate,
  ) {
    if (!this.routeOrigin) {
      return;
    }

    const current =
      this.toLocalPosition(
        position[0],
        position[1],
        this.routeOrigin,
      );

    const target =
      nextPosition
        ? this.toLocalPosition(
            nextPosition[0],
            nextPosition[1],
            this.routeOrigin,
          )
        : current.clone().add(
            new THREE.Vector3(
              0,
              0,
              -10,
            ),
          );

    const direction =
      new THREE.Vector3()
        .subVectors(
          target,
          current,
        );

    direction.y = 0;

    if (
      direction.lengthSq() <
      0.0001
    ) {
      return;
    }

    direction.normalize();

    const cameraDistance = 9;
    const cameraHeight = 5;

    const desiredCameraPosition =
      current
        .clone()
        .sub(
          direction
            .clone()
            .multiplyScalar(
              cameraDistance,
            ),
        );

    desiredCameraPosition.y =
      cameraHeight;

    this.camera.position.lerp(
      desiredCameraPosition,
      0.12,
    );

    const lookTarget =
      current
        .clone()
        .add(
          direction
            .clone()
            .multiplyScalar(8),
        );

    lookTarget.y = 1;

    this.controls.target.lerp(
      lookTarget,
      0.12,
    );

    this.controls.update();
  }

  updateNavigationArrow(
    position: RouteCoordinate,
    nextPosition: RouteCoordinate,
  ) {
    if (
      !this.navigationArrow ||
      !this.routeOrigin
    ) {
      return;
    }

    const current =
      this.toLocalPosition(
        position[0],
        position[1],
        this.routeOrigin,
      );

    const next =
      this.toLocalPosition(
        nextPosition[0],
        nextPosition[1],
        this.routeOrigin,
      );

    const direction =
      new THREE.Vector3()
        .subVectors(
          next,
          current,
        );

    direction.y = 0;

    if (
      direction.lengthSq() <
      0.0001
    ) {
      return;
    }

    direction.normalize();

    this.navigationArrow.position.set(
      current.x,
      0.45,
      current.z,
    );

    this.navigationArrow.rotation.y =
      Math.atan2(
        direction.x,
        direction.z,
      );

    this.navigationArrow.visible =
      true;
  }

  private toLocalPosition(
    longitude: number,
    latitude: number,
    origin: RouteCoordinate,
  ) {
    const longitudeMeters =
      (longitude - origin[0]) *
      111320 *
      Math.cos(
        (origin[1] *
          Math.PI) /
          180,
      );

    const latitudeMeters =
      (latitude - origin[1]) *
      110540;

    return new THREE.Vector3(
      longitudeMeters *
        this.coordinateScale,
      0,
      -latitudeMeters *
        this.coordinateScale,
    );
  }

  private addContinuousRoad(
    points: THREE.Vector3[],
  ) {
    if (points.length < 2) {
      return;
    }

    const leftPoints: THREE.Vector3[] =
      [];

    const rightPoints: THREE.Vector3[] =
      [];

    const halfWidth =
      this.roadWidth / 2;

    for (
      let index = 0;
      index < points.length;
      index += 1
    ) {
      const current =
        points[index];

      const previous =
        points[
          Math.max(
            index - 1,
            0,
          )
        ];

      const next =
        points[
          Math.min(
            index + 1,
            points.length - 1,
          )
        ];

      const tangent =
        new THREE.Vector3()
          .subVectors(
            next,
            previous,
          );

      tangent.y = 0;

      if (
        tangent.lengthSq() === 0
      ) {
        tangent.set(
          0,
          0,
          1,
        );
      }

      tangent.normalize();

      const perpendicular =
        new THREE.Vector3(
          -tangent.z,
          0,
          tangent.x,
        ).normalize();

      const left =
        current
          .clone()
          .add(
            perpendicular
              .clone()
              .multiplyScalar(
                halfWidth,
              ),
          );

      const right =
        current
          .clone()
          .sub(
            perpendicular
              .clone()
              .multiplyScalar(
                halfWidth,
              ),
          );

      left.y = 0.04;
      right.y = 0.04;

      leftPoints.push(left);
      rightPoints.push(right);
    }

    const vertices: number[] =
      [];

    const indices: number[] =
      [];

    for (
      let index = 0;
      index < points.length;
      index += 1
    ) {
      const left =
        leftPoints[index];

      const right =
        rightPoints[index];

      vertices.push(
        left.x,
        left.y,
        left.z,

        right.x,
        right.y,
        right.z,
      );
    }

    for (
      let index = 0;
      index <
      points.length - 1;
      index += 1
    ) {
      const current =
        index * 2;

      const next =
        (index + 1) * 2;

      indices.push(
        current,
        next,
        current + 1,

        current + 1,
        next,
        next + 1,
      );
    }

    const geometry =
      new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        vertices,
        3,
      ),
    );

    geometry.setIndex(
      indices,
    );

    geometry.computeVertexNormals();

    const material =
      new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });

    const road =
      new THREE.Mesh(
        geometry,
        material,
      );

    this.routeGroup.add(
      road,
    );
  }

  private addCenterLine(
    points: THREE.Vector3[],
  ) {
    if (points.length < 2) {
      return;
    }

    const linePoints: THREE.Vector3[] =
      [];

    for (
      let index = 0;
      index < points.length;
      index += 3
    ) {
      linePoints.push(
        points[index]
          .clone()
          .setY(0.09),
      );
    }

    const lastPoint =
      points[
        points.length - 1
      ]
        .clone()
        .setY(0.09);

    if (
      linePoints.length === 0 ||
      linePoints[
        linePoints.length - 1
      ].distanceTo(lastPoint) >
        0.01
    ) {
      linePoints.push(
        lastPoint,
      );
    }

    const geometry =
      new THREE.BufferGeometry()
        .setFromPoints(
          linePoints,
        );

    const material =
      new THREE.LineBasicMaterial({
        color: 0xffffff,
      });

    const centerLine =
      new THREE.Line(
        geometry,
        material,
      );

    this.routeGroup.add(
      centerLine,
    );
  }

  private addRouteStartMarker(
    position: THREE.Vector3,
  ) {
    const geometry =
      new THREE.CylinderGeometry(
        0.7,
        0.7,
        0.3,
        24,
      );

    const material =
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
      });

    const marker =
      new THREE.Mesh(
        geometry,
        material,
      );

    marker.position.set(
      position.x,
      0.35,
      position.z,
    );

    this.routeGroup.add(
      marker,
    );
  }

  private addDestinationMarker(
    position: THREE.Vector3,
  ) {
    const poleGeometry =
      new THREE.CylinderGeometry(
        0.12,
        0.12,
        2.5,
        16,
      );

    const poleMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x333333,
      });

    const pole =
      new THREE.Mesh(
        poleGeometry,
        poleMaterial,
      );

    pole.position.set(
      position.x,
      1.25,
      position.z,
    );

    this.routeGroup.add(
      pole,
    );

    const markerGeometry =
      new THREE.SphereGeometry(
        0.65,
        24,
        24,
      );

    const markerMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
      });

    const marker =
      new THREE.Mesh(
        markerGeometry,
        markerMaterial,
      );

    marker.position.set(
      position.x,
      2.7,
      position.z,
    );

    this.routeGroup.add(
      marker,
    );
  }

  private focusCameraOnRoute(
    points: THREE.Vector3[],
  ) {
    const box =
      new THREE.Box3();

    for (
      const point of points
    ) {
      box.expandByPoint(
        point,
      );
    }

    const center =
      box.getCenter(
        new THREE.Vector3(),
      );

    const size =
      box.getSize(
        new THREE.Vector3(),
      );

    const maxDimension =
      Math.max(
        size.x,
        size.z,
        10,
      );

    const cameraDistance =
      Math.max(
        maxDimension * 1.1,
        18,
      );

    this.camera.position.set(
      center.x,
      cameraDistance * 0.65,
      center.z +
        cameraDistance,
    );

    this.controls.target.copy(
      center,
    );

    this.controls.update();
  }

  private clearRoute() {
    for (
      const object of
      this.routeGroup.children
    ) {
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
            (material) =>
              material.dispose(),
          );
        } else {
          object.material.dispose();
        }
      }

      if (
        object instanceof
        THREE.Line
      ) {
        object.geometry.dispose();

        if (
          Array.isArray(
            object.material,
          )
        ) {
          object.material.forEach(
            (material) =>
              material.dispose(),
          );
        } else {
          object.material.dispose();
        }
      }
    }

    this.routeGroup.clear();

    this.destinationLandmark.setVisible(
      false,
    );
  }

  private handleResize(
    container: HTMLDivElement,
  ) {
    const width =
      container.clientWidth;

    const height =
      container.clientHeight;

    if (
      width === 0 ||
      height === 0
    ) {
      return;
    }

    this.camera.aspect =
      width / height;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      width,
      height,
    );
  }

  private animate = () => {
    this.animationFrameId =
      requestAnimationFrame(
        this.animate,
      );

    this.controls.update();

    this.renderer.render(
      this.scene,
      this.camera,
    );
  };

  dispose() {
    if (
      this.animationFrameId !==
      null
    ) {
      cancelAnimationFrame(
        this.animationFrameId,
      );

      this.animationFrameId =
        null;
    }

    this.resizeObserver.disconnect();

    this.controls.dispose();

    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
    );

    this.destinationLandmark.dispose();

    this.renderer.dispose();

    this.scene.traverse(
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
              (material) =>
                material.dispose(),
            );
          } else {
            object.material.dispose();
          }
        }

        if (
          object instanceof
          THREE.Line
        ) {
          object.geometry.dispose();

          if (
            Array.isArray(
              object.material,
            )
          ) {
            object.material.forEach(
              (material) =>
                material.dispose(),
            );
          } else {
            object.material.dispose();
          }
        }
      },
    );
  }
}