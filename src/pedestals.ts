import {
  changeCollectibleSubType,
  setCollectibleBlind,
} from "isaacscript-common";
import EntityData from "./types/EntityData";

// Rerolls active items to passive items
export function rerollActiveToPassive(entity: Entity): void {
  const collectible = entity.ToPickup();
  if (collectible === undefined) {
    return;
  }
  const itemConfig = Isaac.GetItemConfig();
  let itemConfigItem = itemConfig.GetCollectible(collectible.SubType);
  if (itemConfigItem === undefined) {
    return;
  }
  const game = Game();
  const room = game.GetRoom();
  const roomType = room.GetType();
  const pool = game.GetItemPool();
  const poolType = pool.GetPoolForRoom(roomType, Random());
  while (itemConfigItem.Type === ItemType.ITEM_ACTIVE) {
    const nextItem = pool.GetCollectible(poolType);
    changeCollectibleSubType(collectible, nextItem);
    itemConfigItem = itemConfig.GetCollectible(collectible.SubType);
    if (itemConfigItem === undefined) {
      return;
    }
  }
}

// Spawns a new pedestal from existing entity data
export function spawnPedestal(entityData: EntityData): Entity | undefined {
  const pedestal = Isaac.Spawn(
    EntityType.ENTITY_PICKUP,
    PickupVariant.PICKUP_COLLECTIBLE,
    CollectibleType.COLLECTIBLE_NULL,
    entityData.position,
    Vector.Zero,
    undefined,
  );
  const collectible = pedestal.ToPickup();
  if (collectible === undefined) {
    return undefined;
  }
  if (entityData.hidden) {
    setCollectibleBlind(collectible);
  }
  collectible.OptionsPickupIndex = entityData.option;
  return pedestal;
}
