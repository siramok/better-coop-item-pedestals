/* eslint-disable no-underscore-dangle */
import EntityData from "./EntityData";

// Represents a collection of persistent entity data at different grid indices for the current room
export default class RoomData {
  private _entities: Map<int, EntityData>;

  constructor() {
    this._entities = new Map();
  }

  get entities(): Map<int, EntityData> {
    return this._entities;
  }

  get size(): int {
    return this._entities.size;
  }

  public addEntityAt(gridIndex: int, entity: Entity, numToSpawn: int): void {
    const entityData = this._entities.get(gridIndex);
    if (entityData === undefined) {
      const newEntityData = new EntityData(entity, numToSpawn);
      this._entities.set(gridIndex, newEntityData);
    }
  }

  public decrementNumToSpawnAt(gridIndex: int): void {
    const entityData = this._entities.get(gridIndex);
    if (entityData !== undefined) {
      entityData.decrementNumToSpawn();
    }
  }

  public entityExistsAt(gridIndex: int): boolean {
    const entityData = this._entities.get(gridIndex);
    return entityData !== undefined;
  }

  public getHiddenAt(gridIndex: int): boolean {
    const entityData = this._entities.get(gridIndex);
    if (entityData !== undefined) {
      return entityData.hidden;
    }
    return false;
  }

  public getNumToSpawnAt(gridIndex: int): int {
    const entityData = this._entities.get(gridIndex);
    if (entityData !== undefined) {
      return entityData.numToSpawn;
    }
    return 0;
  }

  public getVoidedAt(gridIndex: int): boolean {
    const entityData = this._entities.get(gridIndex);
    if (entityData !== undefined) {
      return entityData.voided;
    }
    return false;
  }

  public setVoidedAt(gridIndex: int): void {
    const entityData = this._entities.get(gridIndex);
    if (entityData !== undefined) {
      entityData.voided = true;
      this._entities.set(gridIndex, entityData);
    }
  }
}
