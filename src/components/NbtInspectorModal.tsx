import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  FileCode2,
  Copy,
  Check,
  Sparkles,
  Sliders,
  Compass,
  CloudSun,
  Binary,
  CopyPlus,
  Calendar,
  Plus,
  Gauge,
  Heart,
  Skull,
  ShieldAlert,
  Timer,
  Trophy,
} from 'lucide-react';
import {
  BedrockWorldEntry,
  WorldAchievementStatus,
  WorldCustomEdits,
  calculateRealPlaytime,
  getSurvivalMilestone,
} from '../utils/nbtPatcher';

interface NbtInspectorModalProps {
  world: BedrockWorldEntry | null;
  onClose: () => void;
  onPatchSingleWorld: (worldId: string, customEdits?: WorldCustomEdits) => void;
  onCloneWorld: (worldId: string) => void;
  onRestoreBackup: (worldId: string) => void;
  onDownloadLevelDat: (world: BedrockWorldEntry) => void;
  onDownloadMcworld: (world: BedrockWorldEntry) => void;
}

const MINECRAFT_COLOR_CODES = [
  { code: '§6', label: 'Ouro (§6)', colorClass: 'text-[#F59E0B] border-[#F59E0B]/40' },
  { code: '§a', label: 'Verde (§a)', colorClass: 'text-[#10B981] border-[#10B981]/40' },
  { code: '§b', label: 'Ciano (§b)', colorClass: 'text-[#0EA5E9] border-[#0EA5E9]/40' },
  { code: '§c', label: 'Vermelho (§c)', colorClass: 'text-[#EF4444] border-[#EF4444]/40' },
  { code: '§e', label: 'Amarelo (§e)', colorClass: 'text-yellow-300 border-yellow-400/40' },
  { code: '§d', label: 'Rosa (§d)', colorClass: 'text-pink-400 border-pink-400/40' },
  { code: '§l', label: 'Negrito (§l)', colorClass: 'text-white font-extrabold border-slate-500' },
];

export const NbtInspectorModal: React.FC<NbtInspectorModalProps> = ({
  world,
  onClose,
  onPatchSingleWorld,
  onCloneWorld,
  onRestoreBackup,
  onDownloadLevelDat,
  onDownloadMcworld,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'nbt' | 'hexdiff'>('editor');
  const [editedName, setEditedName] = useState('');
  const [editedSeed, setEditedSeed] = useState('');
  const [editedSpawnX, setEditedSpawnX] = useState(0);
  const [editedSpawnY, setEditedSpawnY] = useState(64);
  const [editedSpawnZ, setEditedSpawnZ] = useState(0);
  const [editedDaysPlayed, setEditedDaysPlayed] = useState(0);
  const [editedTime, setEditedTime] = useState(6000);
  const [clearWeather, setClearWeather] = useState(true);
  const [editedGameType, setEditedGameType] = useState(0);
  const [editedDifficulty, setEditedDifficulty] = useState(2);
  const [editedHardcore, setEditedHardcore] = useState(false);

  // 11 Boolean Safe Gamerules (including showdaysplayed)
  const [editedKeepInventory, setEditedKeepInventory] = useState(false);
  const [editedShowCoordinates, setEditedShowCoordinates] = useState(true);
  const [editedShowDaysPlayed, setEditedShowDaysPlayed] = useState(true);
  const [editedDoFireTick, setEditedDoFireTick] = useState(true);
  const [editedTntExplodes, setEditedTntExplodes] = useState(true);
  const [editedMobGriefing, setEditedMobGriefing] = useState(true);
  const [editedDoDaylightCycle, setEditedDoDaylightCycle] = useState(true);
  const [editedDoWeatherCycle, setEditedDoWeatherCycle] = useState(true);
  const [editedPvp, setEditedPvp] = useState(true);
  const [editedImmediateRespawn, setEditedImmediateRespawn] = useState(false);
  const [editedNaturalRegen, setEditedNaturalRegen] = useState(true);

  // 3 Integer Safe Gamerules
  const [editedRandomTickSpeed, setEditedRandomTickSpeed] = useState(1);
  const [editedSpawnRadius, setEditedSpawnRadius] = useState(5);
  const [editedSleepingPercent, setEditedSleepingPercent] = useState(100);

  const [copiedSeed, setCopiedSeed] = useState(false);

  useEffect(() => {
    if (world) {
      setEditedName(world.worldName);
      setEditedSeed(world.randomSeed);
      setEditedSpawnX(world.spawnX);
      setEditedSpawnY(world.spawnY);
      setEditedSpawnZ(world.spawnZ);
      setEditedDaysPlayed(world.daysPlayed);
      setEditedTime(world.worldTime);
      setClearWeather(world.rainLevel > 0 || world.lightningLevel > 0);
      setEditedGameType(world.gameType === 1 ? 0 : world.gameType);
      setEditedDifficulty(world.difficulty);
      setEditedHardcore(world.isHardcore);

      setEditedKeepInventory(world.keepInventory);
      setEditedShowCoordinates(world.showCoordinates);
      setEditedShowDaysPlayed(world.showDaysPlayed);
      setEditedDoFireTick(world.doFireTick);
      setEditedTntExplodes(world.tntExplodes);
      setEditedMobGriefing(world.mobGriefing);
      setEditedDoDaylightCycle(world.doDaylightCycle);
      setEditedDoWeatherCycle(world.doWeatherCycle);
      setEditedPvp(world.pvp);
      setEditedImmediateRespawn(world.doImmediateRespawn);
      setEditedNaturalRegen(world.naturalRegeneration);

      setEditedRandomTickSpeed(world.randomTickSpeed);
      setEditedSpawnRadius(world.spawnRadius);
      setEditedSleepingPercent(world.playersSleepingPercentage);
    }
  }, [world]);

  // Hex Dump rows (16 bytes per row) with diff highlighting against backupLevelDatBytes
  const hexRows = useMemo(() => {
    if (!world) return [];
    const cur = world.levelDatBytes;
    const bak = world.backupLevelDatBytes;
    const maxBytes = Math.min(cur.length, 512);
    const rows: {
      offsetHex: string;
      bytes: { hex: string; changed: boolean }[];
      ascii: string;
    }[] = [];

    for (let offset = 0; offset < maxBytes; offset += 16) {
      const slice = cur.subarray(offset, Math.min(offset + 16, maxBytes));
      const byteItems: { hex: string; changed: boolean }[] = [];
      let ascii = '';

      for (let i = 0; i < slice.length; i++) {
        const b = slice[i];
        const bakB = bak && offset + i < bak.length ? bak[offset + i] : b;
        byteItems.push({
          hex: b.toString(16).toUpperCase().padStart(2, '0'),
          changed: bak !== null && b !== bakB,
        });
        ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
      }

      rows.push({
        offsetHex: offset.toString(16).toUpperCase().padStart(4, '0'),
        bytes: byteItems,
        ascii,
      });
    }
    return rows;
  }, [world]);

  if (!world) return null;

  const isRed = world.status === WorldAchievementStatus.BlockedRed;
  const isYellow = world.status === WorldAchievementStatus.ExperimentalYellow;

  const computedTotalTicks =
    BigInt(Math.max(0, Math.floor(editedDaysPlayed))) * 24000n +
    BigInt(((Math.floor(editedTime) % 24000) + 24000) % 24000);

  const computedPlaytime = useMemo(
    () => calculateRealPlaytime(editedDaysPlayed),
    [editedDaysPlayed]
  );

  const computedMilestone = useMemo(
    () => getSurvivalMilestone(editedDaysPlayed),
    [editedDaysPlayed]
  );

  const handleCopySeed = async () => {
    try {
      await navigator.clipboard.writeText(editedSeed);
      setCopiedSeed(true);
      setTimeout(() => setCopiedSeed(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRandomizeSeed = () => {
    const rnd = BigInt(
      Math.floor(Math.random() * 9000000000000000) - 4500000000000000
    );
    setEditedSeed(rnd.toString());
  };

  const handleSaveAndPatch = () => {
    onPatchSingleWorld(world.id, {
      newWorldName: editedName,
      newRandomSeed: editedSeed,
      spawnX: Number(editedSpawnX),
      spawnY: Number(editedSpawnY),
      spawnZ: Number(editedSpawnZ),
      daysPlayed: Math.max(0, Number(editedDaysPlayed)),
      worldTime: Number(editedTime),
      clearWeather,
      gameType: editedGameType,
      difficulty: editedDifficulty,
      isHardcore: editedHardcore,
      keepInventory: editedKeepInventory,
      showCoordinates: editedShowCoordinates,
      showDaysPlayed: editedShowDaysPlayed,
      doFireTick: editedDoFireTick,
      tntExplodes: editedTntExplodes,
      mobGriefing: editedMobGriefing,
      doDaylightCycle: editedDoDaylightCycle,
      doWeatherCycle: editedDoWeatherCycle,
      pvp: editedPvp,
      doImmediateRespawn: editedImmediateRespawn,
      naturalRegeneration: editedNaturalRegen,
      randomTickSpeed: Number(editedRandomTickSpeed),
      spawnRadius: Number(editedSpawnRadius),
      playersSleepingPercentage: Number(editedSleepingPercent),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nbt-modal-title"
    >
      <div className="w-full max-w-5xl rounded-xl border border-[#1E293B] bg-[#111827] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E293B] bg-[#0B0F19] px-6 py-4">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-5 h-5 text-[#0EA5E9] shrink-0" />
            <div>
              <h3 id="nbt-modal-title" className="text-base font-bold text-white">
                Editor NBT v4.0 SUPREME, Dias Jogados & Gamerules — {world.worldName}
              </h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                Pasta: {world.folderName} · Dias Jogados: {world.daysPlayed} · Payload: {world.payloadSize} bytes · Seed: {world.randomSeed}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar inspetor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] bg-[#0B0F19]/60 px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('editor')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-[#0EA5E9] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              1. Dias Jogados, Spawn, Clima & Gamerules
            </button>
            <button
              onClick={() => setActiveTab('nbt')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'nbt'
                  ? 'bg-[#0EA5E9] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              2. Tabela de Offsets NBT ({world.diagnostics.length})
            </button>
            <button
              onClick={() => setActiveTab('hexdiff')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'hexdiff'
                  ? 'bg-[#0EA5E9] text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              3. Hex Dump & Diff Binário (Antes vs. Depois)
            </button>
          </div>

          <div className="text-xs font-semibold">
            {isRed && (
              <span className="inline-flex items-center gap-1.5 text-[#EF4444]">
                <AlertTriangle className="w-4 h-4" />
                🔴 SEM CONQUISTAS - Bloqueado
              </span>
            )}
            {isYellow && (
              <span className="inline-flex items-center gap-1.5 text-[#F59E0B]">
                <AlertTriangle className="w-4 h-4" />
                ⚠️ EXPERIMENTAL ATIVO
              </span>
            )}
            {!isRed && !isYellow && (
              <span className="inline-flex items-center gap-1.5 text-[#10B981]">
                <CheckCircle2 className="w-4 h-4" />
                🟢 CONQUISTAS ATIVAS
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'editor' && (
            <>
              {/* DESTAQUE: AUMENTAR / EDITAR DIAS JOGADOS (Time + currentTick + showdaysplayed) */}
              <div className="rounded-xl border border-[#F59E0B]/40 bg-[#0B0F19] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F59E0B]">
                    <Calendar className="w-4 h-4" />
                    <span>
                      AUMENTAR / EDITAR DIAS JOGADOS NO MUNDO (TAG_Long Time & currentTick · 1 Dia = 24.000 Ticks)
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[#10B981] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedShowDaysPlayed}
                      onChange={(e) => setEditedShowDaysPlayed(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>📅 Mostrar Contador "Dias Jogados" na Tela (showdaysplayed = 1)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                  <div className="lg:col-span-4">
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Total de Dias Jogados (<code className="font-mono text-[#F59E0B]">Dias = Time ÷ 24000</code>):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={9999999}
                        value={editedDaysPlayed}
                        onChange={(e) =>
                          setEditedDaysPlayed(Math.max(0, Number(e.target.value)))
                        }
                        className="w-full rounded-lg border border-[#F59E0B]/50 bg-[#111827] px-3.5 py-2 text-base font-mono font-bold text-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
                      />
                      <span className="text-xs font-mono text-slate-400 shrink-0">
                        dias
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-8 space-y-1.5">
                    <span className="text-[11px] text-slate-400 block">
                      Atalhos Rápidos para Aumentar ou Definir Dias Jogados:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed((d) => d + 10)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/40 bg-[#10B981]/15 px-2.5 py-1.5 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/25 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> +10 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed((d) => d + 100)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/40 bg-[#10B981]/15 px-2.5 py-1.5 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/25 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> +100 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed((d) => d + 500)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/40 bg-[#10B981]/15 px-2.5 py-1.5 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/25 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> +500 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed((d) => d + 1000)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#F59E0B]/40 bg-[#F59E0B]/15 px-2.5 py-1.5 text-xs font-bold text-[#F59E0B] hover:bg-[#F59E0B]/25 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> +1.000 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed(100)}
                        className="rounded-md border border-[#1E293B] bg-[#111827] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#0EA5E9] cursor-pointer"
                      >
                        = 100 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed(365)}
                        className="rounded-md border border-[#1E293B] bg-[#111827] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#0EA5E9] cursor-pointer"
                      >
                        = 365 Dias (1 Ano)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed(1000)}
                        className="rounded-md border border-[#1E293B] bg-[#111827] px-2.5 py-1.5 text-xs font-semibold text-[#0EA5E9] hover:border-[#0EA5E9] cursor-pointer"
                      >
                        = 1.000 Dias
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedDaysPlayed(10000)}
                        className="rounded-md border border-[#1E293B] bg-[#111827] px-2.5 py-1.5 text-xs font-semibold text-amber-300 hover:border-amber-400 cursor-pointer"
                      >
                        = 10.000 Dias
                      </button>
                    </div>
                  </div>
                </div>

                {/* Real-Life Playtime & Challenge Milestones */}
                <div className="rounded-lg border border-[#1E293B] bg-[#111827]/80 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#0EA5E9]">
                      <Timer className="w-4 h-4 text-[#0EA5E9]" />
                      <span>{computedPlaytime.text}</span>
                      <span className="text-slate-500 font-normal">({(computedPlaytime.totalMinutes / 60).toFixed(1)}h no mundo real)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Trophy className="w-4 h-4 text-[#F59E0B]" />
                      <span>{computedMilestone.badge} — {computedMilestone.rankTitle}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Progresso rumo ao marco de <strong>{computedMilestone.nextMilestone} Dias</strong></span>
                      <span className="text-[#10B981] font-bold">{computedMilestone.percent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#1E293B] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#10B981] via-[#0EA5E9] to-[#F59E0B] transition-all duration-300"
                        style={{ width: `${computedMilestone.percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1E293B] text-[11px] font-mono text-slate-400">
                  <span>
                    Cálculo NBT: <strong className="text-white">{editedDaysPlayed} dias</strong> × 24.000 +{' '}
                    <strong className="text-white">{editedTime} ticks</strong> ={' '}
                    <strong className="text-[#10B981]">{computedTotalTicks.toString()} ticks totais</strong>
                  </span>
                  <span>
                    Sincroniza <code className="text-slate-200">Time</code> + <code className="text-slate-200">currentTick</code> + <code className="text-slate-200">showdaysplayed</code>
                  </span>
                </div>
              </div>

              {/* World Name & Seed Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="world-name-editor"
                      className="text-xs font-bold text-slate-300 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                      RENOMEAR MUNDO (LevelName + levelname.txt)
                    </label>
                  </div>
                  <input
                    id="world-name-editor"
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-sm font-semibold text-white focus:border-[#0EA5E9] focus:outline-none"
                    placeholder="Digite o novo nome do mundo..."
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 mr-1">
                      Inserir cor:
                    </span>
                    {MINECRAFT_COLOR_CODES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => setEditedName((prev) => `${c.code}${prev}`)}
                        className={`rounded border bg-[#111827] px-2 py-0.5 text-[11px] font-mono hover:bg-slate-800 transition-colors cursor-pointer ${c.colorClass}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seed Editor & Generator */}
                <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="world-seed-editor"
                      className="text-xs font-bold text-slate-300"
                    >
                      SEED DO MUNDO (TAG_Long RandomSeed 64-bit)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleRandomizeSeed}
                        className="rounded border border-[#1E293B] bg-[#111827] px-2 py-1 text-[11px] font-semibold text-[#F59E0B] hover:border-[#F59E0B] cursor-pointer"
                      >
                        🎲 Gerar Nova Seed
                      </button>
                      <button
                        type="button"
                        onClick={handleCopySeed}
                        className="inline-flex items-center gap-1 rounded border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 px-2 py-1 text-[11px] font-bold text-[#0EA5E9] hover:bg-[#0EA5E9]/20 cursor-pointer"
                      >
                        {copiedSeed ? (
                          <>
                            <Check className="w-3 h-3 text-[#10B981]" />
                            Copiada
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <input
                    id="world-seed-editor"
                    type="text"
                    value={editedSeed}
                    onChange={(e) => setEditedSeed(e.target.value)}
                    className="w-full rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-sm font-mono text-[#0EA5E9] focus:border-[#0EA5E9] focus:outline-none"
                    placeholder="Ex: -8491029384710928341"
                  />
                  <p className="text-[11px] text-slate-400">
                    Você pode copiar a Seed atual ou trocá-la para que novos chunks gerados sigam outra Seed.
                  </p>
                </div>
              </div>

              {/* Spawn Coordinates & Time/Weather Editor */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Spawn X / Y / Z */}
                <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-[#0EA5E9]" />
                      TELEPORTAR PONTO DE SPAWN (SpawnX, SpawnY, SpawnZ)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditedSpawnX(0);
                        setEditedSpawnY(70);
                        setEditedSpawnZ(0);
                      }}
                      className="text-[11px] text-[#0EA5E9] hover:underline cursor-pointer"
                    >
                      Usar Origem (0, 70, 0)
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 font-mono block mb-1">
                        SpawnX (Leste/Oeste)
                      </label>
                      <input
                        type="number"
                        value={editedSpawnX}
                        onChange={(e) => setEditedSpawnX(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-1.5 text-xs font-mono text-white focus:border-[#0EA5E9] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-mono block mb-1">
                        SpawnY (Altura)
                      </label>
                      <input
                        type="number"
                        value={editedSpawnY}
                        onChange={(e) => setEditedSpawnY(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-1.5 text-xs font-mono text-white focus:border-[#0EA5E9] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-mono block mb-1">
                        SpawnZ (Norte/Sul)
                      </label>
                      <input
                        type="number"
                        value={editedSpawnZ}
                        onChange={(e) => setEditedSpawnZ(Number(e.target.value))}
                        className="w-full rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-1.5 text-xs font-mono text-white focus:border-[#0EA5E9] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Time & Weather */}
                <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <CloudSun className="w-4 h-4 text-[#F59E0B]" />
                      HORÁRIO DO DIA & CLIMA (Preserva os {editedDaysPlayed} Dias)
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Time % 24000 = {editedTime} ticks
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: '🌅 Amanhecer', ticks: 0 },
                      { label: '☀️ Meio-Dia', ticks: 6000 },
                      { label: '🌇 Pôr do Sol', ticks: 12000 },
                      { label: '🌙 Meia-Noite', ticks: 18000 },
                    ].map((preset) => (
                      <button
                        key={preset.ticks}
                        type="button"
                        onClick={() => setEditedTime(preset.ticks)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                          editedTime === preset.ticks
                            ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                            : 'border-[#1E293B] bg-[#111827] text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={clearWeather}
                      onChange={(e) => setClearWeather(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      ☀️ Limpar Chuva e Tempestade (<code className="font-mono text-[#10B981]">rainLevel = 0.0</code>,{' '}
                      <code className="font-mono text-[#10B981]">lightningLevel = 0.0</code>)
                    </span>
                  </label>
                </div>
              </div>

              {/* GameType, Difficulty & Official Hardcore Mode Control Center */}
              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-3">
                  <div className="flex items-center gap-2">
                    <Skull className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200">
                      MODO HARDCORE OFICIAL (Minecraft Bedrock 1.21+) & MODO DE JOGO
                    </span>
                  </div>
                  {editedHardcore ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-950/80 text-purple-300 border border-purple-500/80 shadow-[0_0_12px_rgba(168,85,247,0.35)]">
                      <Skull className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                      💀 HARDCORE ATIVO (1 Vida Única · Difícil = 3)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/60">
                      <Heart className="w-3.5 h-3.5 text-emerald-400" />
                      💖 Sobrevivência Padrão (Vidas Ilimitadas)
                    </span>
                  )}
                </div>

                {editedGameType === 6 && (
                  <div className="rounded-lg border border-red-500/60 bg-red-950/40 p-3 flex items-start justify-between gap-3 text-red-200 text-xs">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">⚠️ Jogador Morreu no Hardcore (Modo Espectador = 6)!</strong>
                        <span>O Minecraft travou este mapa como fantasma espectador. Use o botão ao lado para reviver e voltar a jogar normalmente em Sobrevivência.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditedGameType(0);
                        setEditedHardcore(false);
                      }}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shrink-0 cursor-pointer shadow-md"
                    >
                      💖 Reviver em Sobrevivência
                    </button>
                  </div>
                )}

                {/* 1-Click Fast Conversion Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditedHardcore(true);
                      setEditedDifficulty(3);
                      setEditedGameType(0);
                    }}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      editedHardcore
                        ? 'border-purple-500 bg-purple-950/40 text-purple-200 ring-1 ring-purple-500/50'
                        : 'border-[#1E293B] bg-[#111827] text-slate-300 hover:border-purple-500/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-purple-300 mb-1">
                      <Skull className="w-4 h-4" />
                      💀 Colocar em Modo Hardcore Oficial (1-Clique)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Define <code className="text-purple-300 font-mono">IsHardcore=1</code>, trava <code className="text-slate-300 font-mono">Difficulty=3 (Difícil)</code> e modo <code className="text-slate-300 font-mono">Sobrevivência</code> com conquistas ativas.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditedHardcore(false);
                      if (editedGameType === 6) setEditedGameType(0);
                    }}
                    className={`rounded-lg border p-3 text-left transition-all cursor-pointer ${
                      !editedHardcore
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200 ring-1 ring-emerald-500/50'
                        : 'border-[#1E293B] bg-[#111827] text-slate-300 hover:border-emerald-500/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-emerald-300 mb-1">
                      <Heart className="w-4 h-4" />
                      💖 Desativar Hardcore & Reviver (1-Clique)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Define <code className="text-emerald-300 font-mono">IsHardcore=0</code> e retira a trava de morte/espectador para permitir reviver infinitamente.
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      MODO DE JOGO (GameType)
                    </label>
                    <select
                      value={editedGameType}
                      onChange={(e) => setEditedGameType(Number(e.target.value))}
                      className="w-full rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2 text-xs font-semibold text-white focus:border-[#0EA5E9] focus:outline-none"
                    >
                      <option value={0}>0 — Sobrevivência (Conquistas Ativas)</option>
                      <option value={2}>2 — Aventura (Conquistas Ativas)</option>
                      <option value={1}>1 — Criativo (Bloqueia Conquistas)</option>
                      <option value={6}>6 — Espectador (Modo Morte do Hardcore)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      DIFICULDADE (Difficulty)
                    </label>
                    <select
                      value={editedDifficulty}
                      onChange={(e) => setEditedDifficulty(Number(e.target.value))}
                      disabled={editedHardcore}
                      className={`w-full rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2 text-xs font-semibold text-white focus:border-[#0EA5E9] focus:outline-none ${
                        editedHardcore ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value={0}>0 — Pacífico</option>
                      <option value={1}>1 — Fácil</option>
                      <option value={2}>2 — Normal</option>
                      <option value={3}>3 — Difícil (Obrigatório no Hardcore)</option>
                    </select>
                    {editedHardcore && (
                      <span className="text-[10px] text-purple-300 block">
                        *No Hardcore do Bedrock 1.21+, a dificuldade é permanentemente travada em Difícil (3).
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 NUMERICAL GAMERULES (RandomTickSpeed, SleepingPercentage, SpawnRadius) */}
              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-[#0EA5E9]" />
                    REGRAS NUMÉRICAS AVANÇADAS (Sem Ativar Cheats / Mantém Conquistas)
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-[#1E293B] bg-[#111827] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        🌱 Velocidade das Plantas
                      </span>
                      <code className="text-[11px] font-mono text-[#10B981]">
                        randomtickspeed = {editedRandomTickSpeed}
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '1 (Padrão)', val: 1 },
                        { label: '3 (Rápido)', val: 3 },
                        { label: '10 (Turbo)', val: 10 },
                        { label: '0 (Parar)', val: 0 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setEditedRandomTickSpeed(p.val)}
                          className={`flex-1 rounded border py-1 text-[11px] font-semibold cursor-pointer ${
                            editedRandomTickSpeed === p.val
                              ? 'border-[#10B981] bg-[#10B981]/15 text-[#10B981]'
                              : 'border-[#1E293B] bg-[#0B0F19] text-slate-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#1E293B] bg-[#111827] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        🛏️ Dormir no Multiplayer
                      </span>
                      <code className="text-[11px] font-mono text-[#0EA5E9]">
                        sleeping = {editedSleepingPercent}%
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '1% (1 Jogador)', val: 1 },
                        { label: '50% (Metade)', val: 50 },
                        { label: '100% (Todos)', val: 100 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setEditedSleepingPercent(p.val)}
                          className={`flex-1 rounded border py-1 text-[11px] font-semibold cursor-pointer ${
                            editedSleepingPercent === p.val
                              ? 'border-[#0EA5E9] bg-[#0EA5E9]/15 text-[#0EA5E9]'
                              : 'border-[#1E293B] bg-[#0B0F19] text-slate-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#1E293B] bg-[#111827] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        🎯 Raio de Spawn
                      </span>
                      <code className="text-[11px] font-mono text-[#F59E0B]">
                        spawnradius = {editedSpawnRadius}
                      </code>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '0 (Bloco Exato)', val: 0 },
                        { label: '5 (Padrão)', val: 5 },
                        { label: '10 (Amplo)', val: 10 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setEditedSpawnRadius(p.val)}
                          className={`flex-1 rounded border py-1 text-[11px] font-semibold cursor-pointer ${
                            editedSpawnRadius === p.val
                              ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                              : 'border-[#1E293B] bg-[#0B0F19] text-slate-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 11 Safe Gamerules Grid (Without Disabling Achievements!) */}
              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#10B981]">
                    🛡️ CENTRAL DE GAMERULES SEGURAS (Ative recursos mantendo commandsEnabled = 0 e Conquistas Liberadas)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedKeepInventory}
                      onChange={(e) => setEditedKeepInventory(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      🎒 Manter Inventário (<code className="font-mono text-[#10B981]">keepinventory=1</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedShowCoordinates}
                      onChange={(e) => setEditedShowCoordinates(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      📍 Mostrar Coordenadas (<code className="font-mono text-[#0EA5E9]">showcoordinates=1</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedShowDaysPlayed}
                      onChange={(e) => setEditedShowDaysPlayed(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      📅 Mostrar Dias Jogados (<code className="font-mono text-[#F59E0B]">showdaysplayed=1</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!editedDoFireTick}
                      onChange={(e) => setEditedDoFireTick(!e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      🔥 Evitar Fogo Espalhar (<code className="font-mono text-amber-300">dofiretick=0</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!editedMobGriefing}
                      onChange={(e) => setEditedMobGriefing(!e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      💥 Anti-Creeper / Griefing (<code className="font-mono text-amber-300">mobgriefing=0</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!editedTntExplodes}
                      onChange={(e) => setEditedTntExplodes(!e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      🧨 Bloquear Explosão de TNT (<code className="font-mono text-amber-300">tntexplodes=0</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedImmediateRespawn}
                      onChange={(e) => setEditedImmediateRespawn(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      ⚡ Renascer Imediato (<code className="font-mono text-[#10B981]">doimmediaterespawn=1</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedDoDaylightCycle}
                      onChange={(e) => setEditedDoDaylightCycle(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      🕒 Ciclo do Dia Ativo (<code className="font-mono text-slate-300">dodaylightcycle=1</code>)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] p-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedPvp}
                      onChange={(e) => setEditedPvp(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#10B981]"
                    />
                    <span>
                      ⚔️ Combate PvP Ativo (<code className="font-mono text-slate-300">pvp=1</code>)
                    </span>
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'nbt' && (
            <div className="rounded-lg border border-[#1E293B] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1E293B] bg-[#0B0F19] text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Tag Binária NBT</th>
                    <th className="py-2.5 px-3 font-semibold">Categoria</th>
                    <th className="py-2.5 px-3 font-semibold">Tipo</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Offset</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Valor Atual</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Pós-Patch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B] bg-[#111827]/70 font-mono tabular-nums">
                  {world.diagnostics.map((d) => (
                    <tr
                      key={`${d.key}-${d.offset}`}
                      className={
                        d.isBlocking
                          ? 'bg-[#EF4444]/10 text-red-200'
                          : 'text-slate-300'
                      }
                    >
                      <td className="py-2 px-3 font-semibold">{d.key}</td>
                      <td className="py-2 px-3 text-slate-400">{d.category}</td>
                      <td className="py-2 px-3 text-slate-400">{d.tagType}</td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        0x{d.offset.toString(16).toUpperCase().padStart(4, '0')}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {String(d.currentValue)}
                      </td>
                      <td className="py-2 px-3 text-right text-[#10B981] font-bold">
                        {String(d.targetValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'hexdiff' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  Visualizando os primeiros 512 bytes do arquivo <code className="font-mono text-white">level.dat</code> Little-Endian.
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded bg-[#10B981]/30 border border-[#10B981]" />
                  <strong className="text-[#10B981]">Verde Esmeralda:</strong> Bytes modificados em relação ao backup original (<code className="font-mono">level.dat.bak</code>)
                </span>
              </div>
              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 font-mono text-xs overflow-x-auto max-h-[380px] overflow-y-auto">
                {hexRows.map((row) => (
                  <div
                    key={row.offsetHex}
                    className="flex items-center gap-4 py-0.5 leading-relaxed whitespace-nowrap"
                  >
                    <span className="text-slate-500 select-none">
                      0x{row.offsetHex}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {row.bytes.map((b, idx) => (
                        <span
                          key={idx}
                          className={`px-1 rounded ${
                            b.changed
                              ? 'bg-[#10B981]/25 text-[#10B981] font-bold ring-1 ring-[#10B981]/50'
                              : 'text-slate-300'
                          }`}
                        >
                          {b.hex}
                        </span>
                      ))}
                    </div>
                    <span className="text-slate-500 border-l border-[#1E293B] pl-3">
                      {row.ascii}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E293B] bg-[#0B0F19] px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSaveAndPatch}
              className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              ✔ Salvar Edições, {editedDaysPlayed} Dias & Reativar Conquistas
            </button>

            <button
              onClick={() => onCloneWorld(world.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 px-3.5 py-2 text-xs font-bold text-[#0EA5E9] hover:bg-[#0EA5E9]/20 transition-colors cursor-pointer"
            >
              <CopyPlus className="w-3.5 h-3.5" />
              Clonar Mundo Limpo
            </button>

            {world.backupLevelDatBytes && (
              <button
                onClick={() => onRestoreBackup(world.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2 text-xs font-semibold text-amber-300 hover:border-amber-500/40 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar Backup (.bak)
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onDownloadLevelDat(world)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-[#0EA5E9] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#0EA5E9]" />
              Baixar level.dat
            </button>
            <button
              onClick={() => onDownloadMcworld(world)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-[#F59E0B] hover:border-[#F59E0B] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
              Exportar .mcworld
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
