import { getRoomSafeGridIndex, PlayerIndex } from "isaacscript-common";
import RoomData from "./types/RoomData";

export const DIFFICULTY_CHALLENGE = 4;

export enum TweakType {
  "DISABLE_BOSS" = 0,
  "PREVENT_ACTIVES" = 1,
  "SPAWN_IF_DEAD" = 2,
  "VOID_FIX" = 3,
}

// Initialize mod variables
export const v = {
  activeData: new Map<PlayerIndex, CollectibleType>(),
  bossRewardSpawned: false,
  evaluate: true,
  floorData: new Map<int, RoomData>(),
  modes: new Set<Difficulty>(),
  roomIndex: getRoomSafeGridIndex(),
  roomNumItemsToSpawn: 0,
  rooms: new Set<RoomType>(),
  spawnOffset: 0,
  tweaks: new Set<TweakType>(),
  version: "2.0",
};

// Apply default config
v.modes.add(Difficulty.DIFFICULTY_NORMAL);
v.modes.add(Difficulty.DIFFICULTY_HARD);
v.modes.add(Difficulty.DIFFICULTY_GREED);
v.modes.add(Difficulty.DIFFICULTY_GREEDIER);
v.modes.add(DIFFICULTY_CHALLENGE);
v.rooms.add(RoomType.ROOM_TREASURE);
v.rooms.add(RoomType.ROOM_PLANETARIUM);
v.rooms.add(RoomType.ROOM_BOSS);
v.tweaks.add(TweakType.PREVENT_ACTIVES);
v.tweaks.add(TweakType.VOID_FIX);

// Parameterized MCM setting helper
function addMcmSetting(
  section: string,
  key: number,
  description: string,
  info: string,
) {
  if (ModConfigMenu !== undefined) {
    const newSetting: ModConfigMenuSetting = {
      CurrentSetting: (): boolean => {
        if (section === "Modes") {
          return v.modes.has(key);
        }
        if (section === "Rooms") {
          return v.rooms.has(key);
        }
        if (section === "Tweaks") {
          return v.tweaks.has(key);
        }
        return false;
      },
      Display: (): string => {
        let onOff = "Disabled";
        if (section === "Modes") {
          if (v.modes.has(key)) {
            onOff = "Enabled";
          }
        } else if (section === "Rooms") {
          if (v.rooms.has(key)) {
            onOff = "Enabled";
          }
        } else if (section === "Tweaks") {
          if (v.tweaks.has(key)) {
            onOff = "Enabled";
          }
        }
        return `${description}: ${onOff}`;
      },
      Info: [info],
      OnChange: (): void => {
        if (section === "Modes") {
          if (v.modes.has(key)) {
            v.modes.delete(key);
          } else {
            v.modes.add(key);
          }
        } else if (section === "Rooms") {
          if (v.rooms.has(key)) {
            v.rooms.delete(key);
          } else {
            v.rooms.add(key);
          }
        } else if (section === "Tweaks") {
          if (v.tweaks.has(key)) {
            v.tweaks.delete(key);
          } else {
            v.tweaks.add(key);
          }
        }
      },
      Type: ModConfigMenuOptionType.BOOLEAN,
    };
    ModConfigMenu.AddSetting("Better Coop IP", section, newSetting);
  }
}

// Initializes the mod's MCM entry and settings page
if (ModConfigMenu !== undefined) {
  // About tab
  ModConfigMenu.AddSpace("Better Coop IP", "About");
  ModConfigMenu.AddText("Better Coop IP", "About", () => {
    return "Better Coop Item Pedestals";
  });
  ModConfigMenu.AddSpace("Better Coop IP", "About");
  ModConfigMenu.AddText("Better Coop IP", "About", () => {
    return `Version ${v.version}`;
  });
  ModConfigMenu.AddSpace("Better Coop IP", "About");
  ModConfigMenu.AddText("Better Coop IP", "About", () => {
    return "by Siramok";
  });

  // Modes tab
  addMcmSetting("Modes", Difficulty.DIFFICULTY_NORMAL, "Normal mode", "");
  addMcmSetting("Modes", Difficulty.DIFFICULTY_HARD, "Hard mode", "");
  addMcmSetting("Modes", Difficulty.DIFFICULTY_GREED, "Greed mode", "");
  addMcmSetting("Modes", Difficulty.DIFFICULTY_GREEDIER, "Greedier mode", "");
  addMcmSetting("Modes", DIFFICULTY_CHALLENGE, "Challenges", "");

  // Rooms tab
  addMcmSetting("Rooms", RoomType.ROOM_DEFAULT, "Default rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_TREASURE, "Treasure rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_PLANETARIUM, "Planetarium rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_CURSE, "Curse rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_CHALLENGE, "Challenge rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_MINIBOSS, "Miniboss rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_CHEST, "Vault rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_SECRET, "Secret rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_SUPERSECRET, "Super secret rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_ULTRASECRET, "Ultra secret rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_DUNGEON, "Crawlspace rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_ERROR, "I AM ERROR rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_BOSSRUSH, "Boss rush rooms", "");
  addMcmSetting("Rooms", RoomType.ROOM_ANGEL, "Angel rooms", "");

  // Tweaks tab
  ModConfigMenu.AddSetting("Better Coop IP", "Tweaks", {
    CurrentSetting: (): number => {
      return v.spawnOffset;
    },
    Maximum: 8,
    Minimum: -3,
    Display: (): string => {
      return `Item spawn offset: ${v.spawnOffset}`;
    },
    Info: [],
    OnChange: (currentValue: number | boolean | undefined): void => {
      v.spawnOffset = currentValue as number;
    },
    Type: ModConfigMenuOptionType.NUMBER,
  });
  addMcmSetting(
    "Tweaks",
    TweakType.DISABLE_BOSS,
    "Boss rooms only give one item",
    "Removes the boss item pedestal after one item has been taken.",
  );
  addMcmSetting(
    "Tweaks",
    TweakType.SPAWN_IF_DEAD,
    "Spawn items for dead players",
    "Additional items will spawn as if dead players were alive.",
  );
  addMcmSetting(
    "Tweaks",
    TweakType.PREVENT_ACTIVES,
    "Top items are never active items",
    "Morphs active items into random passive items unless there are no additional items to spawn.",
  );
  addMcmSetting(
    "Tweaks",
    TweakType.VOID_FIX,
    "Void/Abyss fix for item pedestals",
    "Prevents Void/Abyss from destroying item pedestals unless there are no additional items to spawn.",
  );
}
