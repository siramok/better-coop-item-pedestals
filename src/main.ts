import {
  changeCollectibleSubType,
  getPlayerIndex,
  getPlayers,
  getRoomIndex,
  isQuestCollectible,
  jsonDecode,
  jsonEncode,
  ModCallbacksCustom,
  PickingUpItem,
  removeAllMatchingEntities,
  runNextFrame,
  setCollectibleBlind,
  upgradeMod,
} from "isaacscript-common";
import { DIFFICULTY_CHALLENGE, TweakType, v } from "./config";
import { rerollActiveToPassive, spawnPedestal } from "./pedestals";
import RoomData from "./types/RoomData";

// Register and upgrade the mod
const mod = RegisterMod("Better Coop Item Pedestals", 1);
const modUpgraded = upgradeMod(mod);

// Register all callbacks
export default function main(): void {
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
  const room = game.GetRoom();
  const roomType = room.GetType();
  if (!v.rooms.has(roomType)) {
    return false;
  }
  const isChallenge = game.Challenge !== Challenge.CHALLENGE_NULL;
  if (isChallenge && !v.modes.has(DIFFICULTY_CHALLENGE)) {
    return false;
  }
  const mode = game.Difficulty;
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
  if (room.IsFirstVisit()) {
    v.roomNumItemsToSpawn = getNumItemsToSpawn(isBossRoom);
    if (v.roomNumItemsToSpawn > 0) {
      if (v.tweaks.has(TweakType.PREVENT_ACTIVES)) {
        const entities = Isaac.FindByType(
          EntityType.ENTITY_PICKUP,
          PickupVariant.PICKUP_COLLECTIBLE,
        );
        for (const entity of entities) {
          rerollActiveToPassive(entity);
        }
      }
    } else {
      v.evaluate = false;
    }
  }
}

// Initializes and populates a RoomData object to track the current room's pedestals
function evaluateRoom() {
  if (!v.evaluate) {
    return;
  }
  const game = Game();
  const room = game.GetRoom();
  const isBossRoom = room.GetType() === RoomType.ROOM_BOSS;
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
      if (v.tweaks.has(TweakType.PREVENT_ACTIVES)) {
        if (newRoomData.getHiddenAt(gridIndex)) {
          const collectible = entity.ToPickup();
          if (collectible !== undefined) {
            setCollectibleBlind(collectible);
          }
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
        roomData.addEntityAt(gridIndex, entity, v.roomNumItemsToSpawn);
      }
    }
    v.floorData.set(v.roomIndex, roomData);
  }
}

// Resets new room variables and handles room evaluation
function evaluateRoomNextFrame() {
  v.evaluate = true;
  v.roomIndex = getRoomIndex();
  v.roomNumItemsToSpawn = 0;
  preEvaluateRoom();
  runNextFrame(() => {
    evaluateRoom();
  });
}

// Handles delayed room evaluation (since boss room pedestals only spawn after the boss is killed)
function preSpawnCleanAward() {
  const game = Game();
  const room = game.GetRoom();
  const roomType = room.GetType();
  if (roomType === RoomType.ROOM_BOSS) {
    v.bossRewardSpawned = true;
    evaluateRoomNextFrame();
  }
}

// Reevaluate all player active items (performed the frame after item use)
function evaluateActivesNextFrame() {
  runNextFrame(() => {
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
    const entityDataMap = roomData.entities;
    const entityDataIterator = entityDataMap.entries();
    for (const [gridIndex, entityData] of entityDataIterator) {
      if (entityData.numToSpawn > 0) {
        spawnPedestal(entityData);
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
      if (item.type === ItemType.ITEM_ACTIVE && playerActive !== 0) {
        v.activeData.set(playerIndex, item.id);
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
        if (item.type === ItemType.ITEM_ACTIVE && playerActive !== 0) {
          v.activeData.set(playerIndex, item.id);
        } else {
          const collectible = entity.ToPickup();
          if (collectible === undefined) {
            return;
          }
          const pool = game.GetItemPool();
          const poolType = pool.GetPoolForRoom(roomType, Random());
          const nextItem = pool.GetCollectible(poolType);
          changeCollectibleSubType(collectible, nextItem);
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
    if (deserialized.get("version") === v.version) {
      v.modes.clear();
      for (const mode of deserialized.get("modes")) {
        v.modes.add(mode);
      }
      v.rooms.clear();
      for (const room of deserialized.get("rooms")) {
        v.rooms.add(room);
      }
      v.tweaks.clear();
      for (const tweak of deserialized.get("tweaks")) {
        v.tweaks.add(tweak);
      }
      const spawnOffset: unknown = deserialized.get("spawnOffset");
      if (typeof spawnOffset === "number") {
        v.spawnOffset = spawnOffset;
      }
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
