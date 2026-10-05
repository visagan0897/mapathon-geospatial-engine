import * as THREE from "three";

export type DestinationLandmarkData = {
  name: string;
  label: string;
  icon: string;
  position: [number, number];
};

export type DestinationLandmarkClickHandler = (
  data: DestinationLandmarkData,
) => void;

export class DestinationLandmark3D {
  private group: THREE.Group;
  private iconSprite: THREE.Sprite | null = null;
  private labelSprite: THREE.Sprite | null = null;
  private currentData: DestinationLandmarkData | null = null;
  private clickHandler:
    | DestinationLandmarkClickHandler
    | null = null;

  constructor() {
    this.group = new THREE.Group();

    this.group.userData.isDestinationLandmark =
      true;

    this.createLandmarkBase();
  }

  getObject(): THREE.Group {
    return this.group;
  }

  getData(): DestinationLandmarkData | null {
    return this.currentData;
  }

  setPosition(position: THREE.Vector3) {
    this.group.position.copy(position);
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  setInteractionHandler(
    handler:
      | DestinationLandmarkClickHandler
      | null,
  ) {
    this.clickHandler = handler;
  }

  handleInteraction() {
    if (
      !this.currentData ||
      !this.clickHandler
    ) {
      return;
    }

    this.clickHandler(
      this.currentData,
    );
  }

  update(
    data: DestinationLandmarkData,
  ) {
    this.currentData = data;

    this.clearSprites();

    this.createIconSprite(
      data.icon,
    );

    this.createLabelSprite(
      data.label || data.name,
    );

    this.group.visible = true;
  }

  dispose() {
    this.clearSprites();

    this.group.traverse(
      (object) => {
        if (
          object instanceof THREE.Mesh
        ) {
          object.geometry.dispose();

          if (
            Array.isArray(
              object.material,
            )
          ) {
            object.material.forEach(
              (material) => {
                material.dispose();
              },
            );
          } else {
            object.material.dispose();
          }
        }
      },
    );

    this.group.clear();

    this.currentData = null;
    this.clickHandler = null;
  }

  private createLandmarkBase() {
    const baseGeometry =
      new THREE.CylinderGeometry(
        0.55,
        0.7,
        0.18,
        32,
      );

    const baseMaterial =
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.55,
        metalness: 0.1,
      });

    const base =
      new THREE.Mesh(
        baseGeometry,
        baseMaterial,
      );

    base.position.y = 0.09;

    base.userData.isDestinationLandmarkPart =
      true;

    this.group.add(base);

    const poleGeometry =
      new THREE.CylinderGeometry(
        0.07,
        0.07,
        1.2,
        16,
      );

    const poleMaterial =
      new THREE.MeshStandardMaterial({
        color: 0x374151,
        roughness: 0.6,
      });

    const pole =
      new THREE.Mesh(
        poleGeometry,
        poleMaterial,
      );

    pole.position.y = 0.7;

    pole.userData.isDestinationLandmarkPart =
      true;

    this.group.add(pole);
  }

  private createIconSprite(
    icon: string,
  ) {
    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width = 256;
    canvas.height = 256;

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.fillStyle =
      "white";

    context.beginPath();

    context.arc(
      128,
      128,
      100,
      0,
      Math.PI * 2,
    );

    context.fill();

    context.strokeStyle =
      "#dc2626";

    context.lineWidth = 14;

    context.stroke();

    context.textAlign =
      "center";

    context.textBaseline =
      "middle";

    context.font =
      "110px Arial";

    context.fillStyle =
      "#111827";

    context.fillText(
      icon,
      128,
      134,
    );

    const texture =
      new THREE.CanvasTexture(
        canvas,
      );

    texture.needsUpdate = true;

    const material =
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });

    const sprite =
      new THREE.Sprite(
        material,
      );

    sprite.position.y = 2.15;

    sprite.scale.set(
      1.8,
      1.8,
      1,
    );

    sprite.userData.isDestinationLandmarkPart =
      true;

    this.group.add(sprite);

    this.iconSprite = sprite;
  }

  private createLabelSprite(
    label: string,
  ) {
    const canvas =
      document.createElement(
        "canvas",
      );

    canvas.width = 512;
    canvas.height = 128;

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    context.fillStyle =
      "rgba(255,255,255,0.96)";

    this.roundRect(
      context,
      16,
      16,
      480,
      96,
      18,
    );

    context.fill();

    context.strokeStyle =
      "#dc2626";

    context.lineWidth = 6;

    this.roundRect(
      context,
      16,
      16,
      480,
      96,
      18,
    );

    context.stroke();

    context.fillStyle =
      "#111827";

    context.textAlign =
      "center";

    context.textBaseline =
      "middle";

    context.font =
      "bold 34px Arial";

    context.fillText(
      label,
      256,
      64,
    );

    const texture =
      new THREE.CanvasTexture(
        canvas,
      );

    texture.needsUpdate = true;

    const material =
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
      });

    const sprite =
      new THREE.Sprite(
        material,
      );

    sprite.position.y = 3.15;

    sprite.scale.set(
      4.2,
      1.05,
      1,
    );

    sprite.userData.isDestinationLandmarkPart =
      true;

    this.group.add(sprite);

    this.labelSprite = sprite;
  }

  private clearSprites() {
    if (this.iconSprite) {
      this.disposeSprite(
        this.iconSprite,
      );

      this.group.remove(
        this.iconSprite,
      );

      this.iconSprite = null;
    }

    if (this.labelSprite) {
      this.disposeSprite(
        this.labelSprite,
      );

      this.group.remove(
        this.labelSprite,
      );

      this.labelSprite = null;
    }
  }

  private disposeSprite(
    sprite: THREE.Sprite,
  ) {
    const material =
      sprite.material;

    if (material.map) {
      material.map.dispose();
    }

    material.dispose();
  }

  private roundRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    context.beginPath();

    context.moveTo(
      x + radius,
      y,
    );

    context.lineTo(
      x + width - radius,
      y,
    );

    context.quadraticCurveTo(
      x + width,
      y,
      x + width,
      y + radius,
    );

    context.lineTo(
      x + width,
      y + height - radius,
    );

    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );

    context.lineTo(
      x + radius,
      y + height,
    );

    context.quadraticCurveTo(
      x,
      y + height,
      x,
      y + height - radius,
    );

    context.lineTo(
      x,
      y + radius,
    );

    context.quadraticCurveTo(
      x,
      y,
      x + radius,
      y,
    );

    context.closePath();
  }
}