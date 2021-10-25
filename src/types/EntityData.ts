/* eslint-disable no-underscore-dangle */
import { isBlindCurseActive, isBlindCurseSprite } from "../blindCurse";

// Represents persistent entity data at a given grid index
export default class EntityData {
  private _hidden = false;
  private _numToSpawn: int;
  private _option: int;
  private _position: Vector;
  private _voided = false;

  constructor(entity: Entity, numToSpawn: int) {
    if (!isBlindCurseActive()) {
      const entitySprite = entity.GetSprite();
      this._hidden = isBlindCurseSprite(entitySprite);
    }
    this._numToSpawn = numToSpawn;
    const collectible = entity.ToPickup();
    if (collectible === undefined) {
      error("EntityData: entity.ToPickup() returned nil.");
    }
    this._option = collectible.OptionsPickupIndex;
    this._position = entity.Position;
  }

  get hidden(): boolean {
    return this._hidden;
  }

  get numToSpawn(): int {
    return this._numToSpawn;
  }

  get option(): int {
    return this._option;
  }

  get position(): Vector {
    return this._position;
  }

  get voided(): boolean {
    return this._voided;
  }

  set voided(value: boolean) {
    this._voided = value;
  }

  public decrementNumToSpawn(): void {
    this._numToSpawn -= 1;
  }
}
