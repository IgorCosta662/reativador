import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import {
  RefreshCw,
  FolderOpen,
  Upload,
  Check,
  Search,
  Download,
  RotateCcw,
  FileCode2,
  PlusCircle,
  Zap,
  ShieldCheck,
  HardDrive,
  Copy,
  CopyPlus,
  FileArchive,
  History,
  Trash2,
  Calendar,
  Skull,
  Heart,
  Timer,
  Trophy,
} from 'lucide-react';
import {
  BedrockWorldEntry,
  WorldAchievementStatus,
  PatchOptions,
  WorldCustomEdits,
  createInitialSampleWorlds,
  inspectLevelDatBuffer,
  patchLevelDatBuffer,
  cloneCleanBedrockWorld,
  repackageArchiveWithPatchedLevelDat,
  buildBatchWorldsZip,
  buildBinaryBedrockLevelDat,
  sortBedrockWorlds,
  calculateRealPlaytime,
  getSurvivalMilestone,
  ACHIEVEMENT_ZERO_KEYS,
  EXPERIMENT_ZERO_KEYS,
  TEMPLATE_LOCK_ZERO_KEYS,
} from './utils/nbtPatcher';
import { TrophyBrandIcon } from './components/TrophyBrandIcon';
import { NbtInspectorModal } from './components/NbtInspectorModal';
import {
  WindowsDownloadCenter,
  UWP_MINECRAFT_PATH,
  GDK_MINECRAFT_PATH,
} from './components/WindowsDownloadCenter';

interface OperationLogItem {
  id: string;
  time: string;
  worldName: string;
  action: string;
  details: string;
  type: 'patch' | 'clone' | 'restore' | 'import';
}

export default function App() {
  const [worlds, setWorlds] = useState<BedrockWorldEntry[]>(() =>
    createInitialSampleWorlds()
  );
  const [currentFolderPath, setCurrentFolderPath] = useState<string>(
    UWP_MINECRAFT_PATH
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | WorldAchievementStatus
  >('ALL');

  // Auto-Apply & Auto-Watch Options
  const [autoApplyOnCheck, setAutoApplyOnCheck] = useState<boolean>(false);
  const [autoWatchNewWorlds, setAutoWatchNewWorlds] = useState<boolean>(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>(() =>
    new Date().toLocaleTimeString('pt-BR')
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [copiedSeedWorldId, setCopiedSeedWorldId] = useState<string | null>(
    null
  );

  // Patching Engine Options (v5.0 TITAN)
  const [patchOptions, setPatchOptions] = useState<PatchOptions>({
    reactivateAchievements: true,
    disableExperiments: true,
    unlockTemplates: true,
    disableHardcoreLock: false,
    enableHardcoreMode: false,
    enableKeepInventorySafe: false,
    enableShowCoordinatesSafe: true,
    enableShowDaysPlayedSafe: true,
    disableFireSpreadSafe: false,
    clearWeatherAndSetDay: false,
    onePlayerSleepSafe: false,
    createAutoBackup: true,
    bonusDaysToAdd: 0,
  });

  // Operation History Log
  const [operationLogs, setOperationLogs] = useState<OperationLogItem[]>([
    {
      id: 'init-log',
      time: new Date().toLocaleTimeString('pt-BR'),
      worldName: 'Sistema v4.0 SUPREME',
      action: 'Motor Binário NBT Little-Endian Inicializado',
      details:
        'Suporte ativo para Conquistas, Aumentar Dias Jogados (Time + currentTick + showdaysplayed), TickSpeed, 1-Player Sleep, Spawn X/Y/Z, Seed e Clonador.',
      type: 'import',
    },
  ]);

  const appendLog = useCallback(
    (
      worldName: string,
      action: string,
      details: string,
      type: OperationLogItem['type'] = 'patch'
    ) => {
      setOperationLogs((prev) => [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toLocaleTimeString('pt-BR'),
          worldName,
          action,
          details,
          type,
        },
        ...prev.slice(0, 29),
      ]);
    },
    []
  );

  // Feedback Banner & Inspector Modal
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    message: string;
  } | null>(null);
  const [inspectingWorldId, setInspectingWorldId] = useState<string | null>(
    null
  );

  // File / Directory References
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const liveDirHandleRef = useRef<any>(null);
  const pendingSimulatedQueueRef = useRef<BedrockWorldEntry[]>([]);

  const inspectingWorld = useMemo(
    () => worlds.find((w) => w.id === inspectingWorldId) || null,
    [worlds, inspectingWorldId]
  );

  // 4 Top KPI Counters
  const kpiStats = useMemo(() => {
    const total = worlds.length;
    const selected = worlds.filter((w) => w.selected).length;
    const blockedRed = worlds.filter(
      (w) => w.status === WorldAchievementStatus.BlockedRed
    ).length;
    const activeGreen = worlds.filter(
      (w) => w.status === WorldAchievementStatus.ActiveGreen
    ).length;
    return { total, selected, blockedRed, activeGreen };
  }, [worlds]);

  // Apply patch to a single world entry and return updated entry
  const applyPatchToWorldEntry = useCallback(
    async (
      world: BedrockWorldEntry,
      opts: PatchOptions,
      customEdits?: WorldCustomEdits
    ): Promise<{ updated: BedrockWorldEntry; changedCount: number }> => {
      const backupBytes = opts.createAutoBackup
        ? world.backupLevelDatBytes || new Uint8Array(world.levelDatBytes)
        : world.backupLevelDatBytes;

      const { patchedBytes, modifiedFlagsCount } = patchLevelDatBuffer(
        world.levelDatBytes,
        opts,
        customEdits
      );

      const nextTxtName =
        customEdits?.newWorldName && customEdits.newWorldName.trim().length > 0
          ? customEdits.newWorldName.trim()
          : world.levelNameTxt;

      // If connected via File System Access API DirectoryHandle, write level.dat, level.dat.bak, and levelname.txt directly
      if (world.directoryHandle) {
        try {
          if (opts.createAutoBackup) {
            const bakHandle = await world.directoryHandle.getFileHandle(
              'level.dat.bak',
              { create: true }
            );
            const bakWritable = await bakHandle.createWritable();
            await bakWritable.write(world.levelDatBytes);
            await bakWritable.close();
          }
          const fileHandle = await world.directoryHandle.getFileHandle(
            'level.dat',
            { create: true }
          );
          const writable = await fileHandle.createWritable();
          await writable.write(patchedBytes);
          await writable.close();

          if (nextTxtName) {
            const txtHandle = await world.directoryHandle.getFileHandle(
              'levelname.txt',
              { create: true }
            );
            const txtWritable = await txtHandle.createWritable();
            await txtWritable.write(nextTxtName);
            await txtWritable.close();
          }
        } catch {
          // Fallback to in-memory buffer if write permission was not granted
        }
      }

      const reInspected = inspectLevelDatBuffer(patchedBytes, {
        id: world.id,
        folderName: world.folderName,
        levelNameTxt: nextTxtName,
        sourceType: world.sourceType,
        lastModified: Date.now(),
        backupBytes,
        archiveOriginalBytes: world.archiveOriginalBytes,
        archiveLevelDatInternalPath: world.archiveLevelDatInternalPath,
        directoryHandle: world.directoryHandle,
        patchHistoryCount: world.patchHistoryCount + 1,
        lastPatchedAt: Date.now(),
      });

      reInspected.selected = false;
      return { updated: reInspected, changedCount: modifiedFlagsCount };
    },
    []
  );

  // Quick "+Dias Jogados" boost directly from a table row
  const handleQuickAddDays = async (worldId: string, addDays: number) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const newDays = Math.max(0, target.daysPlayed + addDays);
    const { updated } = await applyPatchToWorldEntry(target, patchOptions, {
      daysPlayed: newDays,
      showDaysPlayed: true,
    });

    setWorlds((prev) =>
      sortBedrockWorlds(prev.map((w) => (w.id === worldId ? updated : w)))
    );
    appendLog(
      updated.worldName,
      `+${addDays} Dias Jogados Adicionados`,
      `Dias Jogados: ${target.daysPlayed} → ${updated.daysPlayed} dias (Time = ${updated.totalWorldTicks} ticks · showdaysplayed=1).`,
      'patch'
    );
    setFeedbackBanner({
      type: 'success',
      message: `📅 +${addDays} dias adicionados em "${updated.worldName}"! Total agora: ${updated.daysPlayed} dias jogados (contador showdaysplayed = 1 ativado e conquistas liberadas).`,
    });
  };

  // Quick 1-click Toggle Hardcore for a single world entry
  const handleToggleHardcore = async (worldId: string, enableHardcore: boolean) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const { updated } = await applyPatchToWorldEntry(
      target,
      {
        ...patchOptions,
        disableHardcoreLock: !enableHardcore,
        enableHardcoreMode: enableHardcore,
      },
      {
        isHardcore: enableHardcore,
        difficulty: enableHardcore ? 3 : target.difficulty,
        gameType: 0,
      }
    );

    setWorlds((prev) =>
      sortBedrockWorlds(prev.map((w) => (w.id === worldId ? updated : w)))
    );

    const actionTitle = enableHardcore
      ? '💀 Modo Hardcore Oficial Ativado'
      : '💖 Hardcore Desativado & Revivido';
    const detailMsg = enableHardcore
      ? `IsHardcore = 1, Dificuldade = 3 (Difícil), Sobrevivência (GameType = 0) e Conquistas Ativas.`
      : `IsHardcore = 0, Sobrevivência (GameType = 0) restaurada e vidas ilimitadas.`;

    appendLog(updated.worldName, actionTitle, detailMsg, 'patch');
    setFeedbackBanner({
      type: 'success',
      message: enableHardcore
        ? `💀 "${updated.worldName}" agora está no MODO HARDCORE OFICIAL (1 vida única · Dificuldade Difícil · Conquistas Ativas)!`
        : `💖 Modo Hardcore desativado em "${updated.worldName}" (Jogador revivido em Sobrevivência com conquistas ativas)!`,
    });
  };

  // Batch toggle Hardcore across all selected worlds
  const handleBatchSetHardcore = async (enableHardcore: boolean) => {
    const selectedList = worlds.filter((w) => w.selected);
    if (selectedList.length === 0) {
      setFeedbackBanner({
        type: 'warning',
        message: 'Marque pelo menos um mapa com [✔] na tabela para aplicar a alteração de Hardcore.',
      });
      return;
    }

    let modified = 0;
    const nextWorlds: BedrockWorldEntry[] = [];
    for (const w of worlds) {
      if (w.selected) {
        const { updated } = await applyPatchToWorldEntry(
          w,
          {
            ...patchOptions,
            disableHardcoreLock: !enableHardcore,
            enableHardcoreMode: enableHardcore,
          },
          {
            isHardcore: enableHardcore,
            difficulty: enableHardcore ? 3 : w.difficulty,
            gameType: 0,
          }
        );
        nextWorlds.push(updated);
        modified++;
      } else {
        nextWorlds.push(w);
      }
    }

    setWorlds(sortBedrockWorlds(nextWorlds));
    appendLog(
      `${modified} Mundo(s) Marcado(s)`,
      enableHardcore ? 'Modo Hardcore Ativado em Lote' : 'Hardcore Desativado em Lote',
      `${modified} mundo(s) convertidos com sucesso.`,
      'patch'
    );
    setFeedbackBanner({
      type: 'success',
      message: enableHardcore
        ? `💀 ${modified} mundo(s) colocados em MODO HARDCORE OFICIAL (1 Vida · Difícil = 3 · Conquistas Ativas)!`
        : `💖 ${modified} mundo(s) convertidos para Sobrevivência Padrão com vidas ilimitadas!`,
    });
  };

  // Scan a live FileSystemDirectoryHandle (when user connects folder via showDirectoryPicker)
  const scanLiveDirectoryHandle = useCallback(async (dirHandle: any) => {
    const discovered: BedrockWorldEntry[] = [];

    try {
      const directLevelDat = await dirHandle.getFileHandle('level.dat');
      const file = await directLevelDat.getFile();
      const buf = new Uint8Array(await file.arrayBuffer());
      let levelNameTxt: string | null = null;
      try {
        const txtHandle = await dirHandle.getFileHandle('levelname.txt');
        const txtFile = await txtHandle.getFile();
        levelNameTxt = (await txtFile.text()).trim();
      } catch {
        // No levelname.txt
      }
      discovered.push(
        inspectLevelDatBuffer(buf, {
          id: `live_${dirHandle.name}`,
          folderName: dirHandle.name,
          levelNameTxt,
          sourceType: 'folder',
          lastModified: file.lastModified,
          directoryHandle: dirHandle,
        })
      );
    } catch {
      for await (const [entryName, entryHandle] of dirHandle.entries()) {
        if (entryHandle.kind === 'directory') {
          try {
            const ldatHandle = await entryHandle.getFileHandle('level.dat');
            const ldatFile = await ldatHandle.getFile();
            const buf = new Uint8Array(await ldatFile.arrayBuffer());
            let txtName: string | null = null;
            try {
              const txtHandle = await entryHandle.getFileHandle(
                'levelname.txt'
              );
              const txtFile = await txtHandle.getFile();
              txtName = (await txtFile.text()).trim();
            } catch {
              // Ignore missing levelname.txt
            }
            discovered.push(
              inspectLevelDatBuffer(buf, {
                id: `live_${entryName}`,
                folderName: entryName,
                levelNameTxt: txtName,
                sourceType: 'folder',
                lastModified: ldatFile.lastModified,
                directoryHandle: entryHandle,
              })
            );
          } catch {
            // Subdirectory is not a valid Minecraft world folder
          }
        }
      }
    }

    return sortBedrockWorlds(discovered);
  }, []);

  // Refresh Worlds List (F5 / Button / Auto-Watch Timer)
  const handleRefreshWorlds = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);

      try {
        if (liveDirHandleRef.current) {
          const freshList = await scanLiveDirectoryHandle(
            liveDirHandleRef.current
          );
          if (freshList.length > 0) {
            setWorlds((prev) => {
              const prevSelected = new Map(
                prev.map((p) => [p.id, p.selected])
              );
              const merged = freshList.map((item) => ({
                ...item,
                selected: prevSelected.has(item.id)
                  ? Boolean(prevSelected.get(item.id))
                  : item.selected,
              }));
              return sortBedrockWorlds(merged);
            });
          }
        } else {
          setWorlds((prev) => {
            const combined = [...prev];
            if (pendingSimulatedQueueRef.current.length > 0) {
              combined.push(...pendingSimulatedQueueRef.current);
              pendingSimulatedQueueRef.current = [];
            }
            const rechecked = combined.map((w) => {
              const refreshed = inspectLevelDatBuffer(w.levelDatBytes, {
                id: w.id,
                folderName: w.folderName,
                levelNameTxt: w.levelNameTxt,
                sourceType: w.sourceType,
                lastModified: w.lastModified,
                backupBytes: w.backupLevelDatBytes,
                archiveOriginalBytes: w.archiveOriginalBytes,
                archiveLevelDatInternalPath: w.archiveLevelDatInternalPath,
                directoryHandle: w.directoryHandle,
                patchHistoryCount: w.patchHistoryCount,
                lastPatchedAt: w.lastPatchedAt,
              });
              refreshed.selected = w.selected;
              return refreshed;
            });
            return sortBedrockWorlds(rechecked);
          });
        }

        const timeStr = new Date().toLocaleTimeString('pt-BR');
        setLastRefreshTime(timeStr);
        if (!silent) {
          setFeedbackBanner({
            type: 'info',
            message: `🔄 Lista de mapas atualizada às ${timeStr}. Mundos bloqueados (Vermelhos) posicionados no topo.`,
          });
        }
      } finally {
        if (!silent) {
          setTimeout(() => setIsRefreshing(false), 180);
        }
      }
    },
    [scanLiveDirectoryHandle]
  );

  // Global F5 Key Listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleRefreshWorlds(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRefreshWorlds]);

  // 3-Second Auto-Monitor Timer ("🔄 Atualizar Sozinho ao Criar Novo Mapa no Jogo")
  useEffect(() => {
    if (!autoWatchNewWorlds) return;
    const timer = setInterval(() => {
      handleRefreshWorlds(true);
    }, 3000);
    return () => clearInterval(timer);
  }, [autoWatchNewWorlds, handleRefreshWorlds]);

  // Copy World Seed
  const handleCopySeed = async (world: BedrockWorldEntry) => {
    try {
      await navigator.clipboard.writeText(world.randomSeed);
      setCopiedSeedWorldId(world.id);
      setTimeout(() => setCopiedSeedWorldId(null), 2000);
      setFeedbackBanner({
        type: 'info',
        message: `📋 Seed ${world.randomSeed} do mundo "${world.worldName}" copiada para a Área de Transferência!`,
      });
    } catch {
      // Fallback
    }
  };

  // Clone World as a Clean Achievement-Ready Copy
  const handleCloneWorld = (worldId: string) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const cloned = cloneCleanBedrockWorld(target, patchOptions);
    setWorlds((prev) => sortBedrockWorlds([cloned, ...prev]));
    appendLog(
      cloned.worldName,
      'Mundo Clonado com Conquistas Ativas',
      `Nova pasta gerada: ${cloned.folderName} (${cloned.daysPlayed} dias jogados).`,
      'clone'
    );
    setFeedbackBanner({
      type: 'success',
      message: `📑 Cópia limpa criada: "${cloned.worldName}" (Pasta: ${cloned.folderName}) com conquistas 100% liberadas!`,
    });
  };

  // Toggle individual world checkbox [✔]
  const handleToggleWorldSelection = async (worldId: string) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const nextSelected = !target.selected;

    if (nextSelected && autoApplyOnCheck) {
      const { updated, changedCount } = await applyPatchToWorldEntry(
        target,
        patchOptions
      );
      setWorlds((prev) =>
        sortBedrockWorlds(prev.map((w) => (w.id === worldId ? updated : w)))
      );
      appendLog(
        updated.worldName,
        'Auto-Patch Instantâneo [✔]',
        `${changedCount} tags binárias corrigidas automaticamente (${updated.daysPlayed} dias jogados).`,
        'patch'
      );
      setFeedbackBanner({
        type: 'success',
        message: `⚡ Modo Automático: "${updated.worldName}" foi reativado na hora (${changedCount} alterações no NBT · ${updated.daysPlayed} dias jogados)!`,
      });
      return;
    }

    setWorlds((prev) =>
      prev.map((w) => (w.id === worldId ? { ...w, selected: nextSelected } : w))
    );
  };

  // Batch Selection Buttons: Marcar Todos, Marcar Só os Vermelhos, Desmarcar Todos
  const handleBulkSelection = async (mode: 'ALL' | 'RED_ONLY' | 'NONE') => {
    const updatedList = worlds.map((w) => {
      if (mode === 'ALL') return { ...w, selected: true };
      if (mode === 'RED_ONLY') {
        return {
          ...w,
          selected: w.status === WorldAchievementStatus.BlockedRed,
        };
      }
      return { ...w, selected: false };
    });

    if (mode !== 'NONE' && autoApplyOnCheck) {
      let patchedTotal = 0;
      let flagsTotal = 0;
      const resultWorlds: BedrockWorldEntry[] = [];

      for (const w of updatedList) {
        if (w.selected) {
          const { updated, changedCount } = await applyPatchToWorldEntry(
            w,
            patchOptions
          );
          resultWorlds.push(updated);
          patchedTotal++;
          flagsTotal += changedCount;
        } else {
          resultWorlds.push(w);
        }
      }

      setWorlds(sortBedrockWorlds(resultWorlds));
      if (patchedTotal > 0) {
        appendLog(
          `${patchedTotal} Mundo(s) em Lote`,
          'Automação em Lote Concluída',
          `${flagsTotal} flags NBT corrigidas e backups .bak gerados.`,
          'patch'
        );
        setFeedbackBanner({
          type: 'success',
          message: `⚡ Automação em Lote concluída: ${patchedTotal} mundo(s) reativado(s) automaticamente (${flagsTotal} flags NBT corrigidas)!`,
        });
      }
      return;
    }

    setWorlds(updatedList);
  };

  // Toggle "⚡ Fazer Automático ao Marcar [✔]"
  const handleToggleAutoApplyMode = async (checked: boolean) => {
    setAutoApplyOnCheck(checked);
    if (checked) {
      const selectedWorlds = worlds.filter((w) => w.selected);
      if (selectedWorlds.length > 0) {
        await handleApplyPatchToSelected(worlds);
      }
    }
  };

  // Primary Action: "✔ APLICAR NOS MAPAS MARCADOS [✔]"
  const handleApplyPatchToSelected = async (
    customList?: BedrockWorldEntry[]
  ) => {
    const sourceList = customList || worlds;
    const selectedList = sourceList.filter((w) => w.selected);

    if (selectedList.length === 0) {
      setFeedbackBanner({
        type: 'warning',
        message:
          'Marque pelo menos um mapa com [✔] na tabela (ou clique em "🔴 Marcar Só os Vermelhos") para aplicar.',
      });
      return;
    }

    let worldsFixed = 0;
    let totalFlagsChanged = 0;
    const nextWorlds: BedrockWorldEntry[] = [];

    for (const w of sourceList) {
      if (w.selected) {
        const { updated, changedCount } = await applyPatchToWorldEntry(
          w,
          patchOptions
        );
        nextWorlds.push(updated);
        worldsFixed++;
        totalFlagsChanged += changedCount;
      } else {
        nextWorlds.push(w);
      }
    }

    setWorlds(sortBedrockWorlds(nextWorlds));
    const bonusDaysMsg =
      patchOptions.bonusDaysToAdd > 0
        ? ` · +${patchOptions.bonusDaysToAdd} Dias Jogados adicionados`
        : '';
    appendLog(
      `${worldsFixed} Mundo(s) Marcado(s)`,
      'Conquistas Reativadas em Lote',
      `${totalFlagsChanged} alterações aplicadas no binário level.dat${bonusDaysMsg}.`,
      'patch'
    );
    setFeedbackBanner({
      type: 'success',
      message: `✔ Conquistas reativadas em ${worldsFixed} mundo(s)! (${totalFlagsChanged} alterações aplicadas no binário${bonusDaysMsg} · Backup level.dat.bak salvo).`,
    });
  };

  // Patch a single world from the Inspector Modal (with optional custom edits)
  const handlePatchSingleWorld = async (
    worldId: string,
    customEdits?: WorldCustomEdits
  ) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target) return;

    const { updated, changedCount } = await applyPatchToWorldEntry(
      target,
      patchOptions,
      customEdits
    );
    setWorlds((prev) =>
      sortBedrockWorlds(prev.map((w) => (w.id === worldId ? updated : w)))
    );
    appendLog(
      updated.worldName,
      'Editor Avançado NBT Aplicado',
      `${changedCount} tags salvas (${updated.daysPlayed} Dias Jogados · Spawn: ${updated.spawnX},${updated.spawnY},${updated.spawnZ} · Seed: ${updated.randomSeed}).`,
      'patch'
    );
    setFeedbackBanner({
      type: 'success',
      message: `✔ Mundo "${updated.worldName}" atualizado (${updated.daysPlayed} dias jogados) e conquistas reativadas (${changedCount} tags binárias salvas)!`,
    });
  };

  // Restore level.dat.bak backup
  const handleRestoreBackup = async (worldId: string) => {
    const target = worlds.find((w) => w.id === worldId);
    if (!target || !target.backupLevelDatBytes) return;

    const restored = inspectLevelDatBuffer(target.backupLevelDatBytes, {
      id: target.id,
      folderName: target.folderName,
      levelNameTxt: target.levelNameTxt,
      sourceType: target.sourceType,
      lastModified: Date.now(),
      backupBytes: null,
      archiveOriginalBytes: target.archiveOriginalBytes,
      archiveLevelDatInternalPath: target.archiveLevelDatInternalPath,
      directoryHandle: target.directoryHandle,
    });

    setWorlds((prev) =>
      sortBedrockWorlds(prev.map((w) => (w.id === worldId ? restored : w)))
    );
    appendLog(
      restored.worldName,
      'Backup Original Restaurado',
      'Bytes originais de level.dat.bak restaurados com sucesso.',
      'restore'
    );
    setFeedbackBanner({
      type: 'info',
      message: `Backup original (level.dat.bak) restaurado para "${restored.worldName}".`,
    });
  };

  // Download individual patched level.dat
  const handleDownloadLevelDat = (world: BedrockWorldEntry) => {
    const blob = new Blob([world.levelDatBytes.buffer as ArrayBuffer], {
      type: 'application/octet-stream',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'level.dat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setFeedbackBanner({
      type: 'success',
      message: `Arquivo level.dat de "${world.worldName}" (${world.daysPlayed} dias jogados) baixado! Substitua na pasta ${world.folderName}.`,
    });
  };

  // Download re-packaged .mcworld ready to open in Minecraft Bedrock
  const handleDownloadMcworld = async (world: BedrockWorldEntry) => {
    const blob = await repackageArchiveWithPatchedLevelDat(world);
    const safeName = world.worldName
      .replace(/§[0-9a-gk-or]/gi, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_ConquistasAtivas.mcworld`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setFeedbackBanner({
      type: 'success',
      message: `Pacote "${safeName}_ConquistasAtivas.mcworld" baixado! Dê 2 cliques nele para importar no Minecraft Bedrock.`,
    });
  };

  // Download all worlds in a single Master ZIP
  const handleDownloadAllWorldsZip = async () => {
    if (worlds.length === 0) return;
    const blob = await buildBatchWorldsZip(worlds);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MundosBedrock_ConquistasAtivas_${worlds.length}mapas.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setFeedbackBanner({
      type: 'success',
      message: `📦 Pacote ZIP com todos os ${worlds.length} mundos (level.dat + levelname.txt + backups .bak) baixado!`,
    });
  };

  // Process uploaded or dropped files (.mcworld, .zip, level.dat)
  const processUploadedFileList = async (files: FileList | File[]) => {
    const imported: BedrockWorldEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lower = file.name.toLowerCase();

      if (lower.endsWith('.mcworld') || lower.endsWith('.zip')) {
        try {
          const archiveBytes = new Uint8Array(await file.arrayBuffer());
          const zip = await JSZip.loadAsync(archiveBytes);
          let levelDatEntry: JSZip.JSZipObject | null = null;
          let levelNameEntry: JSZip.JSZipObject | null = null;

          zip.forEach((relPath, zipEntry) => {
            if (
              relPath.toLowerCase().endsWith('level.dat') &&
              !relPath.toLowerCase().endsWith('.bak')
            ) {
              levelDatEntry = zipEntry;
            }
            if (relPath.toLowerCase().endsWith('levelname.txt')) {
              levelNameEntry = zipEntry;
            }
          });

          if (levelDatEntry) {
            const ldatBytes = await (levelDatEntry as JSZip.JSZipObject).async(
              'uint8array'
            );
            const txtName = levelNameEntry
              ? (
                  await (levelNameEntry as JSZip.JSZipObject).async('string')
                ).trim()
              : null;

            imported.push(
              inspectLevelDatBuffer(ldatBytes, {
                folderName: file.name,
                levelNameTxt: txtName,
                sourceType: lower.endsWith('.mcworld') ? 'mcworld' : 'zip',
                lastModified: file.lastModified,
                archiveOriginalBytes: archiveBytes,
                archiveLevelDatInternalPath: (
                  levelDatEntry as JSZip.JSZipObject
                ).name,
              })
            );
          }
        } catch {
          // Invalid zip archive
        }
      } else {
        const rawBytes = new Uint8Array(await file.arrayBuffer());
        imported.push(
          inspectLevelDatBuffer(rawBytes, {
            folderName: file.name,
            levelNameTxt: null,
            sourceType: 'leveldat',
            lastModified: file.lastModified,
          })
        );
      }
    }

    if (imported.length > 0) {
      setWorlds((prev) => sortBedrockWorlds([...imported, ...prev]));
      appendLog(
        imported.map((i) => i.worldName).join(', '),
        'Arquivo(s) Importado(s)',
        `${imported.length} arquivo(s) lido(s) pelo parser binário NBT.`,
        'import'
      );
      setFeedbackBanner({
        type: 'success',
        message: `📦 ${imported.length} arquivo(s) importado(s) e analisado(s) pelo motor binário NBT!`,
      });
    } else {
      setFeedbackBanner({
        type: 'warning',
        message:
          'Não foi possível localizar um level.dat válido no arquivo enviado.',
      });
    }
  };

  // Handle folder upload via webkitdirectory
  const handleFolderUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const folderGroups = new Map<
      string,
      { levelDatFile?: File; levelNameTxtFile?: File }
    >();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const relPath = f.webkitRelativePath || f.name;
      const parts = relPath.split('/');
      const fileName = parts[parts.length - 1].toLowerCase();
      const parentFolder =
        parts.length >= 2 ? parts[parts.length - 2] : 'Mundo_Importado';

      if (fileName === 'level.dat') {
        const group = folderGroups.get(parentFolder) || {};
        group.levelDatFile = f;
        folderGroups.set(parentFolder, group);
      } else if (fileName === 'levelname.txt') {
        const group = folderGroups.get(parentFolder) || {};
        group.levelNameTxtFile = f;
        folderGroups.set(parentFolder, group);
      }
    }

    const parsedWorlds: BedrockWorldEntry[] = [];
    for (const [folderName, group] of folderGroups.entries()) {
      if (!group.levelDatFile) continue;
      const buf = new Uint8Array(await group.levelDatFile.arrayBuffer());
      let txtName: string | null = null;
      if (group.levelNameTxtFile) {
        txtName = (await group.levelNameTxtFile.text()).trim();
      }
      parsedWorlds.push(
        inspectLevelDatBuffer(buf, {
          folderName,
          levelNameTxt: txtName,
          sourceType: 'folder',
          lastModified: group.levelDatFile.lastModified,
        })
      );
    }

    if (parsedWorlds.length > 0) {
      const rootName =
        files[0].webkitRelativePath.split('/')[0] || 'minecraftWorlds';
      setCurrentFolderPath(`Pasta Local Selecionada: ${rootName}`);
      setWorlds(sortBedrockWorlds(parsedWorlds));
      appendLog(
        rootName,
        'Pasta minecraftWorlds Escaneada',
        `${parsedWorlds.length} mundo(s) carregado(s) com leitura de level.dat e levelname.txt.`,
        'import'
      );
      setFeedbackBanner({
        type: 'success',
        message: `📂 ${parsedWorlds.length} mundo(s) lido(s) da pasta "${rootName}" com sucesso!`,
      });
    } else {
      setFeedbackBanner({
        type: 'warning',
        message:
          'Nenhum arquivo level.dat foi encontrado dentro da pasta selecionada. Escolha a pasta minecraftWorlds ou a pasta do mundo.',
      });
    }
    e.target.value = '';
  };

  const handleSingleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFileList(e.target.files);
    }
    e.target.value = '';
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFileList(e.dataTransfer.files);
    }
  };

  // Connect live folder via File System Access API (showDirectoryPicker)
  const handleConnectLiveFolder = async () => {
    const win = window as any;
    if (typeof win.showDirectoryPicker !== 'function') {
      folderInputRef.current?.click();
      return;
    }

    try {
      const dirHandle = await win.showDirectoryPicker({ mode: 'readwrite' });
      liveDirHandleRef.current = dirHandle;
      setCurrentFolderPath(`Vínculo Direto Ativo: ${dirHandle.name}`);
      const scanned = await scanLiveDirectoryHandle(dirHandle);
      if (scanned.length > 0) {
        setWorlds(scanned);
        appendLog(
          dirHandle.name,
          'Vínculo Direto FileSystem Ativo',
          `${scanned.length} mundo(s) sincronizado(s) com gravação direta e backup level.dat.bak.`,
          'import'
        );
        setFeedbackBanner({
          type: 'success',
          message: `🔗 Pasta "${dirHandle.name}" vinculada em tempo real! ${scanned.length} mundo(s) carregado(s) com gravação direta e backup automático.`,
        });
      } else {
        setFeedbackBanner({
          type: 'warning',
          message: `Pasta "${dirHandle.name}" vinculada, mas nenhum subdiretório com level.dat foi encontrado ainda.`,
        });
      }
    } catch {
      folderInputRef.current?.click();
    }
  };

  // Simulate creating a brand new world in Minecraft while the tool is open
  const handleSimulateNewWorldInGame = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const folderHash = `nW9_${randomId}kLp=`;
    const worldTitle = `Novo Mundo Criado Agora #${randomId} (Criativo + Experimental)`;
    const randomSeedBig = BigInt(
      Math.floor(Math.random() * 9000000000000000) - 4500000000000000
    );

    const bytes = buildBinaryBedrockLevelDat({
      levelName: worldTitle,
      gameType: 1,
      difficulty: 3,
      isHardcore: 1,
      daysPlayed: Math.floor(Math.random() * 150) + 15,
      randomSeed: randomSeedBig,
      spawnX: Math.floor(Math.random() * 500) - 250,
      spawnY: 72,
      spawnZ: Math.floor(Math.random() * 500) - 250,
      worldTime: 18000n,
      rainLevel: 1.0,
      hasBeenLoadedInCreative: 1,
      commandsEnabled: 1,
      cheatsEnabled: 1,
      ForceGameType: 1,
      experiments: {
        experiments_ever_used: 1,
        saved_with_toggled_experiments: 1,
        upcoming_creator_features: 1,
      },
    });

    const newEntry = inspectLevelDatBuffer(bytes, {
      folderName: folderHash,
      levelNameTxt: null,
      sourceType: 'sample',
      lastModified: Date.now(),
    });

    setWorlds((prev) => sortBedrockWorlds([newEntry, ...prev]));
    setLastRefreshTime(new Date().toLocaleTimeString('pt-BR'));
    appendLog(
      newEntry.worldName,
      'Novo Mundo Detectado no Jogo',
      `Extraído de ${folderHash}/level.dat (${newEntry.daysPlayed} dias jogados · Seed: ${newEntry.randomSeed}).`,
      'import'
    );
    setFeedbackBanner({
      type: 'info',
      message: `✨ Novo mundo detectado ("${newEntry.nbtLevelName}" · ${newEntry.daysPlayed} dias jogados) lido da tag NBT LevelName do level.dat e posicionado no topo em VERMELHO!`,
    });
  };

  // Filtered worlds for table display
  const filteredWorlds = useMemo(() => {
    return worlds.filter((w) => {
      if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = w.worldName.toLowerCase().includes(q);
        const matchFolder = w.folderName.toLowerCase().includes(q);
        const matchSeed = w.randomSeed.toLowerCase().includes(q);
        return matchName || matchFolder || matchSeed;
      }
      return true;
    });
  }, [worlds, statusFilter, searchQuery]);

  return (
    <div
      className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDropFiles}
    >
      {/* Hidden File Inputs */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is standard in modern browsers for directory selection
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFolderUpload}
        className="hidden"
      />
      <input
        ref={singleFileInputRef}
        type="file"
        accept=".dat,.mcworld,.zip"
        multiple
        onChange={handleSingleFileUpload}
        className="hidden"
      />

      {/* 1. TOP BAR CONTRACT (3 Zones: Brand Wordmark — 4 Nav Links — 1 Primary Action) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-[#1E293B] bg-[#0B0F19]/95 px-6 py-3.5 backdrop-blur-md">
        <a
          href="#top"
          className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Reativador de Conquistas — Minecraft Bedrock
        </a>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          <a
            href="#escaneador"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Escaneador de Mapas
          </a>
          <a
            href="#motor-nbt"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Motor Binário NBT & Dias
          </a>
          <a
            href="#downloads-windows"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Programa Windows (.EXE)
          </a>
          <a
            href="#atalhos-caminhos"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Caminhos UWP & GDK
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleRefreshWorlds(false)}
            className="flex items-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
            🔄 ATUALIZAR MAPAS (F5)
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE CONTAINER */}
      <main
        id="top"
        className="mx-auto w-full max-w-[1380px] flex-1 px-4 sm:px-6 py-6 space-y-6"
      >
        {/* HERO / IDENTITY HEADER */}
        <section className="rounded-xl border border-[#1E293B] bg-[#111827] p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-3 shrink-0">
                <TrophyBrandIcon size={52} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Versão 4.0 SUPREME · Bedrock 1.21.50 até 1.21.80+</span>
                  <span aria-hidden="true">·</span>
                  <span>Windows (UWP & GDK), Android e iOS</span>
                  <span aria-hidden="true">·</span>
                  <span>Preserva Construções, Inventário e Chunks</span>
                </div>
                <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Reativador de Conquistas Xbox Live, Aumentador de Dias Jogados & Editor NBT
                </h1>
                <p className="mt-1.5 text-sm text-slate-300 max-w-3xl leading-relaxed">
                  Reative conquistas bloqueadas por Criativo ou Cheats, remova o selo{' '}
                  <code className="font-mono text-[#F59E0B]">[Experimental]</code>,{' '}
                  <strong className="text-[#F59E0B]">aumente os Dias Jogados do mundo</strong> (com contador{' '}
                  <code className="font-mono text-[#10B981]">showdaysplayed = 1</code>), ajuste{' '}
                  <code className="font-mono text-[#0EA5E9]">TickSpeed, 1-Player Sleep, Spawn X/Y/Z, Clima e Seed</code> sem perder conquistas!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href="#downloads-windows"
                className="flex items-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4 shrink-0" />
                Baixar Programa Desktop v4.0 (.EXE / .BAT)
              </a>
              <button
                onClick={handleSimulateNewWorldInGame}
                className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#0B0F19] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-[#0EA5E9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-[#0EA5E9] shrink-0" />
                Simular Novo Mapa no Jogo
              </button>
            </div>
          </div>
        </section>

        {/* 2. 4 CARDS DE RESUMO (KPIs) NO TOPO */}
        <section
          aria-label="Resumo de Mundos"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
            <span className="text-xs font-semibold text-slate-400 block">
              1. TOTAL DE MUNDOS
            </span>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold font-mono tabular-nums text-[#0EA5E9]">
                {kpiStats.total}
              </span>
              <span className="text-xs text-slate-400">na pasta atual</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
            <span className="text-xs font-semibold text-slate-400 block">
              2. MARCADOS COM [✔]
            </span>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold font-mono tabular-nums text-[#F59E0B]">
                {kpiStats.selected}
              </span>
              <span className="text-xs text-slate-400">prontos para aplicar</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
            <span className="text-xs font-semibold text-slate-400 block">
              3. SEM CONQUISTAS (VERMELHO)
            </span>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold font-mono tabular-nums text-[#EF4444]">
                {kpiStats.blockedRed}
              </span>
              <span className="text-xs text-red-300/80">bloqueados / criativo</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
            <span className="text-xs font-semibold text-slate-400 block">
              4. CONQUISTAS ATIVAS (VERDE)
            </span>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-3xl font-bold font-mono tabular-nums text-[#10B981]">
                {kpiStats.activeGreen}
              </span>
              <span className="text-xs text-emerald-300/80">100% liberados</span>
            </div>
          </div>
        </section>

        {/* 3. ESCANEADOR WEB & BARRA DA PASTA minecraftWorlds */}
        <section
          id="escaneador"
          className={`rounded-xl border transition-colors bg-[#111827] overflow-hidden ${
            isDraggingOver
              ? 'border-[#0EA5E9] ring-2 ring-[#0EA5E9]/30'
              : 'border-[#1E293B]'
          }`}
        >
          {/* Folder Path Bar */}
          <div className="border-b border-[#1E293B] bg-[#0B0F19]/60 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <label
                  htmlFor="folder-path-input"
                  className="text-xs font-semibold text-slate-400 flex items-center gap-2"
                >
                  <HardDrive className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  <span>
                    CAMINHO DA PASTA <code className="font-mono text-slate-200">minecraftWorlds</code> (UWP / GDK) OU ARRASTE ARQUIVOS (.mcworld, .zip, level.dat):
                  </span>
                </label>
                <div className="mt-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    id="folder-path-input"
                    type="text"
                    value={currentFolderPath}
                    onChange={(e) => setCurrentFolderPath(e.target.value)}
                    className="flex-1 rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3.5 py-2 text-xs font-mono text-slate-200 focus:border-[#0EA5E9] focus:outline-none"
                    placeholder="Cole o caminho da pasta minecraftWorlds..."
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => folderInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#0EA5E9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-[#0EA5E9]" />
                      📂 Ler Pasta minecraftWorlds
                    </button>

                    <button
                      onClick={handleConnectLiveFolder}
                      className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-[#10B981] hover:border-[#10B981] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      🔗 Vincular Pasta Direta
                    </button>

                    <button
                      onClick={() => singleFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-[#F59E0B] hover:border-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      📦 Abrir .mcworld / .zip / level.dat
                    </button>

                    <button
                      onClick={() => handleRefreshWorlds(false)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#0EA5E9] px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          isRefreshing ? 'animate-spin' : ''
                        }`}
                      />
                      🔄 ATUALIZAR MAPAS (F5)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-Monitor & Quick Path Presets Row */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2 border-t border-[#1E293B]/60 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-[#0EA5E9] font-semibold">
                <input
                  type="checkbox"
                  checked={autoWatchNewWorlds}
                  onChange={(e) => setAutoWatchNewWorlds(e.target.checked)}
                  className="h-4 w-4 rounded border-[#1E293B] bg-[#0B0F19] accent-[#0EA5E9]"
                />
                <span>
                  🔄 Atualizar Sozinho ao Criar Novo Mapa no Jogo (Monitor Automático a cada 3s · Leitura level.dat + levelname.txt)
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2 text-slate-400">
                <button
                  onClick={() => setCurrentFolderPath(UWP_MINECRAFT_PATH)}
                  className="hover:text-white underline underline-offset-2 cursor-pointer whitespace-nowrap"
                >
                  Usar Caminho UWP
                </button>
                <span aria-hidden="true">·</span>
                <button
                  onClick={() => setCurrentFolderPath(GDK_MINECRAFT_PATH)}
                  className="hover:text-white underline underline-offset-2 cursor-pointer whitespace-nowrap"
                >
                  Usar Caminho GDK
                </button>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-400">
                  Última sincronização: {lastRefreshTime}
                </span>
              </div>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedbackBanner && (
            <div
              className={`flex items-center justify-between gap-3 px-5 py-3 text-xs font-medium border-b border-[#1E293B] ${
                feedbackBanner.type === 'success'
                  ? 'bg-[#10B981]/15 text-emerald-200'
                  : feedbackBanner.type === 'warning'
                  ? 'bg-[#F59E0B]/15 text-amber-200'
                  : 'bg-[#0EA5E9]/15 text-sky-200'
              }`}
            >
              <span>{feedbackBanner.message}</span>
              <button
                onClick={() => setFeedbackBanner(null)}
                className="text-xs font-bold underline hover:text-white shrink-0"
              >
                OK
              </button>
            </div>
          )}

          {/* Batch Selection Bar + Auto-Apply Toggle + Search/Filter */}
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-[#1E293B] bg-[#111827] px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkSelection('ALL')}
                className="rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                ☑️ Marcar Todos
              </button>

              <button
                onClick={() => handleBulkSelection('RED_ONLY')}
                className="rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/15 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-[#EF4444]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                🔴 Marcar Só os Vermelhos (Sem Conquista)
              </button>

              <button
                onClick={() => handleBulkSelection('NONE')}
                className="rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Desmarcar Todos
              </button>

              <label className="ml-1 flex items-center gap-2 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-3 py-1.5 text-xs font-bold text-[#10B981] cursor-pointer select-none whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={autoApplyOnCheck}
                  onChange={(e) => handleToggleAutoApplyMode(e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[#10B981]"
                />
                <span>⚡ Fazer Automático ao Marcar [✔]</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 rounded-lg border border-[#1E293B] bg-[#0B0F19] p-1">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-[#1E293B] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({worlds.length})
                </button>
                <button
                  onClick={() =>
                    setStatusFilter(WorldAchievementStatus.BlockedRed)
                  }
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === WorldAchievementStatus.BlockedRed
                      ? 'bg-[#EF4444]/25 text-red-200'
                      : 'text-slate-400 hover:text-red-300'
                  }`}
                >
                  🔴 Sem Conquistas ({kpiStats.blockedRed})
                </button>
                <button
                  onClick={() =>
                    setStatusFilter(WorldAchievementStatus.ActiveGreen)
                  }
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === WorldAchievementStatus.ActiveGreen
                      ? 'bg-[#10B981]/25 text-emerald-200'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  🟢 Ativas ({kpiStats.activeGreen})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar nome ou seed..."
                  className="rounded-lg border border-[#1E293B] bg-[#0B0F19] pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:border-[#0EA5E9] focus:outline-none w-52"
                />
              </div>
            </div>
          </div>

          {/* WORLDS DATA TABLE WITH RED / YELLOW / GREEN HIGHLIGHTING */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#0B0F19] text-[11px] font-bold text-slate-400">
                  <th className="py-3 px-4 w-12 text-center">[✔]</th>
                  <th className="py-3 px-4">
                    MUNDO · DIAS JOGADOS · SEED · SPAWN
                  </th>
                  <th className="py-3 px-4">STATUS DE CONQUISTAS</th>
                  <th className="py-3 px-4">
                    DIAGNÓSTICO BINÁRIO NBT (level.dat)
                  </th>
                  <th className="py-3 px-4 text-right">PASTA / MODIFICADO</th>
                  <th className="py-3 px-4 text-right">
                    AÇÕES, +DIAS, CLONAR & EDITOR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B] text-xs">
                {filteredWorlds.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 px-6 text-center text-slate-400"
                    >
                      Nenhum mundo encontrado para o filtro selecionado. Clique em{' '}
                      <button
                        onClick={() => setStatusFilter('ALL')}
                        className="text-[#0EA5E9] underline font-semibold"
                      >
                        Mostrar Todos
                      </button>{' '}
                      ou carregue sua pasta <code className="font-mono">minecraftWorlds</code>.
                    </td>
                  </tr>
                ) : (
                  filteredWorlds.map((world) => {
                    const isRed =
                      world.status === WorldAchievementStatus.BlockedRed;
                    const isYellow =
                      world.status ===
                      WorldAchievementStatus.ExperimentalYellow;
                    const playtime = calculateRealPlaytime(world.daysPlayed);
                    const milestone = getSurvivalMilestone(world.daysPlayed);

                    const activeFlagsList: string[] = [];
                    if (world.hasBeenLoadedInCreative)
                      activeFlagsList.push('hasBeenLoadedInCreative=1');
                    if (world.commandsEnabled)
                      activeFlagsList.push('commandsEnabled=1');
                    if (world.cheatsEnabled)
                      activeFlagsList.push('cheatsEnabled=1');
                    if (world.gameType === 1)
                      activeFlagsList.push('GameType=1 (Criativo)');
                    if (world.gameType === 6)
                      activeFlagsList.push('GameType=6 (Espectador - Morte)');
                    if (world.forceGameType)
                      activeFlagsList.push('ForceGameType=1');
                    if (world.activeExperimentFlags.length > 0) {
                      activeFlagsList.push(
                        `experiments (${world.activeExperimentFlags.length}): ${world.activeExperimentFlags
                          .slice(0, 2)
                          .join(', ')}`
                      );
                    }
                    if (world.activeTemplateLockFlags.length > 0) {
                      activeFlagsList.push(
                        `templateLock (${world.activeTemplateLockFlags.length})`
                      );
                    }

                    const diffName =
                      world.difficulty === 0
                        ? 'Pacífico'
                        : world.difficulty === 1
                        ? 'Fácil'
                        : world.difficulty === 3
                        ? 'Difícil'
                        : 'Normal';

                    const timeTicks =
                      ((world.worldTime % 24000) + 24000) % 24000;
                    const isNight = timeTicks >= 13000 && timeTicks <= 23000;
                    const weatherBadge =
                      world.lightningLevel > 0.2
                        ? '⛈️ Tempestade'
                        : world.rainLevel > 0.2
                        ? '🌧️ Chuva'
                        : isNight
                        ? '🌙 Noite'
                        : '☀️ Dia';

                    return (
                      <tr
                        key={world.id}
                        className={`transition-colors border-b ${
                          isRed
                            ? 'border-red-900/60 hover:bg-[#3D141C] text-red-50'
                            : isYellow
                            ? 'border-amber-900/60 hover:bg-[#34240E] text-amber-50'
                            : 'border-emerald-900/60 hover:bg-[#102B20] text-emerald-50'
                        }`}
                        style={{
                          backgroundColor: isRed
                            ? '#2E0F15'
                            : isYellow
                            ? '#261B0B'
                            : '#0B1E16',
                          borderLeft: isRed
                            ? '6px solid #EF4444'
                            : isYellow
                            ? '6px solid #F59E0B'
                            : '6px solid #10B981',
                        }}
                      >
                        {/* Checkbox [✔] with Red Indicator Dot */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="checkbox"
                              checked={world.selected}
                              onChange={() =>
                                handleToggleWorldSelection(world.id)
                              }
                              aria-label={`Marcar mundo ${world.worldName}`}
                              className="h-4 w-4 rounded border-[#1E293B] bg-[#0B0F19] accent-[#10B981] cursor-pointer"
                            />
                            {isRed && (
                              <span
                                className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#EF4444] animate-pulse shrink-0"
                                title="Mundo sem conquistas (bloqueado)"
                              />
                            )}
                          </div>
                        </td>

                        {/* World Name, Days Played, Seed, Spawn, Weather & Gamerules */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">
                              {world.worldName}
                            </span>
                            {isRed && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600/35 border border-red-500 text-red-200 uppercase tracking-wider shadow-sm">
                                🔴 Sem Conquistas
                              </span>
                            )}
                            {world.isHardcore && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-900/70 border border-purple-500 text-purple-200">
                                <Skull className="w-3 h-3 text-purple-300" /> Hardcore (1 Vida)
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-300">
                            <span className="text-[#F59E0B] font-bold">
                              📅 {world.daysPlayed} dias ({playtime.text})
                            </span>
                            <span aria-hidden="true" className="text-slate-500">·</span>
                            <span className="text-amber-300 font-semibold">
                              {milestone.badge}
                            </span>
                            <span aria-hidden="true" className="text-slate-500">·</span>
                            <span>
                              {world.gameType === 1
                                ? 'Criativo'
                                : world.gameType === 2
                                ? 'Aventura'
                                : world.gameType === 6
                                ? '💀 Espectador'
                                : 'Sobrevivência'}{' '}
                              ({diffName})
                            </span>
                            <span aria-hidden="true" className="text-slate-500">·</span>
                            <button
                              onClick={() => handleCopySeed(world)}
                              className="inline-flex items-center gap-1 text-[#0EA5E9] hover:underline cursor-pointer"
                              title="Clique para copiar a Seed deste mundo"
                            >
                              <span>Seed: {world.randomSeed}</span>
                              {copiedSeedWorldId === world.id ? (
                                <Check className="w-3 h-3 text-[#10B981]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <span aria-hidden="true" className="text-slate-500">·</span>
                            <span className="text-slate-400">
                              Spawn({world.spawnX}, {world.spawnY}, {world.spawnZ})
                            </span>
                            <span aria-hidden="true" className="text-slate-500">·</span>
                            <span className="text-slate-300">{weatherBadge}</span>
                            {world.keepInventory && (
                              <>
                                <span aria-hidden="true" className="text-slate-500">·</span>
                                <span className="text-[#10B981] font-semibold">
                                  KeepInv=1
                                </span>
                              </>
                            )}
                            {world.backupLevelDatBytes && (
                              <>
                                <span aria-hidden="true" className="text-slate-500">·</span>
                                <span className="text-[#F59E0B] font-semibold">
                                  .bak Ativo
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Status Column (Ultra-Vivid Badges) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isRed && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/35 border-2 border-red-500 text-red-100 font-black text-xs shadow-[0_0_15px_rgba(239,68,68,0.45)]">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-sm animate-ping" />
                              🔴 SEM CONQUISTAS (Bloqueado)
                            </div>
                          )}
                          {isYellow && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/25 border-2 border-amber-500 text-amber-100 font-black text-xs shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 shadow-sm" />
                              ⚠️ EXPERIMENTAL ATIVO
                            </div>
                          )}
                          {!isRed && !isYellow && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/25 border-2 border-emerald-500 text-emerald-100 font-black text-xs shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 shadow-sm" />
                              🟢 CONQUISTAS ATIVAS
                            </div>
                          )}
                        </td>

                        {/* Binary NBT Flags Detected */}
                        <td className="py-3.5 px-4 font-mono tabular-nums">
                          {activeFlagsList.length > 0 ? (
                            <span
                              className={
                                isRed ? 'text-red-200 font-bold' : 'text-amber-200'
                              }
                            >
                              {activeFlagsList.join(' · ')}
                            </span>
                          ) : (
                            <span className="text-emerald-200">
                              hasBeenLoadedInCreative=0 · commandsEnabled=0 · showdaysplayed={world.showDaysPlayed ? 1 : 0}
                            </span>
                          )}
                        </td>

                        {/* Folder & Timestamp */}
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          <div>{world.folderName}</div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(world.lastModified).toLocaleString(
                              'pt-BR',
                              {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </div>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {world.isHardcore ? (
                              <button
                                onClick={() => handleToggleHardcore(world.id, false)}
                                className="rounded-md border border-purple-500/60 bg-purple-950/70 px-2 py-1.5 text-xs font-bold text-purple-200 hover:border-purple-400 hover:bg-purple-900 transition-colors cursor-pointer"
                                title="Desativar Hardcore e reviver caso tenha morrido (restaura Sobrevivência com vidas ilimitadas)"
                              >
                                💖 Tirar Hardcore
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleHardcore(world.id, true)}
                                className="rounded-md border border-purple-500/60 bg-[#0B0F19] px-2 py-1.5 text-xs font-bold text-purple-300 hover:border-purple-400 hover:bg-purple-950/60 transition-colors cursor-pointer"
                                title="Colocar em Modo Hardcore Oficial (1 Vida / Dificuldade Difícil / Conquistas Ativas)"
                              >
                                💀 Hardcore
                              </button>
                            )}

                            <button
                              onClick={() => handleQuickAddDays(world.id, 100)}
                              className="rounded-md border border-[#F59E0B]/40 bg-[#0B0F19] px-2 py-1.5 text-xs font-bold text-[#F59E0B] hover:border-[#F59E0B] transition-colors cursor-pointer"
                              title="Adicionar +100 Dias Jogados neste mundo e ativar showdaysplayed=1"
                            >
                              📅 +100 Dias
                            </button>

                            <button
                              onClick={() => setInspectingWorldId(world.id)}
                              className="rounded-md border border-[#1E293B] bg-[#0B0F19] px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-[#0EA5E9] transition-colors cursor-pointer"
                              title="Abrir Editor de Dias Jogados, Hardcore, Spawn, Clima, Gamerules & Hex Diff"
                            >
                              <FileCode2 className="w-3.5 h-3.5 inline mr-1 text-[#0EA5E9]" />
                              Editar / Dias
                            </button>

                            <button
                              onClick={() => handleCloneWorld(world.id)}
                              className="rounded-md border border-[#1E293B] bg-[#0B0F19] px-2.5 py-1.5 text-xs font-semibold text-[#0EA5E9] hover:border-[#0EA5E9] transition-colors cursor-pointer"
                              title="Clonar este mundo em uma nova pasta já com Conquistas Ativas"
                            >
                              <CopyPlus className="w-3.5 h-3.5 inline mr-1" />
                              Clonar
                            </button>

                            <button
                              onClick={() => handleDownloadLevelDat(world)}
                              className="rounded-md border border-[#1E293B] bg-[#0B0F19] px-2 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors cursor-pointer"
                              title="Baixar arquivo level.dat corrigido"
                            >
                              level.dat
                            </button>

                            <button
                              onClick={() => handleDownloadMcworld(world)}
                              className="rounded-md border border-[#1E293B] bg-[#0B0F19] px-2 py-1.5 text-xs font-semibold text-[#F59E0B] hover:border-[#F59E0B]/60 transition-colors cursor-pointer"
                              title="Baixar pacote .mcworld pronto para importar no Minecraft"
                            >
                              .mcworld
                            </button>

                            {world.backupLevelDatBytes && (
                              <button
                                onClick={() => handleRestoreBackup(world.id)}
                                className="rounded-md border border-[#1E293B] bg-[#0B0F19] px-2 py-1.5 text-xs font-semibold text-amber-300 hover:border-amber-400 transition-colors cursor-pointer"
                                title="Restaurar level.dat.bak original"
                              >
                                <RotateCcw className="w-3.5 h-3.5 inline" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 4. BARRA DE AÇÕES INFERIOR + MOTOR DE PATCH BINÁRIO NBT & AUMENTADOR DE DIAS JOGADOS */}
          <div
            id="motor-nbt"
            className="border-t border-[#1E293B] bg-[#0B0F19] p-5 space-y-4"
          >
            {/* Batch Days Played Booster Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#111827] px-4 py-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <div>
                  <span className="font-bold text-white">
                    📅 Aumentar Dias Jogados em Lote nos Mapas Marcados [✔]:
                  </span>
                  <span className="text-slate-400 ml-2">
                    Soma dias extras na tag <code className="font-mono text-[#F59E0B]">Time</code> e <code className="font-mono text-[#F59E0B]">currentTick</code> (24.000 ticks/dia) ao clicar em Aplicar
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: 'Manter Dias Atuais (+0)', val: 0 },
                  { label: '+100 Dias', val: 100 },
                  { label: '+365 Dias (1 Ano)', val: 365 },
                  { label: '+1.000 Dias', val: 1000 },
                  { label: '+5.000 Dias', val: 5000 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() =>
                      setPatchOptions((prev) => ({
                        ...prev,
                        bonusDaysToAdd: opt.val,
                      }))
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      patchOptions.bonusDaysToAdd === opt.val
                        ? 'border-[#F59E0B] bg-[#F59E0B]/20 text-[#F59E0B]'
                        : 'border-[#1E293B] bg-[#0B0F19] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.reactivateAchievements}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      reactivateAchievements: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#10B981]"
                />
                <div>
                  <span className="font-bold text-white block">
                    🏆 Reativar Conquistas + Sobrevivência
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    {ACHIEVEMENT_ZERO_KEYS.slice(0, 3).join('=0, ')}=0, GameType=0
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.disableExperiments}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      disableExperiments: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#10B981]"
                />
                <div>
                  <span className="font-bold text-white block">
                    🧪 Remover Selo [Experimental]
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    Zera {EXPERIMENT_ZERO_KEYS.length} chaves experiments_ever_used=0
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.unlockTemplates}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      unlockTemplates: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#10B981]"
                />
                <div>
                  <span className="font-bold text-white block">
                    🔓 Desbloquear Templates / Marketplace
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    Zera {TEMPLATE_LOCK_ZERO_KEYS.length} travas hasLockedPacks=0
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.enableShowDaysPlayedSafe}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      enableShowDaysPlayedSafe: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#F59E0B]"
                />
                <div>
                  <span className="font-bold text-[#F59E0B] block">
                    📅 Mostrar Dias Jogados na Tela (showdaysplayed = 1)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    Exibe o contador "Dias jogados" sem perder conquistas
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.enableKeepInventorySafe}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      enableKeepInventorySafe: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#10B981]"
                />
                <div>
                  <span className="font-bold text-[#10B981] block">
                    🎒 Ativar KeepInventory (Sem Perder Conquistas)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    Grava keepinventory = 1 mantendo commandsEnabled = 0
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.enableShowCoordinatesSafe}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      enableShowCoordinatesSafe: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#0EA5E9]"
                />
                <div>
                  <span className="font-bold text-[#0EA5E9] block">
                    📍 Mostrar Coordenadas (showcoordinates = 1)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    Exibe X, Y, Z na tela sem desativar conquistas
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-purple-500/40 bg-purple-950/20 p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(patchOptions.enableHardcoreMode)}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      enableHardcoreMode: e.target.checked,
                      disableHardcoreLock: !e.target.checked && prev.disableHardcoreLock,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-purple-500"
                />
                <div>
                  <span className="font-bold text-purple-300 block">
                    💀 Modo Hardcore Oficial (Bedrock 1.21+)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    IsHardcore = 1, Dificuldade = 3 (Difícil) e 1 vida única
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.disableHardcoreLock}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      disableHardcoreLock: e.target.checked,
                      enableHardcoreMode: !e.target.checked && prev.enableHardcoreMode,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#EF4444]"
                />
                <div>
                  <span className="font-bold text-white block">
                    💖 Desativar Hardcore / Reviver Espectador
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    IsHardcore = 0 e GameType = 0 (revive de mortes no hardcore)
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.onePlayerSleepSafe}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      onePlayerSleepSafe: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#0EA5E9]"
                />
                <div>
                  <span className="font-bold text-white block">
                    🛏️ 1 Jogador Dorme e Pula a Noite (Multiplayer)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    Define playerssleepingpercentage = 1% no level.dat
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#1E293B] bg-[#111827] p-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={patchOptions.createAutoBackup}
                  onChange={(e) =>
                    setPatchOptions((prev) => ({
                      ...prev,
                      createAutoBackup: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[#F59E0B]"
                />
                <div>
                  <span className="font-bold text-[#F59E0B] block">
                    🛡️ Backup Automático (level.dat.bak)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Salva cópia binária exata antes de aplicar
                  </span>
                </div>
              </label>
            </div>

            {/* Bottom Primary CTA + Hardcore Batch Buttons + Refresh Button + Batch Export ZIP Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleApplyPatchToSelected()}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#10B981] px-6 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-[#10B981]/10"
                >
                  <Check className="w-4 h-4 stroke-[3] shrink-0" />
                  ✔ APLICAR NOS MAPAS MARCADOS [✔] ({kpiStats.selected})
                  {patchOptions.bonusDaysToAdd > 0
                    ? ` +${patchOptions.bonusDaysToAdd} DIAS`
                    : ''}
                </button>

                <button
                  onClick={() => handleBatchSetHardcore(true)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-purple-500/60 bg-purple-950/60 px-4 py-3 text-xs font-bold text-purple-200 hover:bg-purple-900/80 hover:border-purple-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Converter todos os mundos marcados com [✔] para Modo Hardcore Oficial (1 Vida / Dificuldade Difícil)"
                >
                  <Skull className="w-4 h-4 text-purple-400 shrink-0" />
                  💀 ATIVAR HARDCORE NOS MARCADOS ({kpiStats.selected})
                </button>

                <button
                  onClick={() => handleBatchSetHardcore(false)}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/60 bg-emerald-950/40 px-4 py-3 text-xs font-bold text-emerald-200 hover:bg-emerald-900/60 hover:border-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Desativar Hardcore e reviver jogadores que morreram em todos os mundos marcados"
                >
                  <Heart className="w-4 h-4 text-emerald-400 shrink-0" />
                  💖 REVIVER / TIRAR HARDCORE ({kpiStats.selected})
                </button>

                <button
                  onClick={() => handleRefreshWorlds(false)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-3 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-4 h-4 shrink-0 ${
                      isRefreshing ? 'animate-spin' : ''
                    }`}
                  />
                  🔄 ATUALIZAR (F5)
                </button>

                <button
                  onClick={handleDownloadAllWorldsZip}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[#1E293B] bg-[#111827] px-4 py-3 text-xs font-bold text-[#F59E0B] hover:border-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileArchive className="w-4 h-4 shrink-0" />
                  📥 Baixar Todos em .ZIP ({worlds.length})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0" />
                <span>
                  Cabeçalho Little-Endian 8-bytes preservado · 100% seguro para construções e inventário
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. HISTÓRICO DE OPERAÇÕES BINÁRIAS EM TEMPO REAL */}
        <section className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#0EA5E9]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Histórico de Operações Binárias em Tempo Real ({operationLogs.length})
              </h2>
            </div>
            {operationLogs.length > 1 && (
              <button
                onClick={() => setOperationLogs((prev) => prev.slice(0, 1))}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Limpar Histórico
              </button>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
            {operationLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-lg border border-[#1E293B] bg-[#0B0F19] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 tabular-nums">[{log.time}]</span>
                  <span
                    className={`font-bold ${
                      log.type === 'patch'
                        ? 'text-[#10B981]'
                        : log.type === 'clone'
                        ? 'text-[#0EA5E9]'
                        : log.type === 'restore'
                        ? 'text-[#F59E0B]'
                        : 'text-slate-200'
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="text-white font-semibold">
                    — {log.worldName}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">{log.details}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 6. CENTRAL DE DOWNLOADS DO PROGRAMA WINDOWS (.EXE, .BAT, .ZIP E .ICO) */}
        <WindowsDownloadCenter />
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#1E293B] bg-[#0B0F19] px-6 py-5 text-xs text-slate-400">
        <div className="mx-auto max-w-[1380px] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            Reativador de Conquistas — Minecraft Bedrock v4.0 SUPREME (Compatível com 1.21.50 até 1.21.80+ no Windows, Android e iOS)
          </div>
          <div className="flex items-center gap-4">
            <a href="#escaneador" className="hover:text-white transition-colors">
              Escaneador Web
            </a>
            <a
              href="#downloads-windows"
              className="hover:text-white transition-colors"
            >
              Baixar .EXE / .BAT
            </a>
            <a
              href="/downloads/reativador.ico"
              download="reativador.ico"
              className="hover:text-[#F59E0B] transition-colors"
            >
              reativador.ico
            </a>
          </div>
        </div>
      </footer>

      {/* Binary NBT Inspector, Days Played Editor & Hex Diff Modal */}
      <NbtInspectorModal
        world={inspectingWorld}
        onClose={() => setInspectingWorldId(null)}
        onPatchSingleWorld={handlePatchSingleWorld}
        onCloneWorld={handleCloneWorld}
        onRestoreBackup={handleRestoreBackup}
        onDownloadLevelDat={handleDownloadLevelDat}
        onDownloadMcworld={handleDownloadMcworld}
      />
    </div>
  );
}
