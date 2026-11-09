import JSZip from 'jszip';

export enum WorldAchievementStatus {
  BlockedRed = 'BLOCKED_RED',
  ExperimentalYellow = 'EXPERIMENTAL_YELLOW',
  ActiveGreen = 'ACTIVE_GREEN',
}

export interface NbtTagDiagnostic {
  key: string;
  category:
    | 'achievement'
    | 'experiment'
    | 'template'
    | 'gamemode'
    | 'gamerule'
    | 'worldinfo';
  tagType: 'TAG_Byte' | 'TAG_Int' | 'TAG_Long' | 'TAG_Float' | 'TAG_String';
  currentValue: number | string;
  targetValue: number | string;
  offset: number;
  isBlocking: boolean;
}

export interface BedrockWorldEntry {
  id: string;
  selected: boolean;
  worldName: string;
  nbtLevelName: string;
  levelNameTxt: string | null;
  folderName: string;
  sourceType: 'folder' | 'mcworld' | 'zip' | 'leveldat' | 'sample';
  lastModified: number;
  storageVersion: number;
  payloadSize: number;
  status: WorldAchievementStatus;
  gameType: number; // 0 = Survival, 1 = Creative, 2 = Adventure
  difficulty: number; // 0 = Peaceful, 1 = Easy, 2 = Normal, 3 = Hard
  isHardcore: boolean;
  keepInventory: boolean;
  showCoordinates: boolean;
  showDaysPlayed: boolean;
  doFireTick: boolean;
  tntExplodes: boolean;
  mobGriefing: boolean;
  doDaylightCycle: boolean;
  doWeatherCycle: boolean;
  pvp: boolean;
  doImmediateRespawn: boolean;
  naturalRegeneration: boolean;
  randomTickSpeed: number;
  spawnRadius: number;
  playersSleepingPercentage: number;
  daysPlayed: number;
  worldTime: number; // 0..23999 time of day ticks
  totalWorldTicks: string;
  rainLevel: number;
  lightningLevel: number;
  randomSeed: string;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
  hasBeenLoadedInCreative: boolean;
  commandsEnabled: boolean;
  cheatsEnabled: boolean;
  commandblockoutput: boolean;
  commandblocksacEnabled: boolean;
  forceGameType: boolean;
  activeExperimentFlags: string[];
  activeTemplateLockFlags: string[];
  diagnostics: NbtTagDiagnostic[];
  levelDatBytes: Uint8Array;
  backupLevelDatBytes: Uint8Array | null;
  archiveOriginalBytes?: Uint8Array;
  archiveLevelDatInternalPath?: string;
  directoryHandle?: any;
  patchHistoryCount: number;
  lastPatchedAt?: number;
}

export interface PatchOptions {
  reactivateAchievements: boolean;
  disableExperiments: boolean;
  unlockTemplates: boolean;
  disableHardcoreLock: boolean;
  enableHardcoreMode?: boolean; // Official Bedrock 1.21+ Hardcore (IsHardcore = 1, Difficulty = 3, GameType = 0)
  enableKeepInventorySafe: boolean;
  enableShowCoordinatesSafe: boolean;
  enableShowDaysPlayedSafe: boolean;
  disableFireSpreadSafe: boolean;
  clearWeatherAndSetDay: boolean;
  onePlayerSleepSafe: boolean;
  createAutoBackup: boolean;
  bonusDaysToAdd: number; // e.g., 0, 100, 365, 1000
}

export interface WorldCustomEdits {
  newWorldName?: string;
  newRandomSeed?: string;
  spawnX?: number;
  spawnY?: number;
  spawnZ?: number;
  daysPlayed?: number;
  worldTime?: number;
  clearWeather?: boolean;
  gameType?: number;
  difficulty?: number;
  isHardcore?: boolean;
  keepInventory?: boolean;
  showCoordinates?: boolean;
  showDaysPlayed?: boolean;
  doFireTick?: boolean;
  tntExplodes?: boolean;
  mobGriefing?: boolean;
  doDaylightCycle?: boolean;
  doWeatherCycle?: boolean;
  pvp?: boolean;
  doImmediateRespawn?: boolean;
  naturalRegeneration?: boolean;
  randomTickSpeed?: number;
  spawnRadius?: number;
  playersSleepingPercentage?: number;
}

export const ACHIEVEMENT_ZERO_KEYS = [
  'hasBeenLoadedInCreative',
  'commandsEnabled',
  'cheatsEnabled',
  'commandblockoutput',
  'commandblocksacEnabled',
  'ForceGameType',
] as const;

export const EXPERIMENT_ZERO_KEYS = [
  'experiments_ever_used',
  'saved_with_toggled_experiments',
  'gametest',
  'data_driven_items',
  'data_driven_biomes',
  'upcoming_creator_features',
  'experimental_molang_features',
  'cameras',
  'villager_trades_rebalance',
  'updateAnnouncedLive2023',
] as const;

export const TEMPLATE_LOCK_ZERO_KEYS = [
  'hasLockedBehaviorPack',
  'hasLockedResourcePack',
  'isFromLockedTemplate',
  'isFromWorldTemplate',
  'isWorldTemplateOptionLocked',
] as const;

export const SAFE_GAMERULE_KEYS = [
  'keepinventory',
  'showcoordinates',
  'showdaysplayed',
  'dofiretick',
  'tntexplodes',
  'mobgriefing',
  'dodaylightcycle',
  'doweathercycle',
  'pvp',
  'doimmediaterespawn',
  'naturalregeneration',
] as const;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

/**
 * Calculates real-world survival playtime based on Minecraft Bedrock ticks (1 day = 24000 ticks = 20 real minutes).
 */
export function calculateRealPlaytime(daysPlayed: number): {
  totalMinutes: number;
  hours: number;
  minutes: number;
  text: string;
} {
  const totalMinutes = Math.max(0, Math.round(daysPlayed * 20));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let text = '';
  if (hours > 0) {
    text = `${hours}h ${minutes}m de sobrevivência real`;
  } else {
    text = `${minutes} min de sobrevivência real`;
  }
  return { totalMinutes, hours, minutes, text };
}

/**
 * Returns milestone progress for survival & hardcore world challenges.
 */
export function getSurvivalMilestone(daysPlayed: number): {
  nextMilestone: number;
  prevMilestone: number;
  percent: number;
  rankTitle: string;
  badge: string;
} {
  const milestones = [
    { target: 100, rank: 'Sobrevivente dos 100 Dias', badge: '🥉 100 Dias' },
    { target: 500, rank: 'Mestre da Sobrevivência (500 Dias)', badge: '🥈 500 Dias' },
    { target: 1000, rank: 'Lenda do Hardcore Titan (1.000 Dias)', badge: '🥇 1.000 Dias' },
    { target: 2500, rank: 'Imperador Bedrock Imortal (2.500 Dias)', badge: '👑 2.500 Dias' },
    { target: 5000, rank: 'Divindade Suprema Bedrock (5.000 Dias)', badge: '⭐ 5.000 Dias' },
  ];

  let prevMilestone = 0;
  for (const m of milestones) {
    if (daysPlayed < m.target) {
      const span = m.target - prevMilestone;
      const progress = Math.max(0, daysPlayed - prevMilestone);
      const percent = Math.min(100, Math.round((progress / span) * 100));
      return {
        nextMilestone: m.target,
        prevMilestone,
        percent,
        rankTitle: m.rank,
        badge: m.badge,
      };
    }
    prevMilestone = m.target;
  }

  return {
    nextMilestone: 10000,
    prevMilestone: 5000,
    percent: 100,
    rankTitle: 'Divindade Absoluta Bedrock',
    badge: '👑 Mestre Supremo',
  };
}

/**
 * Finds Little-Endian NBT tag offsets inside a Bedrock level.dat buffer:
 * [tagType: 1 byte] [nameLength: uint16 LE] [name UTF-8 bytes] [value...]
 * Supports case-insensitive ASCII comparison so variants like "commandsenabled" vs "commandsEnabled"
 * or "hasbeenloadedincreative" vs "hasBeenLoadedInCreative" are always discovered.
 */
function findNbtTagOffsets(
  data: Uint8Array,
  tagType: number | number[],
  tagName: string
): number[] {
  const nameBytes = textEncoder.encode(tagName);
  const nLen = nameBytes.length;
  const lo = nLen & 0xff;
  const hi = (nLen >> 8) & 0xff;
  const offsets: number[] = [];
  const allowedTypes = Array.isArray(tagType) ? tagType : [tagType];

  const startOffset = data.length >= 8 ? 8 : 0;
  const limit = data.length - nLen - 3;

  for (let i = startOffset; i < limit; i++) {
    if (allowedTypes.includes(data[i]) && data[i + 1] === lo && data[i + 2] === hi) {
      let match = true;
      for (let k = 0; k < nLen; k++) {
        const b1 = data[i + 3 + k];
        const b2 = nameBytes[k];
        const c1 = b1 >= 65 && b1 <= 90 ? b1 + 32 : b1;
        const c2 = b2 >= 65 && b2 <= 90 ? b2 + 32 : b2;
        if (c1 !== c2) {
          match = false;
          break;
        }
      }
      if (match) {
        offsets.push(i + 3 + nLen);
      }
    }
  }
  return offsets;
}

export function extractNbtString(
  data: Uint8Array,
  tagName: string
): { value: string; offset: number } | null {
  const valueOffsets = findNbtTagOffsets(data, 8, tagName);
  for (const valOffset of valueOffsets) {
    if (valOffset + 2 <= data.length) {
      const strLen = data[valOffset] | (data[valOffset + 1] << 8);
      if (valOffset + 2 + strLen <= data.length) {
        return {
          value: textDecoder.decode(
            data.subarray(valOffset + 2, valOffset + 2 + strLen)
          ),
          offset: valOffset,
        };
      }
    }
  }
  return null;
}

export function extractNbtByte(
  data: Uint8Array,
  tagName: string
): { value: number; offset: number } | null {
  const valueOffsets = findNbtTagOffsets(data, [1, 3], tagName);
  if (valueOffsets.length > 0) {
    const off = valueOffsets[0];
    if (off < data.length) {
      return { value: data[off], offset: off };
    }
  }
  return null;
}

export function extractNbtInt(
  data: Uint8Array,
  tagName: string
): { value: number; offset: number } | null {
  const valueOffsets = findNbtTagOffsets(data, [3, 1], tagName);
  if (valueOffsets.length > 0) {
    const off = valueOffsets[0];
    if (off + 4 <= data.length) {
      const view = new DataView(data.buffer, data.byteOffset + off, 4);
      return { value: view.getInt32(0, true), offset: off };
    } else if (off < data.length) {
      return { value: data[off], offset: off };
    }
  }
  return null;
}

export function extractNbtLongString(
  data: Uint8Array,
  tagName: string
): { value: string; offset: number } | null {
  const valueOffsets = findNbtTagOffsets(data, [4, 3], tagName);
  if (valueOffsets.length > 0) {
    const off = valueOffsets[0];
    if (off + 8 <= data.length) {
      const view = new DataView(data.buffer, data.byteOffset + off, 8);
      const bigVal = view.getBigInt64(0, true);
      return { value: bigVal.toString(), offset: off };
    } else if (off + 4 <= data.length) {
      const view = new DataView(data.buffer, data.byteOffset + off, 4);
      return { value: view.getInt32(0, true).toString(), offset: off };
    }
  }
  return null;
}

export function extractNbtFloat(
  data: Uint8Array,
  tagName: string
): { value: number; offset: number } | null {
  // TAG_Float = 5
  const valueOffsets = findNbtTagOffsets(data, 5, tagName);
  if (valueOffsets.length > 0) {
    const off = valueOffsets[0];
    if (off + 4 <= data.length) {
      const view = new DataView(data.buffer, data.byteOffset + off, 4);
      return {
        value: Number(view.getFloat32(0, true).toFixed(2)),
        offset: off,
      };
    }
  }
  return null;
}

/**
 * Replaces the string value of an existing TAG_String (e.g. "LevelName") inside level.dat,
 * resizing the Uint8Array and updating the 8-byte Little-Endian header payload size.
 */
export function replaceNbtStringTag(
  data: Uint8Array,
  tagName: string,
  newValue: string
): Uint8Array {
  const valueOffsets = findNbtTagOffsets(data, 8, tagName);
  if (valueOffsets.length === 0) return data;

  const valOffset = valueOffsets[0];
  if (valOffset + 2 > data.length) return data;

  const oldStrLen = data[valOffset] | (data[valOffset + 1] << 8);
  if (valOffset + 2 + oldStrLen > data.length) return data;

  const newStrBytes = textEncoder.encode(newValue);
  const newStrLen = Math.min(newStrBytes.length, 32767);
  const delta = newStrLen - oldStrLen;

  const nextBuf = new Uint8Array(data.length + delta);
  nextBuf.set(data.subarray(0, valOffset), 0);
  nextBuf[valOffset] = newStrLen & 0xff;
  nextBuf[valOffset + 1] = (newStrLen >> 8) & 0xff;
  nextBuf.set(newStrBytes.subarray(0, newStrLen), valOffset + 2);
  nextBuf.set(
    data.subarray(valOffset + 2 + oldStrLen),
    valOffset + 2 + newStrLen
  );

  if (nextBuf.length >= 8) {
    const hdrView = new DataView(nextBuf.buffer, nextBuf.byteOffset, 8);
    hdrView.setInt32(4, nextBuf.length - 8, true);
  }
  return nextBuf;
}

/**
 * Inspects a binary Bedrock level.dat buffer (Little-Endian) and returns full diagnostic state.
 */
export function inspectLevelDatBuffer(
  rawBytes: Uint8Array,
  options: {
    id?: string;
    folderName: string;
    levelNameTxt?: string | null;
    sourceType: BedrockWorldEntry['sourceType'];
    lastModified?: number;
    backupBytes?: Uint8Array | null;
    archiveOriginalBytes?: Uint8Array;
    archiveLevelDatInternalPath?: string;
    directoryHandle?: any;
    patchHistoryCount?: number;
    lastPatchedAt?: number;
  }
): BedrockWorldEntry {
  const data = new Uint8Array(rawBytes);
  let storageVersion = 10;
  let payloadSize = Math.max(0, data.length - 8);

  if (data.length >= 8) {
    const hdrView = new DataView(data.buffer, data.byteOffset, 8);
    storageVersion = hdrView.getInt32(0, true);
    payloadSize = hdrView.getInt32(4, true);
  }

  const nbtLevelNameHit = extractNbtString(data, 'LevelName');
  const nbtLevelName = nbtLevelNameHit
    ? nbtLevelNameHit.value
    : options.folderName;
  const cleanTxtName = options.levelNameTxt?.trim() || null;
  const worldName = cleanTxtName || nbtLevelName || options.folderName;

  const diagnostics: NbtTagDiagnostic[] = [];

  if (nbtLevelNameHit) {
    diagnostics.push({
      key: 'LevelName',
      category: 'worldinfo',
      tagType: 'TAG_String',
      currentValue: nbtLevelName,
      targetValue: nbtLevelName,
      offset: nbtLevelNameHit.offset,
      isBlocking: false,
    });
  }

  // Read RandomSeed (TAG_Long = 4)
  const seedHit = extractNbtLongString(data, 'RandomSeed');
  const randomSeed = seedHit ? seedHit.value : '0';
  if (seedHit) {
    diagnostics.push({
      key: 'RandomSeed',
      category: 'worldinfo',
      tagType: 'TAG_Long',
      currentValue: randomSeed,
      targetValue: randomSeed,
      offset: seedHit.offset,
      isBlocking: false,
    });
  }

  // Read Spawn Coordinates
  const spawnXHit = extractNbtInt(data, 'SpawnX');
  const spawnYHit = extractNbtInt(data, 'SpawnY');
  const spawnZHit = extractNbtInt(data, 'SpawnZ');
  const spawnX = spawnXHit ? spawnXHit.value : 0;
  const spawnY = spawnYHit ? spawnYHit.value : 64;
  const spawnZ = spawnZHit ? spawnZHit.value : 0;

  if (spawnXHit) {
    diagnostics.push({
      key: 'SpawnX',
      category: 'worldinfo',
      tagType: 'TAG_Int',
      currentValue: spawnX,
      targetValue: spawnX,
      offset: spawnXHit.offset,
      isBlocking: false,
    });
  }
  if (spawnYHit) {
    diagnostics.push({
      key: 'SpawnY',
      category: 'worldinfo',
      tagType: 'TAG_Int',
      currentValue: spawnY,
      targetValue: spawnY,
      offset: spawnYHit.offset,
      isBlocking: false,
    });
  }
  if (spawnZHit) {
    diagnostics.push({
      key: 'SpawnZ',
      category: 'worldinfo',
      tagType: 'TAG_Int',
      currentValue: spawnZ,
      targetValue: spawnZ,
      offset: spawnZHit.offset,
      isBlocking: false,
    });
  }

  // Read Time & currentTick -> calculate Days Played (Math.floor(Time / 24000)) and Time of Day (Time % 24000)
  const timeLongHit = extractNbtLongString(data, 'Time');
  const timeIntHit = !timeLongHit ? extractNbtInt(data, 'Time') : null;
  const currentTickHit = extractNbtLongString(data, 'currentTick');

  let rawTotalTicksBig = 6000n;
  if (timeLongHit) {
    rawTotalTicksBig = BigInt(timeLongHit.value);
  } else if (timeIntHit) {
    rawTotalTicksBig = BigInt(timeIntHit.value);
  } else if (currentTickHit) {
    rawTotalTicksBig = BigInt(currentTickHit.value);
  }
  if (rawTotalTicksBig < 0n) rawTotalTicksBig = 0n;

  const daysPlayed = Number(rawTotalTicksBig / 24000n);
  const worldTime = Number(rawTotalTicksBig % 24000n);
  const totalWorldTicks = rawTotalTicksBig.toString();

  if (timeLongHit || timeIntHit) {
    diagnostics.push({
      key: 'Time (Dias + Horário)',
      category: 'worldinfo',
      tagType: timeLongHit ? 'TAG_Long' : 'TAG_Int',
      currentValue: `${totalWorldTicks} ticks (${daysPlayed} dias)`,
      targetValue: `${totalWorldTicks} ticks`,
      offset: timeLongHit ? timeLongHit.offset : timeIntHit!.offset,
      isBlocking: false,
    });
  }

  const rainHit = extractNbtFloat(data, 'rainLevel');
  const lightningHit = extractNbtFloat(data, 'lightningLevel');
  const rainLevel = rainHit ? rainHit.value : 0;
  const lightningLevel = lightningHit ? lightningHit.value : 0;

  // Read GameType (TAG_Int = 3)
  const gameTypeHit = extractNbtInt(data, 'GameType');
  const gameType = gameTypeHit ? gameTypeHit.value : 0;
  if (gameTypeHit) {
    diagnostics.push({
      key: 'GameType',
      category: 'gamemode',
      tagType: 'TAG_Int',
      currentValue: gameType,
      targetValue: 0,
      offset: gameTypeHit.offset,
      isBlocking: gameType === 1,
    });
  }

  // Read Difficulty (TAG_Int = 3)
  const diffHit = extractNbtInt(data, 'Difficulty');
  const difficulty = diffHit ? diffHit.value : 2;
  if (diffHit) {
    diagnostics.push({
      key: 'Difficulty',
      category: 'worldinfo',
      tagType: 'TAG_Int',
      currentValue: difficulty,
      targetValue: difficulty,
      offset: diffHit.offset,
      isBlocking: false,
    });
  }

  // Read IsHardcore (TAG_Byte = 1)
  const hardcoreHit = extractNbtByte(data, 'IsHardcore');
  const isHardcore = hardcoreHit ? hardcoreHit.value !== 0 : false;
  if (hardcoreHit) {
    diagnostics.push({
      key: 'IsHardcore',
      category: 'gamemode',
      tagType: 'TAG_Byte',
      currentValue: hardcoreHit.value,
      targetValue: 0,
      offset: hardcoreHit.offset,
      isBlocking: false,
    });
  }

  // Read Boolean Safe Gamerules
  const readBoolRule = (key: string, defaultVal: boolean): boolean => {
    const hit = extractNbtByte(data, key);
    if (hit) {
      diagnostics.push({
        key,
        category: 'gamerule',
        tagType: 'TAG_Byte',
        currentValue: hit.value,
        targetValue: hit.value,
        offset: hit.offset,
        isBlocking: false,
      });
      return hit.value !== 0;
    }
    return defaultVal;
  };

  const keepInventory = readBoolRule('keepinventory', false);
  const showCoordinates = readBoolRule('showcoordinates', true);
  const showDaysPlayed = readBoolRule('showdaysplayed', true);
  const doFireTick = readBoolRule('dofiretick', true);
  const tntExplodes = readBoolRule('tntexplodes', true);
  const mobGriefing = readBoolRule('mobgriefing', true);
  const doDaylightCycle = readBoolRule('dodaylightcycle', true);
  const doWeatherCycle = readBoolRule('doweathercycle', true);
  const pvp = readBoolRule('pvp', true);
  const doImmediateRespawn = readBoolRule('doimmediaterespawn', false);
  const naturalRegeneration = readBoolRule('naturalregeneration', true);

  // Read Integer Safe Gamerules
  const readIntRule = (key: string, defaultVal: number): number => {
    const hit = extractNbtInt(data, key);
    if (hit) {
      diagnostics.push({
        key,
        category: 'gamerule',
        tagType: 'TAG_Int',
        currentValue: hit.value,
        targetValue: hit.value,
        offset: hit.offset,
        isBlocking: false,
      });
      return hit.value;
    }
    return defaultVal;
  };

  const randomTickSpeed = readIntRule('randomtickspeed', 1);
  const spawnRadius = readIntRule('spawnradius', 5);
  const playersSleepingPercentage = readIntRule(
    'playerssleepingpercentage',
    100
  );

  // Read Achievement keys
  const achMap: Record<string, boolean> = {};
  for (const key of ACHIEVEMENT_ZERO_KEYS) {
    const byteHit = extractNbtByte(data, key);
    const intHit = !byteHit ? extractNbtInt(data, key) : null;
    const val = byteHit ? byteHit.value : intHit ? intHit.value : 0;
    const offset = byteHit ? byteHit.offset : intHit ? intHit.offset : -1;
    achMap[key] = val !== 0;

    if (offset !== -1) {
      diagnostics.push({
        key,
        category: 'achievement',
        tagType: byteHit ? 'TAG_Byte' : 'TAG_Int',
        currentValue: val,
        targetValue: 0,
        offset,
        isBlocking: val !== 0,
      });
    }
  }

  // Read Experiment keys
  const activeExperimentFlags: string[] = [];
  for (const key of EXPERIMENT_ZERO_KEYS) {
    const byteHit = extractNbtByte(data, key);
    if (byteHit) {
      if (byteHit.value !== 0) {
        activeExperimentFlags.push(key);
      }
      diagnostics.push({
        key,
        category: 'experiment',
        tagType: 'TAG_Byte',
        currentValue: byteHit.value,
        targetValue: 0,
        offset: byteHit.offset,
        isBlocking: byteHit.value !== 0,
      });
    }
  }

  // Read Template / Marketplace lock keys
  const activeTemplateLockFlags: string[] = [];
  for (const key of TEMPLATE_LOCK_ZERO_KEYS) {
    const byteHit = extractNbtByte(data, key);
    if (byteHit) {
      if (byteHit.value !== 0) {
        activeTemplateLockFlags.push(key);
      }
      diagnostics.push({
        key,
        category: 'template',
        tagType: 'TAG_Byte',
        currentValue: byteHit.value,
        targetValue: 0,
        offset: byteHit.offset,
        isBlocking: byteHit.value !== 0,
      });
    }
  }

  const hasBeenLoadedInCreative = Boolean(achMap['hasBeenLoadedInCreative']);
  const commandsEnabled = Boolean(achMap['commandsEnabled']);
  const cheatsEnabled = Boolean(achMap['cheatsEnabled']);
  const commandblockoutput = Boolean(achMap['commandblockoutput']);
  const commandblocksacEnabled = Boolean(achMap['commandblocksacEnabled']);
  const forceGameType = Boolean(achMap['ForceGameType']);

  const isBlockedRed =
    hasBeenLoadedInCreative ||
    commandsEnabled ||
    cheatsEnabled ||
    gameType === 1 ||
    forceGameType ||
    activeTemplateLockFlags.length > 0;

  let status: WorldAchievementStatus = WorldAchievementStatus.ActiveGreen;
  if (isBlockedRed) {
    status = WorldAchievementStatus.BlockedRed;
  } else if (activeExperimentFlags.length > 0) {
    status = WorldAchievementStatus.ExperimentalYellow;
  }

  return {
    id:
      options.id ||
      `world_${options.folderName}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,
    selected: status !== WorldAchievementStatus.ActiveGreen,
    worldName,
    nbtLevelName,
    levelNameTxt: cleanTxtName,
    folderName: options.folderName,
    sourceType: options.sourceType,
    lastModified: options.lastModified || Date.now(),
    storageVersion,
    payloadSize,
    status,
    gameType,
    difficulty,
    isHardcore,
    keepInventory,
    showCoordinates,
    showDaysPlayed,
    doFireTick,
    tntExplodes,
    mobGriefing,
    doDaylightCycle,
    doWeatherCycle,
    pvp,
    doImmediateRespawn,
    naturalRegeneration,
    randomTickSpeed,
    spawnRadius,
    playersSleepingPercentage,
    daysPlayed,
    worldTime,
    totalWorldTicks,
    rainLevel,
    lightningLevel,
    randomSeed,
    spawnX,
    spawnY,
    spawnZ,
    hasBeenLoadedInCreative,
    commandsEnabled,
    cheatsEnabled,
    commandblockoutput,
    commandblocksacEnabled,
    forceGameType,
    activeExperimentFlags,
    activeTemplateLockFlags,
    diagnostics,
    levelDatBytes: data,
    backupLevelDatBytes: options.backupBytes ?? null,
    archiveOriginalBytes: options.archiveOriginalBytes,
    archiveLevelDatInternalPath: options.archiveLevelDatInternalPath,
    directoryHandle: options.directoryHandle,
    patchHistoryCount: options.patchHistoryCount ?? 0,
    lastPatchedAt: options.lastPatchedAt,
  };
}

/**
 * Patches a Bedrock level.dat Uint8Array according to PatchOptions and optional WorldCustomEdits.
 */
export function patchLevelDatBuffer(
  originalBytes: Uint8Array,
  options: PatchOptions,
  customEdits?: WorldCustomEdits
): {
  patchedBytes: Uint8Array;
  modifiedFlagsCount: number;
  modifiedKeys: string[];
} {
  let buffer = new Uint8Array(originalBytes);
  let modifiedFlagsCount = 0;
  const modifiedKeys: string[] = [];

  if (customEdits?.newWorldName && customEdits.newWorldName.trim().length > 0) {
    const trimmed = customEdits.newWorldName.trim();
    const curName = extractNbtString(buffer, 'LevelName');
    if (!curName || curName.value !== trimmed) {
      buffer = new Uint8Array(
        replaceNbtStringTag(buffer, 'LevelName', trimmed)
      );
      modifiedFlagsCount++;
      modifiedKeys.push(`LevelName → "${trimmed}"`);
    }
  }

  const setByteTagValue = (key: string, targetByte: number) => {
    const byteOffsets = findNbtTagOffsets(buffer, 1, key);
    for (const off of byteOffsets) {
      if (off < buffer.length && buffer[off] !== targetByte) {
        buffer[off] = targetByte;
        modifiedFlagsCount++;
        if (!modifiedKeys.includes(key)) modifiedKeys.push(key);
      }
    }
  };

  const setIntTagValue = (key: string, targetInt: number) => {
    const intOffsets = findNbtTagOffsets(buffer, 3, key);
    for (const off of intOffsets) {
      if (off + 4 <= buffer.length) {
        const view = new DataView(buffer.buffer, buffer.byteOffset + off, 4);
        if (view.getInt32(0, true) !== targetInt) {
          view.setInt32(0, targetInt, true);
          modifiedFlagsCount++;
          if (!modifiedKeys.includes(key)) modifiedKeys.push(key);
        }
      }
    }
  };

  const setLongTagValue = (key: string, targetBigInt: bigint) => {
    const longOffsets = findNbtTagOffsets(buffer, 4, key);
    for (const off of longOffsets) {
      if (off + 8 <= buffer.length) {
        const view = new DataView(buffer.buffer, buffer.byteOffset + off, 8);
        if (view.getBigInt64(0, true) !== targetBigInt) {
          view.setBigInt64(0, targetBigInt, true);
          modifiedFlagsCount++;
          if (!modifiedKeys.includes(key)) modifiedKeys.push(key);
        }
      }
    }
  };

  const setFloatTagValue = (key: string, targetFloat: number) => {
    const floatOffsets = findNbtTagOffsets(buffer, 5, key);
    for (const off of floatOffsets) {
      if (off + 4 <= buffer.length) {
        const view = new DataView(buffer.buffer, buffer.byteOffset + off, 4);
        if (Math.abs(view.getFloat32(0, true) - targetFloat) > 0.001) {
          view.setFloat32(0, targetFloat, true);
          modifiedFlagsCount++;
          if (!modifiedKeys.includes(key)) modifiedKeys.push(key);
        }
      }
    }
  };

  const zeroKeyInBuffer = (key: string) => {
    setByteTagValue(key, 0);
    setIntTagValue(key, 0);
  };

  // Extract current total ticks so we can accurately calculate Days Played + Time of Day
  const curTimeLong = extractNbtLongString(buffer, 'Time');
  const curTimeInt = !curTimeLong ? extractNbtInt(buffer, 'Time') : null;
  let currentTotalTicks = curTimeLong
    ? BigInt(curTimeLong.value)
    : curTimeInt
    ? BigInt(curTimeInt.value)
    : 6000n;
  if (currentTotalTicks < 0n) currentTotalTicks = 0n;

  let targetDays = Number(currentTotalTicks / 24000n);
  let targetTimeOfDay = Number(currentTotalTicks % 24000n);
  let shouldUpdateTicks = false;

  if (options.reactivateAchievements) {
    for (const key of ACHIEVEMENT_ZERO_KEYS) {
      zeroKeyInBuffer(key);
    }
    if (customEdits?.gameType === undefined) {
      const gtOffsets = findNbtTagOffsets(buffer, 3, 'GameType');
      for (const off of gtOffsets) {
        if (off + 4 <= buffer.length) {
          const view = new DataView(buffer.buffer, buffer.byteOffset + off, 4);
          const currentGt = view.getInt32(0, true);
          if (currentGt === 1) {
            view.setInt32(0, 0, true);
            modifiedFlagsCount++;
            if (!modifiedKeys.includes('GameType'))
              modifiedKeys.push('GameType (1 → 0)');
          }
        }
      }
    }
  }

  if (options.disableExperiments) {
    for (const key of EXPERIMENT_ZERO_KEYS) {
      zeroKeyInBuffer(key);
    }
  }

  if (options.unlockTemplates) {
    for (const key of TEMPLATE_LOCK_ZERO_KEYS) {
      zeroKeyInBuffer(key);
    }
  }

  if (options.enableHardcoreMode) {
    // Official Bedrock 1.21+ Hardcore: IsHardcore = 1, Difficulty = 3 (Hard), GameType = 0 (Survival)
    setByteTagValue('IsHardcore', 1);
    setIntTagValue('Difficulty', 3);
    setIntTagValue('GameType', 0);
    for (const key of ACHIEVEMENT_ZERO_KEYS) {
      zeroKeyInBuffer(key);
    }
    if (!modifiedKeys.includes('IsHardcore = 1 (Modo Hardcore Oficial)')) {
      modifiedKeys.push('IsHardcore = 1 (Modo Hardcore Oficial)');
    }
  } else if (options.disableHardcoreLock) {
    zeroKeyInBuffer('IsHardcore');
    // If player died in Hardcore and is stuck in Spectator (GameType = 6), revive to Survival (GameType = 0)
    const curGt = extractNbtInt(buffer, 'GameType');
    if (curGt && curGt.value === 6 && customEdits?.gameType === undefined) {
      setIntTagValue('GameType', 0);
      if (!modifiedKeys.includes('GameType (6 → 0 Reviver do Espectador)')) {
        modifiedKeys.push('GameType (6 → 0 Reviver do Espectador)');
      }
    }
  }

  if (options.enableKeepInventorySafe) {
    setByteTagValue('keepinventory', 1);
  }

  if (options.enableShowCoordinatesSafe) {
    setByteTagValue('showcoordinates', 1);
  }

  if (options.enableShowDaysPlayedSafe) {
    setByteTagValue('showdaysplayed', 1);
  }

  if (options.disableFireSpreadSafe) {
    setByteTagValue('dofiretick', 0);
  }

  if (options.onePlayerSleepSafe) {
    setIntTagValue('playerssleepingpercentage', 1);
  }

  if (options.clearWeatherAndSetDay) {
    setFloatTagValue('rainLevel', 0);
    setFloatTagValue('lightningLevel', 0);
    targetTimeOfDay = 6000;
    shouldUpdateTicks = true;
  }

  if (options.bonusDaysToAdd > 0 && customEdits?.daysPlayed === undefined) {
    targetDays += options.bonusDaysToAdd;
    shouldUpdateTicks = true;
  }

  // Apply explicit custom edits from the Inspector Modal if provided
  if (customEdits) {
    if (customEdits.newRandomSeed !== undefined) {
      try {
        const parsedSeed = BigInt(customEdits.newRandomSeed.trim());
        setLongTagValue('RandomSeed', parsedSeed);
      } catch {
        // Ignore invalid bigint string
      }
    }
    if (customEdits.spawnX !== undefined && !Number.isNaN(customEdits.spawnX)) {
      setIntTagValue('SpawnX', customEdits.spawnX);
    }
    if (customEdits.spawnY !== undefined && !Number.isNaN(customEdits.spawnY)) {
      setIntTagValue('SpawnY', customEdits.spawnY);
    }
    if (customEdits.spawnZ !== undefined && !Number.isNaN(customEdits.spawnZ)) {
      setIntTagValue('SpawnZ', customEdits.spawnZ);
    }
    if (
      customEdits.daysPlayed !== undefined &&
      !Number.isNaN(customEdits.daysPlayed)
    ) {
      targetDays = Math.max(0, Math.floor(customEdits.daysPlayed));
      shouldUpdateTicks = true;
    }
    if (
      customEdits.worldTime !== undefined &&
      !Number.isNaN(customEdits.worldTime)
    ) {
      targetTimeOfDay =
        ((Math.floor(customEdits.worldTime) % 24000) + 24000) % 24000;
      shouldUpdateTicks = true;
    }
    if (customEdits.clearWeather) {
      setFloatTagValue('rainLevel', 0);
      setFloatTagValue('lightningLevel', 0);
    }
    if (customEdits.gameType !== undefined) {
      setIntTagValue('GameType', customEdits.gameType);
    }
    if (customEdits.difficulty !== undefined) {
      setIntTagValue('Difficulty', customEdits.difficulty);
    }
    if (customEdits.isHardcore !== undefined) {
      setByteTagValue('IsHardcore', customEdits.isHardcore ? 1 : 0);
      if (customEdits.isHardcore) {
        setIntTagValue('Difficulty', 3);
        if (customEdits.gameType === undefined) {
          setIntTagValue('GameType', 0);
        }
      } else {
        const curGt = extractNbtInt(buffer, 'GameType');
        if (curGt && curGt.value === 6 && customEdits.gameType === undefined) {
          setIntTagValue('GameType', 0);
        }
      }
    }
    if (customEdits.keepInventory !== undefined) {
      setByteTagValue('keepinventory', customEdits.keepInventory ? 1 : 0);
    }
    if (customEdits.showCoordinates !== undefined) {
      setByteTagValue('showcoordinates', customEdits.showCoordinates ? 1 : 0);
    }
    if (customEdits.showDaysPlayed !== undefined) {
      setByteTagValue('showdaysplayed', customEdits.showDaysPlayed ? 1 : 0);
    }
    if (customEdits.doFireTick !== undefined) {
      setByteTagValue('dofiretick', customEdits.doFireTick ? 1 : 0);
    }
    if (customEdits.tntExplodes !== undefined) {
      setByteTagValue('tntexplodes', customEdits.tntExplodes ? 1 : 0);
    }
    if (customEdits.mobGriefing !== undefined) {
      setByteTagValue('mobgriefing', customEdits.mobGriefing ? 1 : 0);
    }
    if (customEdits.doDaylightCycle !== undefined) {
      setByteTagValue('dodaylightcycle', customEdits.doDaylightCycle ? 1 : 0);
    }
    if (customEdits.doWeatherCycle !== undefined) {
      setByteTagValue('doweathercycle', customEdits.doWeatherCycle ? 1 : 0);
    }
    if (customEdits.pvp !== undefined) {
      setByteTagValue('pvp', customEdits.pvp ? 1 : 0);
    }
    if (customEdits.doImmediateRespawn !== undefined) {
      setByteTagValue(
        'doimmediaterespawn',
        customEdits.doImmediateRespawn ? 1 : 0
      );
    }
    if (customEdits.naturalRegeneration !== undefined) {
      setByteTagValue(
        'naturalregeneration',
        customEdits.naturalRegeneration ? 1 : 0
      );
    }
    if (
      customEdits.randomTickSpeed !== undefined &&
      !Number.isNaN(customEdits.randomTickSpeed)
    ) {
      setIntTagValue(
        'randomtickspeed',
        Math.max(0, Math.min(4096, Math.floor(customEdits.randomTickSpeed)))
      );
    }
    if (
      customEdits.spawnRadius !== undefined &&
      !Number.isNaN(customEdits.spawnRadius)
    ) {
      setIntTagValue(
        'spawnradius',
        Math.max(0, Math.min(128, Math.floor(customEdits.spawnRadius)))
      );
    }
    if (
      customEdits.playersSleepingPercentage !== undefined &&
      !Number.isNaN(customEdits.playersSleepingPercentage)
    ) {
      setIntTagValue(
        'playerssleepingpercentage',
        Math.max(
          0,
          Math.min(100, Math.floor(customEdits.playersSleepingPercentage))
        )
      );
    }
  }

  if (shouldUpdateTicks) {
    const newTotalTicks =
      BigInt(Math.max(0, targetDays)) * 24000n + BigInt(targetTimeOfDay);
    setLongTagValue('Time', newTotalTicks);
    setIntTagValue('Time', Number(newTotalTicks));
    setLongTagValue('currentTick', newTotalTicks);
  }

  // Ensure the 8-byte Little-Endian header payload size is synced
  if (buffer.length >= 8) {
    const hdrView = new DataView(buffer.buffer, buffer.byteOffset, 8);
    hdrView.setInt32(4, buffer.length - 8, true);
  }

  return {
    patchedBytes: buffer,
    modifiedFlagsCount,
    modifiedKeys,
  };
}

/**
 * Clones a BedrockWorldEntry with a new clean name, new folder hash, and achievements unlocked.
 */
export function cloneCleanBedrockWorld(
  source: BedrockWorldEntry,
  options: PatchOptions
): BedrockWorldEntry {
  const cloneName = `${source.worldName} [Cópia Limpa]`;
  const { patchedBytes } = patchLevelDatBuffer(source.levelDatBytes, options, {
    newWorldName: cloneName,
  });
  const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const cloneFolder = `${source.folderName.replace(/=+$/, '')}_CLONE_${randSuffix}=`;

  const cloned = inspectLevelDatBuffer(patchedBytes, {
    id: `clone_${Date.now()}_${randSuffix}`,
    folderName: cloneFolder,
    levelNameTxt: cloneName,
    sourceType: source.sourceType,
    lastModified: Date.now(),
    backupBytes: new Uint8Array(source.levelDatBytes),
  });
  cloned.selected = false;
  return cloned;
}

/**
 * Repackages a .mcworld or .zip archive with the newly patched level.dat bytes.
 */
export async function repackageArchiveWithPatchedLevelDat(
  world: BedrockWorldEntry
): Promise<Blob> {
  if (world.archiveOriginalBytes && world.archiveLevelDatInternalPath) {
    const zip = await JSZip.loadAsync(world.archiveOriginalBytes);
    zip.file(world.archiveLevelDatInternalPath, world.levelDatBytes);
    if (world.backupLevelDatBytes) {
      zip.file(
        `${world.archiveLevelDatInternalPath}.bak`,
        world.backupLevelDatBytes
      );
    }
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  const zip = new JSZip();
  zip.file('level.dat', world.levelDatBytes);
  zip.file('levelname.txt', world.worldName);
  if (world.backupLevelDatBytes) {
    zip.file('level.dat.bak', world.backupLevelDatBytes);
  }
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Packages multiple worlds into a single Master Backup & Patched ZIP archive.
 */
export async function buildBatchWorldsZip(
  worlds: BedrockWorldEntry[]
): Promise<Blob> {
  const zip = new JSZip();
  for (const w of worlds) {
    const safeFolder = w.folderName.replace(/[^a-zA-Z0-9_=-]/g, '_');
    const folder = zip.folder(safeFolder);
    if (folder) {
      folder.file('level.dat', w.levelDatBytes);
      folder.file('levelname.txt', w.worldName);
      if (w.backupLevelDatBytes) {
        folder.file('level.dat.bak', w.backupLevelDatBytes);
      }
    }
  }
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Builds a genuine binary Bedrock Little-Endian level.dat buffer for demo/testing or custom worlds.
 */
export function buildBinaryBedrockLevelDat(config: {
  levelName: string;
  gameType: number;
  difficulty?: number;
  isHardcore?: number;
  keepinventory?: number;
  showcoordinates?: number;
  showdaysplayed?: number;
  dofiretick?: number;
  tntexplodes?: number;
  mobgriefing?: number;
  dodaylightcycle?: number;
  doweathercycle?: number;
  pvp?: number;
  doimmediaterespawn?: number;
  naturalregeneration?: number;
  randomtickspeed?: number;
  spawnradius?: number;
  playerssleepingpercentage?: number;
  daysPlayed?: number;
  worldTime?: bigint;
  rainLevel?: number;
  lightningLevel?: number;
  randomSeed?: bigint;
  spawnX?: number;
  spawnY?: number;
  spawnZ?: number;
  hasBeenLoadedInCreative: number;
  commandsEnabled: number;
  cheatsEnabled: number;
  commandblockoutput?: number;
  commandblocksacEnabled?: number;
  ForceGameType?: number;
  experiments?: Partial<Record<typeof EXPERIMENT_ZERO_KEYS[number], number>>;
  templateLocks?: Partial<
    Record<typeof TEMPLATE_LOCK_ZERO_KEYS[number], number>
  >;
}): Uint8Array {
  const chunks: number[] = [];

  const pushByte = (b: number) => chunks.push(b & 0xff);
  const pushUInt16LE = (v: number) => {
    chunks.push(v & 0xff, (v >> 8) & 0xff);
  };
  const pushInt32LE = (v: number) => {
    chunks.push(
      v & 0xff,
      (v >> 8) & 0xff,
      (v >> 16) & 0xff,
      (v >> 24) & 0xff
    );
  };
  const pushInt64LE = (v: bigint) => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setBigInt64(0, v, true);
    const u8 = new Uint8Array(buf);
    for (const b of u8) chunks.push(b);
  };
  const pushFloat32LE = (v: number) => {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setFloat32(0, v, true);
    const u8 = new Uint8Array(buf);
    for (const b of u8) chunks.push(b);
  };
  const pushString = (s: string) => {
    const bytes = textEncoder.encode(s);
    pushUInt16LE(bytes.length);
    for (const b of bytes) chunks.push(b);
  };

  const writeTagByte = (name: string, val: number) => {
    pushByte(1); // TAG_Byte
    pushString(name);
    pushByte(val);
  };

  const writeTagInt = (name: string, val: number) => {
    pushByte(3); // TAG_Int
    pushString(name);
    pushInt32LE(val);
  };

  const writeTagLong = (name: string, val: bigint) => {
    pushByte(4); // TAG_Long
    pushString(name);
    pushInt64LE(val);
  };

  const writeTagFloat = (name: string, val: number) => {
    pushByte(5); // TAG_Float
    pushString(name);
    pushFloat32LE(val);
  };

  const writeTagString = (name: string, val: string) => {
    pushByte(8); // TAG_String
    pushString(name);
    pushString(val);
  };

  const daysBig = BigInt(Math.max(0, config.daysPlayed ?? 0));
  const timeOfDayBig = (config.worldTime ?? 6000n) % 24000n;
  const totalTicksBig = daysBig * 24000n + timeOfDayBig;

  // Root Compound Tag (TAG_Compound = 10, empty name "")
  pushByte(10);
  pushString('');

  writeTagString('LevelName', config.levelName);
  writeTagLong('RandomSeed', config.randomSeed ?? 7492810459182736451n);
  writeTagLong('Time', totalTicksBig);
  writeTagLong('currentTick', totalTicksBig);
  writeTagFloat('rainLevel', config.rainLevel ?? 0.0);
  writeTagFloat('lightningLevel', config.lightningLevel ?? 0.0);
  writeTagInt('SpawnX', config.spawnX ?? 128);
  writeTagInt('SpawnY', config.spawnY ?? 69);
  writeTagInt('SpawnZ', config.spawnZ ?? -244);
  writeTagInt('GameType', config.gameType);
  writeTagInt('Difficulty', config.difficulty ?? 2);
  writeTagByte('IsHardcore', config.isHardcore ?? 0);
  writeTagByte('keepinventory', config.keepinventory ?? 0);
  writeTagByte('showcoordinates', config.showcoordinates ?? 1);
  writeTagByte('showdaysplayed', config.showdaysplayed ?? 1);
  writeTagByte('dofiretick', config.dofiretick ?? 1);
  writeTagByte('tntexplodes', config.tntexplodes ?? 1);
  writeTagByte('mobgriefing', config.mobgriefing ?? 1);
  writeTagByte('dodaylightcycle', config.dodaylightcycle ?? 1);
  writeTagByte('doweathercycle', config.doweathercycle ?? 1);
  writeTagByte('pvp', config.pvp ?? 1);
  writeTagByte('doimmediaterespawn', config.doimmediaterespawn ?? 0);
  writeTagByte('naturalregeneration', config.naturalregeneration ?? 1);
  writeTagInt('randomtickspeed', config.randomtickspeed ?? 1);
  writeTagInt('spawnradius', config.spawnradius ?? 5);
  writeTagInt(
    'playerssleepingpercentage',
    config.playerssleepingpercentage ?? 100
  );
  writeTagByte('hasBeenLoadedInCreative', config.hasBeenLoadedInCreative);
  writeTagByte('commandsEnabled', config.commandsEnabled);
  writeTagByte('cheatsEnabled', config.cheatsEnabled);
  writeTagByte('commandblockoutput', config.commandblockoutput ?? 0);
  writeTagByte('commandblocksacEnabled', config.commandblocksacEnabled ?? 0);
  writeTagByte('ForceGameType', config.ForceGameType ?? 0);

  // Compound 'experiments' (TAG_Compound = 10)
  pushByte(10);
  pushString('experiments');
  for (const expKey of EXPERIMENT_ZERO_KEYS) {
    const val = config.experiments?.[expKey] ?? 0;
    writeTagByte(expKey, val);
  }
  pushByte(0); // TAG_End of experiments compound

  // Template / Marketplace flags
  for (const tplKey of TEMPLATE_LOCK_ZERO_KEYS) {
    const val = config.templateLocks?.[tplKey] ?? 0;
    writeTagByte(tplKey, val);
  }

  // End of Root Compound
  pushByte(0);

  const payload = new Uint8Array(chunks);
  const fullBuffer = new Uint8Array(8 + payload.length);
  const hdrView = new DataView(fullBuffer.buffer);
  hdrView.setInt32(0, 10, true);
  hdrView.setInt32(4, payload.length, true);
  fullBuffer.set(payload, 8);

  return fullBuffer;
}

/**
 * Generates realistic pre-loaded worlds backed by genuine binary Little-Endian level.dat buffers.
 */
export function createInitialSampleWorlds(): BedrockWorldEntry[] {
  const now = Date.now();
  const rawConfigs = [
    {
      folderName: 'db8A9kL2pQw=',
      levelName: 'Survival Principal 1.21.80 (Mega Base)',
      lastModified: now - 1000 * 60 * 14,
      gameType: 0,
      difficulty: 3,
      isHardcore: 0,
      keepinventory: 0,
      showcoordinates: 1,
      showdaysplayed: 1,
      daysPlayed: 412,
      rainLevel: 1.0,
      worldTime: 18400n,
      randomSeed: -8491029384710928341n,
      spawnX: 240,
      spawnY: 71,
      spawnZ: -612,
      hasBeenLoadedInCreative: 1,
      commandsEnabled: 1,
      cheatsEnabled: 1,
      commandblockoutput: 1,
      ForceGameType: 0,
      experiments: {
        experiments_ever_used: 1,
        saved_with_toggled_experiments: 1,
        villager_trades_rebalance: 1,
      },
      templateLocks: {},
    },
    {
      folderName: 'xR4mP9vTnZw=',
      levelName: 'Reino dos Amigos SMP — Farm de Ferro & NetherHub',
      lastModified: now - 1000 * 60 * 48,
      gameType: 1,
      difficulty: 2,
      isHardcore: 0,
      keepinventory: 1,
      showcoordinates: 1,
      showdaysplayed: 1,
      daysPlayed: 890,
      playerssleepingpercentage: 1,
      randomSeed: 4192837465091827364n,
      spawnX: -48,
      spawnY: 64,
      spawnZ: 185,
      hasBeenLoadedInCreative: 1,
      commandsEnabled: 1,
      cheatsEnabled: 1,
      ForceGameType: 1,
      experiments: {},
      templateLocks: {},
    },
    {
      folderName: 'kL9vB2nMqWe=',
      levelName: 'Aventura Marketplace — Castelo Medieval',
      lastModified: now - 1000 * 60 * 130,
      gameType: 0,
      difficulty: 2,
      isHardcore: 0,
      keepinventory: 0,
      showcoordinates: 0,
      showdaysplayed: 0,
      daysPlayed: 45,
      randomSeed: 1928374655647382910n,
      spawnX: 1024,
      spawnY: 88,
      spawnZ: 512,
      hasBeenLoadedInCreative: 0,
      commandsEnabled: 0,
      cheatsEnabled: 0,
      experiments: {},
      templateLocks: {
        hasLockedBehaviorPack: 1,
        hasLockedResourcePack: 1,
        isFromLockedTemplate: 1,
        isFromWorldTemplate: 1,
        isWorldTemplateOptionLocked: 1,
      },
    },
    {
      folderName: 'pT7cW3zXyQa=',
      levelName: 'Mundo Teste Trial Chambers [Experimental]',
      lastModified: now - 1000 * 60 * 320,
      gameType: 0,
      difficulty: 2,
      isHardcore: 1,
      keepinventory: 0,
      showcoordinates: 1,
      showdaysplayed: 1,
      daysPlayed: 128,
      randomSeed: -3392817263548192012n,
      spawnX: 0,
      spawnY: 68,
      spawnZ: 0,
      hasBeenLoadedInCreative: 0,
      commandsEnabled: 0,
      cheatsEnabled: 0,
      experiments: {
        experiments_ever_used: 1,
        saved_with_toggled_experiments: 1,
        upcoming_creator_features: 1,
        data_driven_items: 1,
        gametest: 1,
      },
      templateLocks: {},
    },
    {
      folderName: 'mN5jH8gFdSa=',
      levelName: 'Hardcore Sobrevivência — Ilha Isolada',
      lastModified: now - 1000 * 60 * 780,
      gameType: 0,
      difficulty: 3,
      isHardcore: 1,
      keepinventory: 0,
      showcoordinates: 1,
      showdaysplayed: 1,
      daysPlayed: 1050,
      randomSeed: 8827162534491029384n,
      spawnX: -810,
      spawnY: 63,
      spawnZ: 420,
      hasBeenLoadedInCreative: 0,
      commandsEnabled: 0,
      cheatsEnabled: 0,
      experiments: {},
      templateLocks: {},
    },
    {
      folderName: 'vC2xZ6bNmQw=',
      levelName: 'Em Busca da Platina (100% Conquistas Xbox)',
      lastModified: now - 1000 * 60 * 1440,
      gameType: 0,
      difficulty: 2,
      isHardcore: 0,
      keepinventory: 1,
      showcoordinates: 1,
      showdaysplayed: 1,
      daysPlayed: 2500,
      randomSeed: 5519283746102938475n,
      spawnX: 64,
      spawnY: 70,
      spawnZ: -120,
      hasBeenLoadedInCreative: 0,
      commandsEnabled: 0,
      cheatsEnabled: 0,
      experiments: {},
      templateLocks: {},
    },
  ];

  const entries = rawConfigs.map((cfg, idx) => {
    const bytes = buildBinaryBedrockLevelDat(cfg);
    return inspectLevelDatBuffer(bytes, {
      id: `sample_world_${idx + 1}`,
      folderName: cfg.folderName,
      levelNameTxt: cfg.levelName,
      sourceType: 'sample',
      lastModified: cfg.lastModified,
    });
  });

  return sortBedrockWorlds(entries);
}

/**
 * Sorts worlds:
 * 1. BlockedRed (🔴 SEM CONQUISTAS - Bloqueado) at the very top
 * 2. ExperimentalYellow (⚠️ EXPERIMENTAL ATIVO) second
 * 3. ActiveGreen (🟢 CONQUISTAS ATIVAS) third
 */
export function sortBedrockWorlds(
  worlds: BedrockWorldEntry[]
): BedrockWorldEntry[] {
  const rank: Record<WorldAchievementStatus, number> = {
    [WorldAchievementStatus.BlockedRed]: 0,
    [WorldAchievementStatus.ExperimentalYellow]: 1,
    [WorldAchievementStatus.ActiveGreen]: 2,
  };

  return [...worlds].sort((a, b) => {
    const rDiff = rank[a.status] - rank[b.status];
    if (rDiff !== 0) return rDiff;
    return b.lastModified - a.lastModified;
  });
}
