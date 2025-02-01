import {
  getPlayerIndex,
  getPlayers,
  getRoomGridIndex,
  isQuestCollectible,
  jsonDecode,
  jsonEncode,
  ModCallbacksCustom,
  PickingUpItem,
  removeAllMatchingEntities,
  runNextGameFrame,
  setCollectibleBlind,
  setCollectibleSubType,
  upgradeMod,
} from "isaacscript-common";
import { DIFFICULTY_CHALLENGE, TweakType, v } from "./config";
import { rerollItemIfActive, spawnPedestal } from "./pedestals";
import RoomData from "./types/RoomData";

// Register and upgrade the mod
const mod = RegisterMod("Better Coop Item Pedestals", 1);
const modUpgraded = upgradeMod(mod);

const GREED_TREASURE_ROOM_INDEX = 98;

// Register all callbacks
export function main(): void {
  // Main callbacks
  mod.AddCallback(ModCallbacks.MC_POST_GAME_STARTED, resetRunVariables);
  mod.AddCallback(ModCallbacks.MC_POST_NEW_LEVEL, resetLevelVariables);
  mod.AddCallback(ModCallbacks.MC_POST_NEW_ROOM, evaluateRoomNextFrame);
  mod.AddCallback(ModCallbacks.MC_PRE_SPAWN_CLEAN_AWARD, preSpawnCleanAward);
  mod.AddCallback(ModCallbacks.MC_USE_ITEM, evaluateActivesNextFrame);
  mod.AddCallback(
    ModCallbacks.MC_USE_ITEM,
    handleVoidAbyss,
    CollectibleType.COLLECTIBLE_VOID,
  );
  mod.AddCallback(
    ModCallbacks.MC_USE_ITEM,
    handleVoidAbyss,
    CollectibleType.COLLECTIBLE_ABYSS,
  );
  mod.AddCallback(
    ModCallbacks.MC_USE_ITEM,
    handleDiplopia,
    CollectibleType.COLLECTIBLE_DIPLOPIA,
  );
  modUpgraded.AddCallbackCustom(
    ModCallbacksCustom.MC_PRE_ITEM_PICKUP,
    preItemPickup,
  );

  // Conditional callbacks
  if (ModConfigMenu !== undefined) {
    mod.AddCallback(ModCallbacks.MC_POST_GAME_STARTED, loadSettings);
    mod.AddCallback(ModCallbacks.MC_PRE_GAME_EXIT, saveSettings);
  }
}

// Resets variables upon starting a new run
function resetRunVariables(isContinued: boolean) {
  if (!isContinued) {
    v.activeData = new Map();
  }
}

// Resets variables upon entering a new floor
function resetLevelVariables() {
  v.floorData = new Map();
}

// Validates that the current room and game mode are enabled in the mod settings
function conditionsMet(): boolean {
  const game = Game();
  const level = game.GetLevel();
  const mode = game.Difficulty;
  const room = game.GetRoom();
  const roomType = room.GetType();
  const roomIndex = level.GetCurrentRoomIndex();
  if (!v.rooms.has(roomType)) {
    return false;
  }
  // skip greed treasure room in greed and greedier mode since it spawns an item pedestal per player
  const isGreedMode =
    mode === Difficulty.DIFFICULTY_GREED ||
    mode === Difficulty.DIFFICULTY_GREEDIER;
  if (isGreedMode && roomIndex === GREED_TREASURE_ROOM_INDEX) {
    return false;
  }
  const isChallenge = game.Challenge !== Challenge.CHALLENGE_NULL;
  if (isChallenge && !v.modes.has(DIFFICULTY_CHALLENGE)) {
    return false;
  }
  if (!isChallenge && !v.modes.has(mode)) {
    return false;
  }
  return true;
}

// Calculates the number of additional items to spawn per pedestal in the current room
function getNumItemsToSpawn(isBossRoom: boolean): int {
  const players = getPlayers(true);
  let numItemsToSpawn = players.length - 1;
  if (!isBossRoom) {
    numItemsToSpawn += v.spawnOffset;
  }
  for (const player of players) {
    const playerIndex = getPlayerIndex(player);
    const playerActive = player.GetActiveItem();
    v.activeData.set(playerIndex, playerActive);
    if (player.IsCoopGhost() && !v.tweaks.has(TweakType.SPAWN_IF_DEAD)) {
      numItemsToSpawn -= 1;
    }
  }
  if (numItemsToSpawn < 0) {
    return 0;
  }
  return numItemsToSpawn;
}

// Determines if room evaluation needs to take place, handles initial active item rerolling
function preEvaluateRoom() {
  if (!conditionsMet()) {
    return;
  }
  const game = Game();
  const room = game.GetRoom();
  const roomType = room.GetType();
  const isBossRoom = roomType === RoomType.ROOM_BOSS;
  if (isBossRoom && !v.bossRewardSpawned) {
    v.evaluate = false;
    return;
  }
  v.bossRewardSpawned = false;
  v.roomNumItemsToSpawn = getNumItemsToSpawn(isBossRoom);
  if (v.roomNumItemsToSpawn > 0) {
    if (v.tweaks.has(TweakType.PREVENT_ACTIVES)) {
      const entities = Isaac.FindByType(
        EntityType.ENTITY_PICKUP,
        PickupVariant.PICKUP_COLLECTIBLE,
      );
      for (const entity of entities) {
        if (entity.SubType !== CollectibleType.COLLECTIBLE_NULL) {
          rerollItemIfActive(entity);
        }
      }
    }
  } else {
    v.evaluate = false;
  }
}

// Initializes and populates a RoomData object to track the current room's pedestals
function evaluateRoom() {
  if (!v.evaluate) {
    return;
  }
  const game = Game();
  const room = game.GetRoom();
  const roomType = room.GetType();
  const isBossRoom = roomType === RoomType.ROOM_BOSS;
  const entities = Isaac.FindByType(
    EntityType.ENTITY_PICKUP,
    PickupVariant.PICKUP_COLLECTIBLE,
  );
  const roomData = v.floorData.get(v.roomIndex);
  if (roomData === undefined) {
    const newRoomData = new RoomData();
    for (const entity of entities) {
      if (isQuestCollectible(entity.SubType) && !isBossRoom) {
        return;
      }
      const gridIndex = room.GetClampedGridIndex(entity.Position);
      newRoomData.addEntityAt(gridIndex, entity, v.roomNumItemsToSpawn);
      if (newRoomData.getNumToSpawnAt(gridIndex) > 0) {
        if (isBossRoom && v.tweaks.has(TweakType.PREVENT_ACTIVES)) {
          rerollItemIfActive(entity, newRoomData.getHiddenAt(gridIndex));
        }
      }
    }
    if (newRoomData.size > 0) {
      v.floorData.set(v.roomIndex, newRoomData);
    }
  } else {
    v.roomNumItemsToSpawn = getNumItemsToSpawn(isBossRoom);
    for (const entity of entities) {
      const gridIndex = room.GetClampedGridIndex(entity.Position);
      if (!roomData.entityExistsAt(gridIndex)) {
        if (isQuestCollectible(entity.SubType) && !isBossRoom) {
          return;
        }
        roomData.addEntityAt(gridIndex, entity, v.roomNumItemsToSpawn);
      }
    }
    v.floorData.set(v.roomIndex, roomData);
  }
}

// Resets new room variables and handles room evaluation
function evaluateRoomNextFrame() {
  v.evaluate = true;
  v.roomIndex = getRoomGridIndex();
  v.roomNumItemsToSpawn = 0;
  preEvaluateRoom();
  runNextGameFrame(() => {
    evaluateRoom();
  });
}

// Handles delayed room evaluation (for rooms that spawn pedestals after enemies are cleared)
function preSpawnCleanAward() {
  const roomData = v.floorData.get(v.roomIndex);
  if (roomData === undefined) {
    const game = Game();
    const room = game.GetRoom();
    const roomType = room.GetType();
    if (roomType === RoomType.ROOM_BOSS) {
      v.bossRewardSpawned = true;
    }
    evaluateRoomNextFrame();
  }
}

// Reevaluate all player active items next frame
function evaluateActivesNextFrame() {
  runNextGameFrame(() => {
    const players = getPlayers(true);
    for (const player of players) {
      const playerIndex = getPlayerIndex(player);
      const playerActive = player.GetActiveItem();
      v.activeData.set(playerIndex, playerActive);
    }
  });
}

// Handles the spawning of new pedestals after Void or Abyss is used
function handleVoidAbyss() {
  if (v.tweaks.has(TweakType.VOID_FIX)) {
    const roomData = v.floorData.get(v.roomIndex);
    if (roomData === undefined) {
      return;
    }
    const game = Game();
    const room = game.GetRoom();
    const roomType = room.GetType();
    const isBossRoom = roomType === RoomType.ROOM_BOSS;
    if (isBossRoom && v.tweaks.has(TweakType.DISABLE_BOSS)) {
      return;
    }
    const entities = Isaac.FindByType(
      EntityType.ENTITY_PICKUP,
      PickupVariant.PICKUP_COLLECTIBLE,
    );
    for (const entity of entities) {
      const gridIndex = room.GetClampedGridIndex(entity.Position);
      if (roomData.getNumToSpawnAt(gridIndex) > 0) {
        const entityData = roomData.getEntityDataAt(gridIndex);
        if (entityData === undefined) {
          break;
        }
        const pedestal = spawnPedestal(entityData);
        if (pedestal === undefined) {
          break;
        }
        if (v.tweaks.has(TweakType.PREVENT_ACTIVES)) {
          rerollItemIfActive(pedestal, roomData.getHiddenAt(gridIndex));
        }
        roomData.setVoidedAt(gridIndex);
        roomData.decrementNumToSpawnAt(gridIndex);
      }
    }
    v.floorData.set(v.roomIndex, roomData);
  }
}

// Adds the new pedestals spawned by diplopia to the room's RoomData object
function handleDiplopia() {
  const roomData = v.floorData.get(v.roomIndex);
  if (roomData === undefined) {
    return;
  }
  const game = Game();
  const room = game.GetRoom();
  const entities = Isaac.FindByType(
    EntityType.ENTITY_PICKUP,
    PickupVariant.PICKUP_COLLECTIBLE,
  );
  for (const entity of entities) {
    const gridIndex = room.GetClampedGridIndex(entity.Position);
    if (!roomData.entityExistsAt(gridIndex)) {
      roomData.addEntityAt(gridIndex, entity, 0);
    }
  }
  v.floorData.set(v.roomIndex, roomData);
}

// Handles pedestal replacement/removal, fires upon picking up an item
function preItemPickup(player: EntityPlayer, item: PickingUpItem) {
  const roomData = v.floorData.get(v.roomIndex);
  if (roomData === undefined) {
    return;
  }
  const game = Game();
  const room = game.GetRoom();
  const playerIndex = getPlayerIndex(player);
  const playerActive = v.activeData.get(playerIndex);
  if (playerActive === undefined) {
    return;
  }
  const entities = Isaac.FindByType(
    EntityType.ENTITY_PICKUP,
    PickupVariant.PICKUP_COLLECTIBLE,
  );
  for (const entity of entities) {
    const gridIndex = room.GetClampedGridIndex(entity.Position);
    const roomType = room.GetType();
    if (roomType === RoomType.ROOM_BOSS) {
      if (item.itemType === ItemType.ITEM_ACTIVE && playerActive !== 0) {
        v.activeData.set(playerIndex, item.subType);
      } else {
        if (v.tweaks.has(TweakType.DISABLE_BOSS)) {
          removeAllMatchingEntities(
            EntityType.ENTITY_PICKUP,
            PickupVariant.PICKUP_COLLECTIBLE,
          );
          const emptyRoomData = new RoomData();
          v.floorData.set(v.roomIndex, emptyRoomData);
          return;
        }
        if (roomData.getNumToSpawnAt(gridIndex) > 0) {
          if (v.tweaks.has(TweakType.PREVENT_ACTIVES)) {
            rerollItemIfActive(entity, roomData.getHiddenAt(gridIndex));
          }
          roomData.decrementNumToSpawnAt(gridIndex);
        } else if (roomData.getVoidedAt(gridIndex)) {
          if (entity.SubType !== CollectibleType.COLLECTIBLE_NULL) {
            entity.Remove();
          }
        }
      }
    } else if (roomData.getNumToSpawnAt(gridIndex) > 0) {
      const entitySprite = entity.GetSprite();
      const entityAnimation = entitySprite.GetAnimation();
      if (entityAnimation === CollectibleAnimation.EMPTY) {
        if (item.itemType === ItemType.ITEM_ACTIVE && playerActive !== 0) {
          v.activeData.set(playerIndex, item.subType);
        } else {
          const collectible = entity.ToPickup();
          if (collectible === undefined) {
            return;
          }
          const pool = game.GetItemPool();
          let poolType = pool.GetPoolForRoom(roomType, Random());
          if (poolType === ItemPoolType.POOL_NULL) {
            poolType = ItemPoolType.POOL_TREASURE;
          }
          const nextItem = pool.GetCollectible(poolType);
          setCollectibleSubType(collectible, nextItem);
          if (v.tweaks.has(TweakType.PREVENT_ACTIVES)) {
            rerollItemIfActive(entity, roomData.getHiddenAt(gridIndex));
          } else if (roomData.getHiddenAt(gridIndex)) {
            setCollectibleBlind(collectible);
          }
          const collectibleSprite = collectible.GetSprite();
          collectibleSprite.Play(CollectibleAnimation.IDLE, false);
          roomData.decrementNumToSpawnAt(gridIndex);
        }
        v.floorData.set(v.roomIndex, roomData);
        return;
      }
    }
  }
}

// Decode and apply previous mod settings
function loadSettings() {
  if (mod.HasData()) {
    const serialized = Isaac.LoadModData(mod);
    const deserialized = jsonDecode(serialized);
    const savedVersion = deserialized.get("version") as string;
    if (savedVersion === v.version) {
      const modes = deserialized.get("modes") as Difficulty[];
      v.modes.clear();
      for (const mode of modes) {
        v.modes.add(mode);
      }
      const rooms = deserialized.get("rooms") as RoomType[];
      v.rooms.clear();
      for (const room of rooms) {
        v.rooms.add(room);
      }
      const tweaks = deserialized.get("tweaks") as TweakType[];
      v.tweaks.clear();
      for (const tweak of tweaks) {
        v.tweaks.add(tweak);
      }
      const spawnOffset = deserialized.get("spawnOffset") as number;
      v.spawnOffset = spawnOffset;
    }
  }
}

// Encode and save current mod settings
function saveSettings() {
  const enabledModes = [];
  for (const mode of v.modes.values()) {
    enabledModes.push(mode);
  }
  const enabledRooms = [];
  for (const room of v.rooms.values()) {
    enabledRooms.push(room);
  }
  const enabledTweaks = [];
  for (const tweak of v.tweaks.values()) {
    enabledTweaks.push(tweak);
  }
  const toSerialize = {
    modes: enabledModes,
    rooms: enabledRooms,
    spawnOffset: v.spawnOffset,
    tweaks: enabledTweaks,
    version: v.version,
  };
  mod.SaveData(jsonEncode(toSerialize));
}
