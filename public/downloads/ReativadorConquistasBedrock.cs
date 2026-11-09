using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

[assembly: AssemblyTitle("Reativador de Conquistas — Minecraft Bedrock")]
[assembly: AssemblyDescription("Utilitario para reativar conquistas Xbox Live, converter Modo Hardcore e editar Dias Jogados em mundos do Minecraft Bedrock (level.dat).")]
[assembly: AssemblyConfiguration("Release")]
[assembly: AssemblyCompany("Reativador Conquistas Bedrock Open-Source")]
[assembly: AssemblyProduct("Reativador de Conquistas — Minecraft Bedrock v5.0 TITAN")]
[assembly: AssemblyCopyright("Copyright (C) 2026 - Codigo Aberto Auditavel (MIT License)")]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]
[assembly: ComVisible(false)]
[assembly: Guid("4de07380-721e-4da6-998b-b1e8719ca8a9")]
[assembly: AssemblyVersion("5.0.0.0")]
[assembly: AssemblyFileVersion("5.0.0.0")]

namespace ReativadorConquistasBedrock
{
    public enum WorldStatus
    {
        BlockedRed = 0,
        ExperimentalYellow = 1,
        ActiveGreen = 2
    }

    public class BedrockWorldInfo
    {
        public bool Selected { get; set; }
        public string WorldName { get; set; }
        public string FolderName { get; set; }
        public string FolderPath { get; set; }
        public string LevelDatPath { get; set; }
        public DateTime LastModified { get; set; }
        public WorldStatus Status { get; set; }
        public string StatusText { get; set; }
        public string DetailsText { get; set; }
        public int GameType { get; set; }
        public int Difficulty { get; set; }
        public bool IsHardcore { get; set; }
        public bool KeepInventory { get; set; }
        public bool ShowCoordinates { get; set; }
        public bool ShowDaysPlayed { get; set; }
        public long DaysPlayed { get; set; }
        public long WorldTime { get; set; }
        public long TotalTicks { get; set; }
        public int RandomTickSpeed { get; set; }
        public int PlayersSleepingPercentage { get; set; }
        public long RandomSeed { get; set; }
        public int SpawnX { get; set; }
        public int SpawnY { get; set; }
        public int SpawnZ { get; set; }
        public bool HasBeenLoadedInCreative { get; set; }
        public bool CommandsEnabled { get; set; }
        public bool CheatsEnabled { get; set; }
        public bool HasExperiments { get; set; }
        public bool HasTemplateLock { get; set; }
        public List<string> ActiveFlags { get; set; }

        public BedrockWorldInfo()
        {
            ActiveFlags = new List<string>();
        }

        public bool HasBackup
        {
            get { return !string.IsNullOrEmpty(LevelDatPath) && File.Exists(LevelDatPath + ".bak"); }
        }

        public string SeedAndSpawnText
        {
            get
            {
                string mode = GameType == 1 ? "Criativo" : (GameType == 2 ? "Aventura" : "Survival");
                if (IsHardcore) mode += " [Hardcore]";
                if (KeepInventory) mode += " [KeepInv]";
                return "📅 " + DaysPlayed + " Dias · " + mode + " · Seed: " + RandomSeed.ToString() + " · Spawn(" + SpawnX + "," + SpawnY + "," + SpawnZ + ")";
            }
        }
    }

    /// <summary>
    /// Motor Binário NBT Little-Endian v4.0 SUPREME para level.dat do Minecraft Bedrock (1.21.50 a 1.21.80+).
    /// Preserva 100% da estrutura binária, construções, inventário e entidades.
    /// </summary>
    public static class BedrockNbtPatcher
    {
        public static readonly string[] AchievementZeroKeys = new string[]
        {
            "hasBeenLoadedInCreative",
            "commandsEnabled",
            "cheatsEnabled",
            "commandblockoutput",
            "commandblocksacEnabled",
            "ForceGameType"
        };

        public static readonly string[] ExperimentZeroKeys = new string[]
        {
            "experiments_ever_used",
            "saved_with_toggled_experiments",
            "gametest",
            "data_driven_items",
            "data_driven_biomes",
            "upcoming_creator_features",
            "experimental_molang_features",
            "cameras",
            "villager_trades_rebalance",
            "updateAnnouncedLive2023",
            "bundle",
            "locator_bar",
            "V2VillagerTrades",
            "DeferredTechnicalPreview"
        };

        public static readonly string[] TemplateLockZeroKeys = new string[]
        {
            "hasLockedBehaviorPack",
            "hasLockedResourcePack",
            "isFromLockedTemplate",
            "isFromWorldTemplate",
            "isWorldTemplateOptionLocked"
        };

        public static byte[] ReadFileShared(string path)
        {
            using (FileStream fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (MemoryStream ms = new MemoryStream())
            {
                fs.CopyTo(ms);
                return ms.ToArray();
            }
        }

        public static string ReadTextShared(string path)
        {
            if (!File.Exists(path)) return null;
            try
            {
                byte[] bytes = ReadFileShared(path);
                return Encoding.UTF8.GetString(bytes).Trim('\r', '\n', ' ', '\0');
            }
            catch
            {
                return null;
            }
        }

        public static BedrockWorldInfo InspectWorldFolder(string folderPath)
        {
            string levelDat = Path.Combine(folderPath, "level.dat");
            if (!File.Exists(levelDat)) return null;

            byte[] data = ReadFileShared(levelDat);
            BedrockWorldInfo info = InspectLevelDatBytes(data, Path.GetFileName(folderPath));
            info.FolderPath = folderPath;
            info.FolderName = Path.GetFileName(folderPath);
            info.LevelDatPath = levelDat;
            info.LastModified = File.GetLastWriteTime(levelDat);

            string txtName = ReadTextShared(Path.Combine(folderPath, "levelname.txt"));
            if (!string.IsNullOrWhiteSpace(txtName))
            {
                info.WorldName = txtName;
            }
            else if (string.IsNullOrWhiteSpace(info.WorldName))
            {
                info.WorldName = info.FolderName;
            }

            return info;
        }

        public static BedrockWorldInfo InspectLevelDatBytes(byte[] data, string fallbackName)
        {
            var info = new BedrockWorldInfo
            {
                WorldName = fallbackName,
                FolderName = fallbackName,
                LastModified = DateTime.Now
            };

            string nbtLevelName = ExtractNbtStringTag(data, "LevelName");
            if (!string.IsNullOrWhiteSpace(nbtLevelName))
            {
                info.WorldName = nbtLevelName;
            }

            info.GameType = ExtractNbtIntTag(data, "GameType", 0);
            info.Difficulty = ExtractNbtIntTag(data, "Difficulty", 2);
            info.IsHardcore = ExtractNbtByteTag(data, "IsHardcore") != 0;
            info.KeepInventory = ExtractNbtByteTag(data, "keepinventory") != 0;
            info.ShowCoordinates = ExtractNbtByteTag(data, "showcoordinates") != 0;
            info.ShowDaysPlayed = ExtractNbtByteTag(data, "showdaysplayed") != 0;
            info.RandomTickSpeed = ExtractNbtIntTag(data, "randomtickspeed", 1);
            info.PlayersSleepingPercentage = ExtractNbtIntTag(data, "playerssleepingpercentage", 100);
            info.RandomSeed = ExtractNbtLongTag(data, "RandomSeed", 0L);
            info.SpawnX = ExtractNbtIntTag(data, "SpawnX", 0);
            info.SpawnY = ExtractNbtIntTag(data, "SpawnY", 64);
            info.SpawnZ = ExtractNbtIntTag(data, "SpawnZ", 0);

            long rawTicks = ExtractNbtLongTag(data, "Time", -1L);
            if (rawTicks < 0)
            {
                rawTicks = ExtractNbtIntTag(data, "Time", 6000);
            }
            if (rawTicks < 0) rawTicks = 0;

            info.TotalTicks = rawTicks;
            info.DaysPlayed = rawTicks / 24000L;
            info.WorldTime = rawTicks % 24000L;

            info.HasBeenLoadedInCreative = ExtractNbtByteTag(data, "hasBeenLoadedInCreative") != 0;
            info.CommandsEnabled = ExtractNbtByteTag(data, "commandsEnabled") != 0;
            info.CheatsEnabled = ExtractNbtByteTag(data, "cheatsEnabled") != 0;

            bool forceGameType = ExtractNbtByteTag(data, "ForceGameType") != 0;
            bool cmdBlock = ExtractNbtByteTag(data, "commandblockoutput") != 0 || ExtractNbtByteTag(data, "commandblocksacEnabled") != 0;

            if (info.HasBeenLoadedInCreative) info.ActiveFlags.Add("hasBeenLoadedInCreative=1");
            if (info.CommandsEnabled) info.ActiveFlags.Add("commandsEnabled=1");
            if (info.CheatsEnabled) info.ActiveFlags.Add("cheatsEnabled=1");
            if (info.GameType == 1) info.ActiveFlags.Add("GameType=1 (Criativo)");
            if (forceGameType) info.ActiveFlags.Add("ForceGameType=1");
            if (cmdBlock) info.ActiveFlags.Add("commandblocks=1");

            foreach (string expKey in ExperimentZeroKeys)
            {
                if (ExtractNbtByteTag(data, expKey) != 0)
                {
                    info.HasExperiments = true;
                    info.ActiveFlags.Add(expKey + "=1");
                }
            }

            foreach (string tplKey in TemplateLockZeroKeys)
            {
                if (ExtractNbtByteTag(data, tplKey) != 0)
                {
                    info.HasTemplateLock = true;
                    info.ActiveFlags.Add(tplKey + "=1");
                }
            }

            bool isBlocked = info.HasBeenLoadedInCreative || info.CommandsEnabled || info.CheatsEnabled || info.GameType == 1 || info.HasTemplateLock;

            if (isBlocked)
            {
                info.Status = WorldStatus.BlockedRed;
                info.StatusText = "🔴 SEM CONQUISTAS - Bloqueado";
                info.Selected = true;
            }
            else if (info.HasExperiments)
            {
                info.Status = WorldStatus.ExperimentalYellow;
                info.StatusText = "⚠️ EXPERIMENTAL ATIVO";
                info.Selected = true;
            }
            else
            {
                info.Status = WorldStatus.ActiveGreen;
                info.StatusText = "🟢 CONQUISTAS ATIVAS";
                info.Selected = false;
            }

            long realMinutes = info.DaysPlayed * 20L;
            long realHours = realMinutes / 60L;
            long remMin = realMinutes % 60L;
            string playTimeStr = realHours > 0 ? (realHours + "h " + remMin + "m reais") : (remMin + "m reais");
            string hcTag = info.IsHardcore ? "[💀 Hardcore] " : "";

            info.DetailsText = info.ActiveFlags.Count > 0
                ? "📅 " + info.DaysPlayed + " Dias (" + playTimeStr + ") · " + hcTag + string.Join(", ", info.ActiveFlags.ToArray())
                : hcTag + "100% Limpo (" + info.SeedAndSpawnText + " · " + playTimeStr + ")";

            return info;
        }

        public static byte[] PatchLevelDatBytes(
            byte[] original,
            bool fixAchievements,
            bool disableExperiments,
            bool unlockTemplates,
            bool unlockHardcore,
            bool enableKeepInventory,
            bool enableShowCoordinates,
            bool enableShowDaysPlayed,
            bool clearWeatherDay,
            long bonusDaysToAdd,
            bool enableHardcoreMode,
            out int changesCount)
        {
            byte[] buffer = (byte[])original.Clone();
            changesCount = 0;

            if (enableHardcoreMode)
            {
                changesCount += SetNbtByteOrIntValue(buffer, "IsHardcore", 1);
                changesCount += SetNbtByteOrIntValue(buffer, "Difficulty", 3);
                changesCount += SetNbtByteOrIntValue(buffer, "GameType", 0);
                foreach (string key in AchievementZeroKeys)
                {
                    changesCount += SetNbtByteOrIntValue(buffer, key, 0);
                }
            }
            else if (unlockHardcore)
            {
                changesCount += SetNbtByteOrIntValue(buffer, "IsHardcore", 0);
                int curGt = ExtractNbtIntTag(buffer, "GameType", 0);
                if (curGt == 6)
                {
                    changesCount += SetNbtByteOrIntValue(buffer, "GameType", 0);
                }
            }

            if (fixAchievements && !enableHardcoreMode)
            {
                foreach (string key in AchievementZeroKeys)
                {
                    changesCount += SetNbtByteOrIntValue(buffer, key, 0);
                }
                changesCount += SetGameTypeSurvivalIfCreative(buffer);
            }

            if (disableExperiments)
            {
                foreach (string key in ExperimentZeroKeys)
                {
                    changesCount += SetNbtByteOrIntValue(buffer, key, 0);
                }
            }

            if (unlockTemplates)
            {
                foreach (string key in TemplateLockZeroKeys)
                {
                    changesCount += SetNbtByteOrIntValue(buffer, key, 0);
                }
            }

            if (enableKeepInventory)
            {
                changesCount += SetNbtByteOrIntValue(buffer, "keepinventory", 1);
            }

            if (enableShowCoordinates)
            {
                changesCount += SetNbtByteOrIntValue(buffer, "showcoordinates", 1);
            }

            if (enableShowDaysPlayed)
            {
                changesCount += SetNbtByteOrIntValue(buffer, "showdaysplayed", 1);
            }

            long rawTicks = ExtractNbtLongTag(buffer, "Time", -1L);
            if (rawTicks < 0) rawTicks = ExtractNbtIntTag(buffer, "Time", 6000);
            if (rawTicks < 0) rawTicks = 0;

            long curDays = rawTicks / 24000L;
            long curTimeOfDay = rawTicks % 24000L;
            bool updateTime = false;

            if (clearWeatherDay)
            {
                curTimeOfDay = 6000L;
                updateTime = true;
                changesCount += SetNbtFloatValue(buffer, "rainLevel", 0.0f);
                changesCount += SetNbtFloatValue(buffer, "lightningLevel", 0.0f);
            }

            if (bonusDaysToAdd > 0)
            {
                curDays += bonusDaysToAdd;
                updateTime = true;
            }

            if (updateTime)
            {
                long newTotal = curDays * 24000L + curTimeOfDay;
                changesCount += SetNbtLongOrIntValue(buffer, "Time", newTotal);
                changesCount += SetNbtLongOrIntValue(buffer, "currentTick", newTotal);
            }

            if (buffer.Length >= 8)
            {
                int payloadLen = buffer.Length - 8;
                byte[] lenBytes = BitConverter.GetBytes(payloadLen);
                Buffer.BlockCopy(lenBytes, 0, buffer, 4, 4);
            }

            return buffer;
        }

        public static byte[] PatchLevelDatBytes(
            byte[] original,
            bool fixAchievements,
            bool disableExperiments,
            bool unlockTemplates,
            bool unlockHardcore,
            bool enableKeepInventory,
            bool enableShowCoordinates,
            bool enableShowDaysPlayed,
            bool clearWeatherDay,
            long bonusDaysToAdd,
            out int changesCount)
        {
            return PatchLevelDatBytes(original, fixAchievements, disableExperiments, unlockTemplates, unlockHardcore, enableKeepInventory, enableShowCoordinates, enableShowDaysPlayed, clearWeatherDay, bonusDaysToAdd, false, out changesCount);
        }

        public static byte[] ReplaceNbtStringTag(byte[] data, string tagName, string newValue)
        {
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 5; i++)
            {
                if (data[i] == 8 && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        int valPos = i + 3 + nLen;
                        int oldLen = data[valPos] | (data[valPos + 1] << 8);
                        if (valPos + 2 + oldLen <= data.Length)
                        {
                            byte[] newStrBytes = Encoding.UTF8.GetBytes(newValue);
                            int newLen = Math.Min(newStrBytes.Length, 32767);
                            int delta = newLen - oldLen;
                            byte[] result = new byte[data.Length + delta];

                            Buffer.BlockCopy(data, 0, result, 0, valPos);
                            result[valPos] = (byte)(newLen & 0xFF);
                            result[valPos + 1] = (byte)((newLen >> 8) & 0xFF);
                            Buffer.BlockCopy(newStrBytes, 0, result, valPos + 2, newLen);
                            Buffer.BlockCopy(data, valPos + 2 + oldLen, result, valPos + 2 + newLen, data.Length - (valPos + 2 + oldLen));

                            if (result.Length >= 8)
                            {
                                int payloadLen = result.Length - 8;
                                byte[] lenBytes = BitConverter.GetBytes(payloadLen);
                                Buffer.BlockCopy(lenBytes, 0, result, 4, 4);
                            }
                            return result;
                        }
                    }
                }
            }
            return data;
        }

        private static string ExtractNbtStringTag(byte[] data, string tagName)
        {
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 5; i++)
            {
                if (data[i] == 8 && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        int valPos = i + 3 + nLen;
                        int sLen = data[valPos] | (data[valPos + 1] << 8);
                        if (valPos + 2 + sLen <= data.Length)
                        {
                            return Encoding.UTF8.GetString(data, valPos + 2, sLen);
                        }
                    }
                }
            }
            return null;
        }

        public static byte ExtractNbtByteTag(byte[] data, string tagName)
        {
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 4; i++)
            {
                if (data[i] == 1 && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        return data[i + 3 + nLen];
                    }
                }
            }
            return 0;
        }

        public static int ExtractNbtIntTag(byte[] data, string tagName, int defaultValue)
        {
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 7; i++)
            {
                if (data[i] == 3 && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        return BitConverter.ToInt32(data, i + 3 + nLen);
                    }
                }
            }
            return defaultValue;
        }

        public static long ExtractNbtLongTag(byte[] data, string tagName, long defaultValue)
        {
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 11; i++)
            {
                if (data[i] == 4 && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        return BitConverter.ToInt64(data, i + 3 + nLen);
                    }
                }
            }
            return defaultValue;
        }

        public static int SetNbtByteOrIntValue(byte[] data, string tagName, int targetVal)
        {
            int modified = 0;
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 4; i++)
            {
                byte tagType = data[i];
                if ((tagType == 1 || tagType == 3) && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        int valPos = i + 3 + nLen;
                        if (tagType == 1 && data[valPos] != (byte)targetVal)
                        {
                            data[valPos] = (byte)targetVal;
                            modified++;
                        }
                        else if (tagType == 3 && valPos + 4 <= data.Length)
                        {
                            int cur = BitConverter.ToInt32(data, valPos);
                            if (cur != targetVal)
                            {
                                byte[] b = BitConverter.GetBytes(targetVal);
                                Buffer.BlockCopy(b, 0, data, valPos, 4);
                                modified++;
                            }
                        }
                    }
                }
            }
            return modified;
        }

        public static int SetNbtLongOrIntValue(byte[] data, string tagName, long targetVal)
        {
            int modified = 0;
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 4; i++)
            {
                byte tagType = data[i];
                if ((tagType == 4 || tagType == 3) && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        int valPos = i + 3 + nLen;
                        if (tagType == 4 && valPos + 8 <= data.Length)
                        {
                            long cur = BitConverter.ToInt64(data, valPos);
                            if (cur != targetVal)
                            {
                                byte[] b = BitConverter.GetBytes(targetVal);
                                Buffer.BlockCopy(b, 0, data, valPos, 8);
                                modified++;
                            }
                        }
                        else if (tagType == 3 && valPos + 4 <= data.Length)
                        {
                            int cur = BitConverter.ToInt32(data, valPos);
                            int target32 = (int)targetVal;
                            if (cur != target32)
                            {
                                byte[] b = BitConverter.GetBytes(target32);
                                Buffer.BlockCopy(b, 0, data, valPos, 4);
                                modified++;
                            }
                        }
                    }
                }
            }
            return modified;
        }

        public static int SetNbtFloatValue(byte[] data, string tagName, float targetVal)
        {
            int modified = 0;
            byte[] nameBytes = Encoding.UTF8.GetBytes(tagName);
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 7; i++)
            {
                if (data[i] == 5 && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        int valPos = i + 3 + nLen;
                        float cur = BitConverter.ToSingle(data, valPos);
                        if (Math.Abs(cur - targetVal) > 0.0001f)
                        {
                            byte[] b = BitConverter.GetBytes(targetVal);
                            Buffer.BlockCopy(b, 0, data, valPos, 4);
                            modified++;
                        }
                    }
                }
            }
            return modified;
        }

        private static int SetGameTypeSurvivalIfCreative(byte[] data)
        {
            int modified = 0;
            byte[] nameBytes = Encoding.UTF8.GetBytes("GameType");
            int nLen = nameBytes.Length;
            for (int i = 8; i < data.Length - nLen - 7; i++)
            {
                if (data[i] == 3 && data[i + 1] == (nLen & 0xFF) && data[i + 2] == ((nLen >> 8) & 0xFF))
                {
                    bool match = true;
                    for (int k = 0; k < nLen; k++)
                    {
                        if (data[i + 3 + k] != nameBytes[k]) { match = false; break; }
                    }
                    if (match)
                    {
                        int valPos = i + 3 + nLen;
                        int cur = BitConverter.ToInt32(data, valPos);
                        if (cur == 1)
                        {
                            data[valPos] = 0;
                            data[valPos + 1] = 0;
                            data[valPos + 2] = 0;
                            data[valPos + 3] = 0;
                            modified++;
                        }
                    }
                }
            }
            return modified;
        }
    }

    public class MainForm : Form
    {
        private TextBox txtPath;
        private TextBox txtSearch;
        private DataGridView gridWorlds;
        private ContextMenuStrip rowContextMenu;
        private Label lblKpiTotal;
        private Label lblKpiSelected;
        private Label lblKpiBlocked;
        private Label lblKpiActive;
        private CheckBox chkAutoApplyOnCheck;
        private CheckBox chkAutoWatchFolder;
        private CheckBox chkOptAchievements;
        private CheckBox chkOptExperiments;
        private CheckBox chkOptTemplates;
        private CheckBox chkOptHardcore;
        private CheckBox chkOptKeepInventory;
        private CheckBox chkOptShowCoords;
        private CheckBox chkOptShowDays;
        private CheckBox chkOptClearWeather;
        private CheckBox chkOptBackup;
        private Label lblStatusFooter;
        private Timer autoWatchTimer;
        private List<BedrockWorldInfo> currentWorlds = new List<BedrockWorldInfo>();
        private string lastSnapshotSignature = "";
        private bool suppressCheckEvent = false;

        private readonly Color BgMain = ColorTranslator.FromHtml("#0B0F19");
        private readonly Color BgCard = ColorTranslator.FromHtml("#111827");
        private readonly Color BorderSubtle = ColorTranslator.FromHtml("#1E293B");
        private readonly Color EmeraldGreen = ColorTranslator.FromHtml("#10B981");
        private readonly Color CoralRed = ColorTranslator.FromHtml("#EF4444");
        private readonly Color TrophyGold = ColorTranslator.FromHtml("#F59E0B");
        private readonly Color SyncCyan = ColorTranslator.FromHtml("#0EA5E9");
        private readonly Color TextLight = ColorTranslator.FromHtml("#F8FAFC");
        private readonly Color TextMuted = ColorTranslator.FromHtml("#94A3B8");

        public MainForm()
        {
            Text = "Reativador de Conquistas — Minecraft Bedrock v4.0 SUPREME (1.21.50 - 1.21.80+)";
            Size = new Size(1280, 860);
            MinimumSize = new Size(1060, 760);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = BgMain;
            ForeColor = TextLight;
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            KeyPreview = true;
            try
            {
                Icon assoc = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                Icon = assoc ?? CreateGoldenTrophyIcon();
            }
            catch
            {
                Icon = CreateGoldenTrophyIcon();
            }

            InitializeLayout();

            autoWatchTimer = new Timer();
            autoWatchTimer.Interval = 3000;
            autoWatchTimer.Tick += AutoWatchTimer_Tick;
            autoWatchTimer.Start();

            Shown += (s, e) => AutoDetectAndLoadWorlds();
            KeyDown += MainForm_KeyDown;
        }

        private void MainForm_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.F5)
            {
                e.Handled = true;
                RefreshWorldsList(false);
            }
        }

        private void InitializeLayout()
        {
            int w = ClientSize.Width;

            Panel pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Size = new Size(w, 68),
                BackColor = BgCard,
                Padding = new Padding(20, 12, 20, 12)
            };

            Label lblTitle = new Label
            {
                Text = "🏆 Reativador de Conquistas — Minecraft Bedrock v4.0 SUPREME",
                Font = new Font("Segoe UI", 15f, FontStyle.Bold),
                ForeColor = TrophyGold,
                AutoSize = true,
                Location = new Point(20, 10)
            };

            Label lblSubtitle = new Label
            {
                Text = "Bedrock 1.21.50 a 1.21.80+ (UWP & GDK) · Conquistas, Aumentar Dias Jogados, [Experimental], Spawn X/Y/Z, Clima, Seed & Clonador",
                Font = new Font("Segoe UI", 9f, FontStyle.Regular),
                ForeColor = TextMuted,
                AutoSize = true,
                Location = new Point(23, 39)
            };

            Button btnHeaderRefresh = CreateStyledButton("🔄 ATUALIZAR MAPAS (F5)", SyncCyan, Color.White, 220, 38);
            btnHeaderRefresh.Location = new Point(w - 240, 15);
            btnHeaderRefresh.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnHeaderRefresh.Click += (s, e) => RefreshWorldsList(false);

            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);
            pnlHeader.Controls.Add(btnHeaderRefresh);

            TableLayoutPanel tblKpis = new TableLayoutPanel
            {
                Dock = DockStyle.Top,
                Size = new Size(w, 92),
                ColumnCount = 4,
                RowCount = 1,
                BackColor = BgMain,
                Padding = new Padding(16, 10, 16, 6)
            };
            for (int i = 0; i < 4; i++)
                tblKpis.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25f));

            lblKpiTotal = CreateKpiCard(tblKpis, 0, "TOTAL DE MUNDOS", "0", SyncCyan);
            lblKpiSelected = CreateKpiCard(tblKpis, 1, "MARCADOS COM [✔]", "0", TrophyGold);
            lblKpiBlocked = CreateKpiCard(tblKpis, 2, "SEM CONQUISTAS (VERMELHO)", "0", CoralRed);
            lblKpiActive = CreateKpiCard(tblKpis, 3, "CONQUISTAS ATIVAS (VERDE)", "0", EmeraldGreen);

            Panel pnlFolderBar = new Panel
            {
                Dock = DockStyle.Top,
                Size = new Size(w, 88),
                BackColor = BgCard,
                Padding = new Padding(18, 8, 18, 8)
            };

            Label lblFolderCaption = new Label
            {
                Text = "PASTA DE MUNDOS ATIVA (minecraftWorlds — leitura compartilhada com o jogo aberto):",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = TextMuted,
                AutoSize = true,
                Location = new Point(18, 9)
            };

            txtPath = new TextBox
            {
                Location = new Point(18, 30),
                Width = w - 595,
                Height = 28,
                BackColor = BgMain,
                ForeColor = TextLight,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 9.5f),
                Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right
            };

            Button btnBrowseFolder = CreateStyledButton("📂 Escolher Pasta", BorderSubtle, TextLight, 135, 29);
            btnBrowseFolder.Location = new Point(w - 565, 29);
            btnBrowseFolder.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnBrowseFolder.Click += BtnBrowseFolder_Click;

            Button btnDetectUwp = CreateStyledButton("⚡ Auto UWP / GDK", BorderSubtle, TrophyGold, 145, 29);
            btnDetectUwp.Location = new Point(w - 422, 29);
            btnDetectUwp.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnDetectUwp.Click += (s, e) => AutoDetectAndLoadWorlds();

            Button btnOpenExplorer = CreateStyledButton("🗂️ Abrir no Explorer", BorderSubtle, TextLight, 150, 29);
            btnOpenExplorer.Location = new Point(w - 269, 29);
            btnOpenExplorer.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnOpenExplorer.Click += (s, e) =>
            {
                if (Directory.Exists(txtPath.Text))
                    Process.Start("explorer.exe", txtPath.Text);
            };

            Button btnFolderRefresh = CreateStyledButton("🔄 Atualizar", SyncCyan, Color.White, 105, 29);
            btnFolderRefresh.Location = new Point(w - 112, 29);
            btnFolderRefresh.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            btnFolderRefresh.Click += (s, e) => RefreshWorldsList(false);

            chkAutoWatchFolder = new CheckBox
            {
                Text = "🔄 Atualizar Sozinho ao Criar Novo Mapa no Jogo (Monitor Automático a cada 3s)",
                Checked = true,
                ForeColor = SyncCyan,
                Font = new Font("Segoe UI", 8.8f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(18, 61)
            };

            pnlFolderBar.Controls.Add(lblFolderCaption);
            pnlFolderBar.Controls.Add(txtPath);
            pnlFolderBar.Controls.Add(btnBrowseFolder);
            pnlFolderBar.Controls.Add(btnDetectUwp);
            pnlFolderBar.Controls.Add(btnOpenExplorer);
            pnlFolderBar.Controls.Add(btnFolderRefresh);
            pnlFolderBar.Controls.Add(chkAutoWatchFolder);

            Panel pnlSelectionBar = new Panel
            {
                Dock = DockStyle.Top,
                Size = new Size(w, 48),
                BackColor = BgMain,
                Padding = new Padding(18, 8, 18, 8)
            };

            Button btnCheckAll = CreateStyledButton("☑️ Marcar Todos", BorderSubtle, TextLight, 130, 32);
            btnCheckAll.Location = new Point(18, 8);
            btnCheckAll.Click += (s, e) => SetAllChecked(true, false);

            Button btnCheckRedOnly = CreateStyledButton("🔴 Marcar Só os Vermelhos", ColorTranslator.FromHtml("#3B1219"), CoralRed, 210, 32);
            btnCheckRedOnly.Location = new Point(154, 8);
            btnCheckRedOnly.Click += (s, e) => SetAllChecked(true, true);

            Button btnUncheckAll = CreateStyledButton("Desmarcar Todos", BorderSubtle, TextMuted, 130, 32);
            btnUncheckAll.Location = new Point(370, 8);
            btnUncheckAll.Click += (s, e) => SetAllChecked(false, false);

            chkAutoApplyOnCheck = new CheckBox
            {
                Text = "⚡ Fazer Automático ao Marcar [✔]",
                Checked = false,
                ForeColor = EmeraldGreen,
                Font = new Font("Segoe UI", 9.2f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(512, 13)
            };

            Label lblSearchCap = new Label
            {
                Text = "🔍 Filtrar:",
                ForeColor = TextMuted,
                AutoSize = true,
                Location = new Point(w - 285, 14),
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            };

            txtSearch = new TextBox
            {
                Location = new Point(w - 215, 11),
                Width = 195,
                BackColor = BgCard,
                ForeColor = TextLight,
                BorderStyle = BorderStyle.FixedSingle,
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            };
            txtSearch.TextChanged += (s, e) => PopulateGrid();

            pnlSelectionBar.Controls.Add(btnCheckAll);
            pnlSelectionBar.Controls.Add(btnCheckRedOnly);
            pnlSelectionBar.Controls.Add(btnUncheckAll);
            pnlSelectionBar.Controls.Add(chkAutoApplyOnCheck);
            pnlSelectionBar.Controls.Add(lblSearchCap);
            pnlSelectionBar.Controls.Add(txtSearch);

            Panel pnlBottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Size = new Size(w, 140),
                BackColor = BgCard,
                Padding = new Padding(18, 10, 18, 10)
            };

            chkOptAchievements = new CheckBox
            {
                Text = "🏆 Reativar Conquistas + Survival",
                Checked = true,
                ForeColor = TextLight,
                AutoSize = true,
                Location = new Point(18, 10)
            };

            chkOptExperiments = new CheckBox
            {
                Text = "🧪 Remover [Experimental] (14 flags)",
                Checked = true,
                ForeColor = TextLight,
                AutoSize = true,
                Location = new Point(285, 10)
            };

            chkOptTemplates = new CheckBox
            {
                Text = "🔓 Desbloquear Templates",
                Checked = true,
                ForeColor = TextLight,
                AutoSize = true,
                Location = new Point(575, 10)
            };

            chkOptHardcore = new CheckBox
            {
                Text = "💀 Reviver Hardcore (IsHardcore=0)",
                Checked = true,
                ForeColor = CoralRed,
                AutoSize = true,
                Location = new Point(810, 10)
            };

            chkOptBackup = new CheckBox
            {
                Text = "🛡️ Backup (.bak)",
                Checked = true,
                ForeColor = TrophyGold,
                AutoSize = true,
                Location = new Point(1085, 10)
            };

            chkOptKeepInventory = new CheckBox
            {
                Text = "🎒 Manter Inventário (keepinventory=1)",
                Checked = false,
                ForeColor = EmeraldGreen,
                AutoSize = true,
                Location = new Point(18, 36)
            };

            chkOptShowCoords = new CheckBox
            {
                Text = "📍 Mostrar Coordenadas (showcoordinates=1)",
                Checked = true,
                ForeColor = SyncCyan,
                AutoSize = true,
                Location = new Point(285, 36)
            };

            chkOptShowDays = new CheckBox
            {
                Text = "📅 Mostrar Dias Jogados (showdaysplayed=1)",
                Checked = true,
                ForeColor = TrophyGold,
                AutoSize = true,
                Location = new Point(575, 36)
            };

            chkOptClearWeather = new CheckBox
            {
                Text = "☀️ Limpar Chuva & Meio-Dia (Preserva Dias)",
                Checked = false,
                ForeColor = TrophyGold,
                AutoSize = true,
                Location = new Point(880, 36)
            };

            Button btnApplySelected = CreateStyledButton("✔ APLICAR NOS MARCADOS", EmeraldGreen, Color.Black, 240, 42);
            btnApplySelected.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btnApplySelected.Location = new Point(18, 68);
            btnApplySelected.Click += (s, e) => ApplyPatchToSelectedWorlds();

            Button btnHardcore = CreateStyledButton("💀 Ativar Hardcore", ColorTranslator.FromHtml("#4A1525"), ColorTranslator.FromHtml("#F472B6"), 165, 42);
            btnHardcore.Location = new Point(265, 68);
            btnHardcore.Click += (s, e) => SetHardcoreOnHighlightedOrSelected(true);

            Button btnRevive = CreateStyledButton("💖 Tirar Hardcore", ColorTranslator.FromHtml("#163526"), EmeraldGreen, 165, 42);
            btnRevive.Location = new Point(438, 68);
            btnRevive.Click += (s, e) => SetHardcoreOnHighlightedOrSelected(false);

            Button btnAdd100Days = CreateStyledButton("📅 +100 Dias", TrophyGold, Color.Black, 130, 42);
            btnAdd100Days.Location = new Point(611, 68);
            btnAdd100Days.Click += (s, e) => AddDaysToHighlightedOrSelected(100);

            Button btnAdvEditor = CreateStyledButton("🛠️ Editor NBT / Dias", BorderSubtle, SyncCyan, 185, 42);
            btnAdvEditor.Location = new Point(749, 68);
            btnAdvEditor.Click += (s, e) => OpenAdvancedEditorDialog();

            Button btnCloneWorld = CreateStyledButton("📑 Clonar Mundo", BorderSubtle, EmeraldGreen, 145, 42);
            btnCloneWorld.Location = new Point(942, 68);
            btnCloneWorld.Click += (s, e) => CloneHighlightedWorld();

            Button btnSingleFile = CreateStyledButton("📦 .mcworld / level.dat", BorderSubtle, TrophyGold, 180, 42);
            btnSingleFile.Location = new Point(1095, 68);
            btnSingleFile.Click += BtnSingleFile_Click;

            lblStatusFooter = new Label
            {
                Text = "Dica v5.0 TITAN: Use '💀 Ativar Hardcore' para modo 1 vida oficial no Bedrock ou '📅 +100 Dias' para aumentar o tempo!",
                ForeColor = TextMuted,
                AutoSize = true,
                Location = new Point(18, 115)
            };

            pnlBottom.Controls.Add(chkOptAchievements);
            pnlBottom.Controls.Add(chkOptExperiments);
            pnlBottom.Controls.Add(chkOptTemplates);
            pnlBottom.Controls.Add(chkOptHardcore);
            pnlBottom.Controls.Add(chkOptBackup);
            pnlBottom.Controls.Add(chkOptKeepInventory);
            pnlBottom.Controls.Add(chkOptShowCoords);
            pnlBottom.Controls.Add(chkOptShowDays);
            pnlBottom.Controls.Add(chkOptClearWeather);
            pnlBottom.Controls.Add(btnApplySelected);
            pnlBottom.Controls.Add(btnHardcore);
            pnlBottom.Controls.Add(btnRevive);
            pnlBottom.Controls.Add(btnAdd100Days);
            pnlBottom.Controls.Add(btnAdvEditor);
            pnlBottom.Controls.Add(btnCloneWorld);
            pnlBottom.Controls.Add(btnSingleFile);
            pnlBottom.Controls.Add(lblStatusFooter);

            // Context Menu (Right Click on Row)
            rowContextMenu = new ContextMenuStrip();
            rowContextMenu.Items.Add("🏆 Reativar Conquistas Deste Mundo Agora", null, (s, e) => PatchHighlightedWorld());
            rowContextMenu.Items.Add("💀 Converter para Modo Hardcore Oficial (1 Vida · Difícil = 3)", null, (s, e) => SetHardcoreOnHighlightedOrSelected(true));
            rowContextMenu.Items.Add("💖 Desativar Hardcore / Reviver Espectador (Vidas Ilimitadas)", null, (s, e) => SetHardcoreOnHighlightedOrSelected(false));
            rowContextMenu.Items.Add("📅 Adicionar +100 Dias Jogados Neste Mundo", null, (s, e) => AddDaysToHighlightedOrSelected(100));
            rowContextMenu.Items.Add("📅 Adicionar +1.000 Dias Jogados Neste Mundo", null, (s, e) => AddDaysToHighlightedOrSelected(1000));
            rowContextMenu.Items.Add("🛠️ Editor Avançado (Dias Jogados, Nome, Spawn X/Y/Z, Seed, Clima e Gamerules)", null, (s, e) => OpenAdvancedEditorDialog());
            rowContextMenu.Items.Add("📑 Clonar Mundo em Nova Pasta (Já com Conquistas Ativas)", null, (s, e) => CloneHighlightedWorld());
            rowContextMenu.Items.Add("📋 Copiar Seed (RandomSeed) do Mundo", null, (s, e) => CopyHighlightedWorldSeed());
            rowContextMenu.Items.Add("📦 Exportar Mundo como Pacote .mcworld", null, (s, e) => ExportHighlightedWorldMcworld());
            rowContextMenu.Items.Add("🛡️ Restaurar Backup Original (level.dat.bak)", null, (s, e) => RestoreHighlightedWorldBackup());
            rowContextMenu.Items.Add("📂 Abrir Pasta Deste Mundo no Explorer", null, (s, e) => OpenHighlightedWorldFolder());

            gridWorlds = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = BgMain,
                BorderStyle = BorderStyle.None,
                EnableHeadersVisualStyles = false,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                AllowUserToResizeRows = false,
                RowHeadersVisible = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                MultiSelect = false,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                RowTemplate = { Height = 38 },
                ContextMenuStrip = rowContextMenu
            };

            gridWorlds.ColumnHeadersDefaultCellStyle.BackColor = BgCard;
            gridWorlds.ColumnHeadersDefaultCellStyle.ForeColor = TextMuted;
            gridWorlds.ColumnHeadersDefaultCellStyle.Font = new Font("Segoe UI", 9f, FontStyle.Bold);
            gridWorlds.ColumnHeadersHeight = 38;

            gridWorlds.DefaultCellStyle.BackColor = BgCard;
            gridWorlds.DefaultCellStyle.ForeColor = TextLight;
            gridWorlds.DefaultCellStyle.SelectionBackColor = BorderSubtle;
            gridWorlds.DefaultCellStyle.SelectionForeColor = Color.White;
            gridWorlds.GridColor = BorderSubtle;

            var colCheck = new DataGridViewCheckBoxColumn
            {
                Name = "Selected",
                HeaderText = "[✔]",
                FillWeight = 7,
                ReadOnly = false
            };
            var colName = new DataGridViewTextBoxColumn
            {
                Name = "WorldName",
                HeaderText = "NOME DO MUNDO (level.dat / levelname.txt)",
                FillWeight = 24,
                ReadOnly = true
            };
            var colStatus = new DataGridViewTextBoxColumn
            {
                Name = "StatusText",
                HeaderText = "STATUS DE CONQUISTAS",
                FillWeight = 22,
                ReadOnly = true
            };
            var colDetails = new DataGridViewTextBoxColumn
            {
                Name = "DetailsText",
                HeaderText = "DIAS JOGADOS / DIAGNÓSTICO NBT / SEED / SPAWN",
                FillWeight = 32,
                ReadOnly = true
            };
            var colFolder = new DataGridViewTextBoxColumn
            {
                Name = "FolderName",
                HeaderText = "PASTA / MODIFICADO",
                FillWeight = 15,
                ReadOnly = true
            };

            gridWorlds.Columns.AddRange(new DataGridViewColumn[] { colCheck, colName, colStatus, colDetails, colFolder });
            gridWorlds.CurrentCellDirtyStateChanged += GridWorlds_CurrentCellDirtyStateChanged;
            gridWorlds.CellValueChanged += GridWorlds_CellValueChanged;

            Controls.Add(gridWorlds);
            Controls.Add(pnlSelectionBar);
            Controls.Add(pnlFolderBar);
            Controls.Add(tblKpis);
            Controls.Add(pnlHeader);
            Controls.Add(pnlBottom);
        }

        private BedrockWorldInfo GetHighlightedWorld()
        {
            if (gridWorlds.SelectedRows.Count > 0)
            {
                return gridWorlds.SelectedRows[0].Tag as BedrockWorldInfo;
            }
            if (gridWorlds.CurrentRow != null)
            {
                return gridWorlds.CurrentRow.Tag as BedrockWorldInfo;
            }
            return null;
        }

        private void AddDaysToHighlightedOrSelected(long daysToAdd)
        {
            var targets = currentWorlds.Where(x => x.Selected).ToList();
            if (targets.Count == 0)
            {
                var single = GetHighlightedWorld();
                if (single != null) targets.Add(single);
            }

            if (targets.Count == 0)
            {
                MessageBox.Show("Selecione ou marque com [✔] pelo menos um mundo na tabela para aumentar os Dias Jogados.", "Aumentar Dias Jogados", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            int count = 0;
            foreach (var w in targets)
            {
                try
                {
                    byte[] raw = BedrockNbtPatcher.ReadFileShared(w.LevelDatPath);
                    if (chkOptBackup.Checked)
                        File.WriteAllBytes(w.LevelDatPath + ".bak", raw);

                    int chg;
                    byte[] patched = BedrockNbtPatcher.PatchLevelDatBytes(
                        raw,
                        chkOptAchievements.Checked,
                        chkOptExperiments.Checked,
                        chkOptTemplates.Checked,
                        chkOptHardcore.Checked,
                        chkOptKeepInventory.Checked,
                        chkOptShowCoords.Checked,
                        true,
                        chkOptClearWeather.Checked,
                        daysToAdd,
                        out chg
                    );

                    using (FileStream fs = new FileStream(w.LevelDatPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete))
                    {
                        fs.Write(patched, 0, patched.Length);
                    }
                    count++;
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Erro ao aumentar dias em '" + w.WorldName + "': " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }

            lastSnapshotSignature = "";
            RefreshWorldsList(false);
            lblStatusFooter.Text = "📅 +" + daysToAdd + " Dias Jogados adicionados com sucesso em " + count + " mundo(s) (showdaysplayed = 1 ativado)!";
        }

        private void SetHardcoreOnHighlightedOrSelected(bool enableHardcore)
        {
            var targets = currentWorlds.Where(x => x.Selected).ToList();
            if (targets.Count == 0)
            {
                var single = GetHighlightedWorld();
                if (single != null) targets.Add(single);
            }

            if (targets.Count == 0)
            {
                MessageBox.Show("Selecione ou marque com [✔] pelo menos um mundo na tabela para alterar o Modo Hardcore.", "Modo Hardcore Oficial", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            int count = 0;
            foreach (var w in targets)
            {
                try
                {
                    byte[] raw = BedrockNbtPatcher.ReadFileShared(w.LevelDatPath);
                    if (chkOptBackup.Checked)
                        File.WriteAllBytes(w.LevelDatPath + ".bak", raw);

                    int chg;
                    byte[] patched = BedrockNbtPatcher.PatchLevelDatBytes(
                        raw,
                        true,
                        chkOptExperiments.Checked,
                        chkOptTemplates.Checked,
                        !enableHardcore,
                        chkOptKeepInventory.Checked,
                        chkOptShowCoords.Checked,
                        chkOptShowDays.Checked,
                        chkOptClearWeather.Checked,
                        0L,
                        enableHardcore,
                        out chg
                    );

                    using (FileStream fs = new FileStream(w.LevelDatPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete))
                    {
                        fs.Write(patched, 0, patched.Length);
                    }
                    count++;
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Erro ao alterar Hardcore em '" + w.WorldName + "': " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }

            lastSnapshotSignature = "";
            RefreshWorldsList(false);
            lblStatusFooter.Text = enableHardcore
                ? "💀 Modo Hardcore Oficial ativado com sucesso em " + count + " mundo(s) (1 vida única · Dificuldade Difícil = 3 · Conquistas Ativas)!"
                : "💖 Modo Hardcore desativado e jogador revivido em " + count + " mundo(s) (Sobrevivência com vidas ilimitadas)!";
        }

        private void PatchHighlightedWorld()
        {
            var w = GetHighlightedWorld();
            if (w == null) return;
            try
            {
                int chg = PatchSingleWorld(w);
                lastSnapshotSignature = "";
                RefreshWorldsList(false);
                lblStatusFooter.Text = "✔ Mundo '" + w.WorldName + "' reativado com sucesso (" + chg + " flags corrigidas)!";
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao corrigir mundo: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void CloneHighlightedWorld()
        {
            var w = GetHighlightedWorld();
            if (w == null || !Directory.Exists(w.FolderPath))
            {
                MessageBox.Show("Selecione um mundo na tabela primeiro para cloná-lo.", "Clonar Mundo", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                string parentDir = Path.GetDirectoryName(w.FolderPath);
                string suffix = Guid.NewGuid().ToString("N").Substring(0, 5).ToUpperInvariant();
                string newFolderName = w.FolderName + "_Clone_" + suffix;
                string newFolderPath = Path.Combine(parentDir, newFolderName);

                CopyDirectoryRecursive(w.FolderPath, newFolderPath);

                string clonedLevelDat = Path.Combine(newFolderPath, "level.dat");
                if (File.Exists(clonedLevelDat))
                {
                    byte[] raw = BedrockNbtPatcher.ReadFileShared(clonedLevelDat);
                    int chg;
                    byte[] patched = BedrockNbtPatcher.PatchLevelDatBytes(
                        raw,
                        true,
                        true,
                        true,
                        chkOptHardcore.Checked,
                        chkOptKeepInventory.Checked,
                        chkOptShowCoords.Checked,
                        chkOptShowDays.Checked,
                        chkOptClearWeather.Checked,
                        0L,
                        out chg
                    );
                    string cloneTitle = w.WorldName + " (Clone Conquistas)";
                    patched = BedrockNbtPatcher.ReplaceNbtStringTag(patched, "LevelName", cloneTitle);
                    File.WriteAllBytes(clonedLevelDat, patched);

                    string txtFile = Path.Combine(newFolderPath, "levelname.txt");
                    File.WriteAllText(txtFile, cloneTitle, Encoding.UTF8);
                }

                lastSnapshotSignature = "";
                RefreshWorldsList(false);
                lblStatusFooter.Text = "📑 Mundo clonado com sucesso em '" + newFolderName + "' já com Conquistas Ativas!";
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao clonar mundo: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static void CopyDirectoryRecursive(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string dest = Path.Combine(targetDir, Path.GetFileName(file));
                byte[] bytes = BedrockNbtPatcher.ReadFileShared(file);
                File.WriteAllBytes(dest, bytes);
            }
            foreach (string subDir in Directory.GetDirectories(sourceDir))
            {
                string destSub = Path.Combine(targetDir, Path.GetFileName(subDir));
                CopyDirectoryRecursive(subDir, destSub);
            }
        }

        private void OpenAdvancedEditorDialog()
        {
            var w = GetHighlightedWorld();
            if (w == null)
            {
                MessageBox.Show("Selecione um mundo na tabela primeiro para abrir o Editor Avançado.", "Editor Avançado NBT", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            Form dlg = new Form
            {
                Text = "🛠️ Editor Avançado NBT & Dias Jogados — " + w.WorldName,
                Size = new Size(590, 540),
                StartPosition = FormStartPosition.CenterParent,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MaximizeBox = false,
                MinimizeBox = false,
                BackColor = BgCard,
                ForeColor = TextLight
            };

            Label lblName = new Label { Text = "Nome do Mundo (LevelName + levelname.txt):", Location = new Point(18, 14), AutoSize = true };
            TextBox txtName = new TextBox
            {
                Text = w.WorldName,
                Location = new Point(18, 36),
                Width = 535,
                BackColor = BgMain,
                ForeColor = TextLight,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 10f, FontStyle.Bold)
            };

            Label lblDays = new Label { Text = "📅 Dias Jogados no Mundo (Time ÷ 24000):", Location = new Point(18, 72), ForeColor = TrophyGold, Font = new Font("Segoe UI", 9.5f, FontStyle.Bold), AutoSize = true };
            TextBox txtDays = new TextBox
            {
                Text = w.DaysPlayed.ToString(),
                Location = new Point(18, 95),
                Width = 170,
                BackColor = BgMain,
                ForeColor = TrophyGold,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 11f, FontStyle.Bold)
            };

            Button btnPlus100 = CreateStyledButton("+100 Dias", BorderSubtle, EmeraldGreen, 105, 28);
            btnPlus100.Location = new Point(196, 94);
            btnPlus100.Click += (s, e) =>
            {
                long cur;
                if (long.TryParse(txtDays.Text.Trim(), out cur)) txtDays.Text = (cur + 100L).ToString();
            };

            Button btnPlus1000 = CreateStyledButton("+1.000 Dias", BorderSubtle, TrophyGold, 115, 28);
            btnPlus1000.Location = new Point(307, 94);
            btnPlus1000.Click += (s, e) =>
            {
                long cur;
                if (long.TryParse(txtDays.Text.Trim(), out cur)) txtDays.Text = (cur + 1000L).ToString();
            };

            Button btnSet1000 = CreateStyledButton("= 1.000 Dias", BorderSubtle, SyncCyan, 125, 28);
            btnSet1000.Location = new Point(428, 94);
            btnSet1000.Click += (s, e) => { txtDays.Text = "1000"; };

            Label lblSeed = new Label { Text = "Seed do Mundo (RandomSeed 64-bit):", Location = new Point(18, 134), AutoSize = true };
            TextBox txtSeed = new TextBox
            {
                Text = w.RandomSeed.ToString(),
                Location = new Point(18, 156),
                Width = 255,
                BackColor = BgMain,
                ForeColor = SyncCyan,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 10f, FontStyle.Bold)
            };

            Label lblTime = new Label { Text = "Horário do Dia (0=Manhã, 6000=Meio-Dia):", Location = new Point(290, 134), AutoSize = true };
            TextBox txtTime = new TextBox
            {
                Text = w.WorldTime.ToString(),
                Location = new Point(290, 156),
                Width = 263,
                BackColor = BgMain,
                ForeColor = TrophyGold,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 10f, FontStyle.Bold)
            };

            Label lblSpawnX = new Label { Text = "Spawn X:", Location = new Point(18, 194), AutoSize = true };
            TextBox txtSpawnX = new TextBox { Text = w.SpawnX.ToString(), Location = new Point(18, 216), Width = 165, BackColor = BgMain, ForeColor = TextLight, BorderStyle = BorderStyle.FixedSingle, Font = new Font("Consolas", 10f) };

            Label lblSpawnY = new Label { Text = "Spawn Y:", Location = new Point(203, 194), AutoSize = true };
            TextBox txtSpawnY = new TextBox { Text = w.SpawnY.ToString(), Location = new Point(203, 216), Width = 165, BackColor = BgMain, ForeColor = TextLight, BorderStyle = BorderStyle.FixedSingle, Font = new Font("Consolas", 10f) };

            Label lblSpawnZ = new Label { Text = "Spawn Z:", Location = new Point(388, 194), AutoSize = true };
            TextBox txtSpawnZ = new TextBox { Text = w.SpawnZ.ToString(), Location = new Point(388, 216), Width = 165, BackColor = BgMain, ForeColor = TextLight, BorderStyle = BorderStyle.FixedSingle, Font = new Font("Consolas", 10f) };

            CheckBox chkDlgShowDays = new CheckBox { Text = "📅 Mostrar Dias Jogados na Tela (showdaysplayed = 1)", Checked = true, ForeColor = TrophyGold, Font = new Font("Segoe UI", 9f, FontStyle.Bold), AutoSize = true, Location = new Point(18, 258) };
            CheckBox chkDlgKeepInv = new CheckBox { Text = "🎒 Manter Inventário (keepinventory = 1)", Checked = w.KeepInventory, ForeColor = EmeraldGreen, AutoSize = true, Location = new Point(18, 288) };
            CheckBox chkDlgCoords = new CheckBox { Text = "📍 Mostrar Coordenadas (showcoordinates = 1)", Checked = w.ShowCoordinates, ForeColor = SyncCyan, AutoSize = true, Location = new Point(300, 288) };
            CheckBox chkDlgClearRain = new CheckBox { Text = "☀️ Limpar Chuva e Tempestade (rainLevel = 0)", Checked = true, ForeColor = TrophyGold, AutoSize = true, Location = new Point(18, 318) };
            CheckBox chkDlgNoFire = new CheckBox { Text = "🔥 Evitar Fogo Espalhar (dofiretick = 0)", Checked = false, ForeColor = TextLight, AutoSize = true, Location = new Point(300, 318) };
            CheckBox chkDlgOneSleep = new CheckBox { Text = "🛏️ 1 Jogador Dorme Pula a Noite (sleeping = 1%)", Checked = w.PlayersSleepingPercentage <= 1, ForeColor = SyncCyan, AutoSize = true, Location = new Point(18, 348) };
            CheckBox chkDlgReviveHardcore = new CheckBox { Text = "💀 Desativar Hardcore (IsHardcore = 0)", Checked = !w.IsHardcore, ForeColor = CoralRed, AutoSize = true, Location = new Point(300, 348) };
            CheckBox chkDlgFixAchiev = new CheckBox { Text = "🏆 Garantir Conquistas Ativas + Remover [Experimental]", Checked = true, ForeColor = EmeraldGreen, Font = new Font("Segoe UI", 9.5f, FontStyle.Bold), AutoSize = true, Location = new Point(18, 382) };

            Button btnSave = CreateStyledButton("✔ Salvar Dias Jogados & Reativar Conquistas", EmeraldGreen, Color.Black, 310, 42);
            btnSave.Location = new Point(243, 430);
            btnSave.DialogResult = DialogResult.OK;

            dlg.Controls.AddRange(new Control[] {
                lblName, txtName, lblDays, txtDays, btnPlus100, btnPlus1000, btnSet1000,
                lblSeed, txtSeed, lblTime, txtTime,
                lblSpawnX, txtSpawnX, lblSpawnY, txtSpawnY, lblSpawnZ, txtSpawnZ,
                chkDlgShowDays, chkDlgKeepInv, chkDlgCoords, chkDlgClearRain, chkDlgNoFire, chkDlgOneSleep, chkDlgReviveHardcore, chkDlgFixAchiev,
                btnSave
            });
            dlg.AcceptButton = btnSave;

            if (dlg.ShowDialog(this) == DialogResult.OK)
            {
                try
                {
                    byte[] raw = BedrockNbtPatcher.ReadFileShared(w.LevelDatPath);
                    if (chkOptBackup.Checked)
                        File.WriteAllBytes(w.LevelDatPath + ".bak", raw);

                    int chg;
                    byte[] patched = BedrockNbtPatcher.PatchLevelDatBytes(
                        raw,
                        chkDlgFixAchiev.Checked,
                        chkDlgFixAchiev.Checked,
                        chkDlgFixAchiev.Checked,
                        chkDlgReviveHardcore.Checked,
                        chkDlgKeepInv.Checked,
                        chkDlgCoords.Checked,
                        chkDlgShowDays.Checked,
                        chkDlgClearRain.Checked,
                        0L,
                        out chg
                    );

                    int sx, sy, sz;
                    if (int.TryParse(txtSpawnX.Text.Trim(), out sx)) BedrockNbtPatcher.SetNbtByteOrIntValue(patched, "SpawnX", sx);
                    if (int.TryParse(txtSpawnY.Text.Trim(), out sy)) BedrockNbtPatcher.SetNbtByteOrIntValue(patched, "SpawnY", sy);
                    if (int.TryParse(txtSpawnZ.Text.Trim(), out sz)) BedrockNbtPatcher.SetNbtByteOrIntValue(patched, "SpawnZ", sz);

                    long seedVal;
                    if (long.TryParse(txtSeed.Text.Trim(), out seedVal)) BedrockNbtPatcher.SetNbtLongOrIntValue(patched, "RandomSeed", seedVal);

                    long daysVal = w.DaysPlayed;
                    long.TryParse(txtDays.Text.Trim(), out daysVal);
                    if (daysVal < 0) daysVal = 0;

                    long timeOfDayVal = w.WorldTime;
                    long.TryParse(txtTime.Text.Trim(), out timeOfDayVal);
                    timeOfDayVal = ((timeOfDayVal % 24000L) + 24000L) % 24000L;

                    long newTotalTicks = daysVal * 24000L + timeOfDayVal;
                    BedrockNbtPatcher.SetNbtLongOrIntValue(patched, "Time", newTotalTicks);
                    BedrockNbtPatcher.SetNbtLongOrIntValue(patched, "currentTick", newTotalTicks);

                    if (chkDlgNoFire.Checked) BedrockNbtPatcher.SetNbtByteOrIntValue(patched, "dofiretick", 0);
                    if (chkDlgOneSleep.Checked) BedrockNbtPatcher.SetNbtByteOrIntValue(patched, "playerssleepingpercentage", 1);

                    string newName = txtName.Text.Trim();
                    if (!string.IsNullOrEmpty(newName))
                    {
                        patched = BedrockNbtPatcher.ReplaceNbtStringTag(patched, "LevelName", newName);
                        File.WriteAllText(Path.Combine(w.FolderPath, "levelname.txt"), newName, Encoding.UTF8);
                    }

                    using (FileStream fs = new FileStream(w.LevelDatPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete))
                    {
                        fs.Write(patched, 0, patched.Length);
                    }

                    lastSnapshotSignature = "";
                    RefreshWorldsList(false);
                    lblStatusFooter.Text = "🛠️ Mundo '" + newName + "' atualizado (" + daysVal + " Dias Jogados) com sucesso!";
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Erro ao salvar edições: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        private void CopyHighlightedWorldSeed()
        {
            var w = GetHighlightedWorld();
            if (w == null) return;
            Clipboard.SetText(w.RandomSeed.ToString());
            lblStatusFooter.Text = "📋 Seed " + w.RandomSeed + " de '" + w.WorldName + "' copiada para a Área de Transferência!";
        }

        private void ExportHighlightedWorldMcworld()
        {
            var w = GetHighlightedWorld();
            if (w == null || !Directory.Exists(w.FolderPath)) return;

            using (SaveFileDialog sfd = new SaveFileDialog())
            {
                sfd.Title = "Exportar Mundo como Pacote .mcworld";
                sfd.Filter = "Pacote de Mundo Minecraft (*.mcworld)|*.mcworld|Arquivo ZIP (*.zip)|*.zip";
                sfd.FileName = w.WorldName.Replace(" ", "_") + "_ConquistasAtivas.mcworld";
                if (sfd.ShowDialog() == DialogResult.OK)
                {
                    try
                    {
                        if (File.Exists(sfd.FileName)) File.Delete(sfd.FileName);
                        ZipFile.CreateFromDirectory(w.FolderPath, sfd.FileName);
                        lblStatusFooter.Text = "📦 Pacote .mcworld exportado com sucesso: " + sfd.FileName;
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show("Erro ao exportar .mcworld: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                }
            }
        }

        private void RestoreHighlightedWorldBackup()
        {
            var w = GetHighlightedWorld();
            if (w == null) return;
            string bak = w.LevelDatPath + ".bak";
            if (!File.Exists(bak))
            {
                MessageBox.Show("Nenhum arquivo level.dat.bak foi encontrado para este mundo.", "Sem Backup", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            File.Copy(bak, w.LevelDatPath, true);
            lastSnapshotSignature = "";
            RefreshWorldsList(false);
            lblStatusFooter.Text = "🛡️ Backup level.dat.bak restaurado para '" + w.WorldName + "'.";
        }

        private void OpenHighlightedWorldFolder()
        {
            var w = GetHighlightedWorld();
            if (w != null && Directory.Exists(w.FolderPath))
            {
                Process.Start("explorer.exe", w.FolderPath);
            }
        }

        private Label CreateKpiCard(TableLayoutPanel parent, int col, string title, string initialValue, Color accentColor)
        {
            Panel card = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = BgCard,
                Margin = new Padding(6, 0, 6, 0),
                Padding = new Padding(14, 10, 14, 10)
            };

            Label lblCaption = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 8.2f, FontStyle.Bold),
                ForeColor = TextMuted,
                AutoSize = true,
                Location = new Point(14, 10)
            };

            Label lblValue = new Label
            {
                Text = initialValue,
                Font = new Font("Consolas", 20f, FontStyle.Bold),
                ForeColor = accentColor,
                AutoSize = true,
                Location = new Point(12, 30)
            };

            card.Controls.Add(lblCaption);
            card.Controls.Add(lblValue);
            parent.Controls.Add(card, col, 0);
            return lblValue;
        }

        private Button CreateStyledButton(string text, Color bg, Color fg, int width, int height)
        {
            Button btn = new Button
            {
                Text = text,
                Size = new Size(width, height),
                BackColor = bg,
                ForeColor = fg,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold)
            };
            btn.FlatAppearance.BorderColor = BorderSubtle;
            btn.FlatAppearance.BorderSize = 1;
            return btn;
        }

        private void AutoDetectAndLoadWorlds()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

            string uwpPath = Path.Combine(localAppData, @"Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\minecraftWorlds");
            string gdkBase = Path.Combine(appData, @"Minecraft Bedrock\Users");

            if (Directory.Exists(uwpPath))
            {
                txtPath.Text = uwpPath;
            }
            else if (Directory.Exists(gdkBase))
            {
                string foundGdk = Directory.GetDirectories(gdkBase)
                    .Select(u => Path.Combine(u, @"games\com.mojang\minecraftWorlds"))
                    .FirstOrDefault(Directory.Exists);
                txtPath.Text = foundGdk ?? uwpPath;
            }
            else
            {
                txtPath.Text = uwpPath;
            }

            RefreshWorldsList(false);
        }

        private void AutoWatchTimer_Tick(object sender, EventArgs e)
        {
            if (chkAutoWatchFolder != null && chkAutoWatchFolder.Checked)
            {
                RefreshWorldsList(true);
            }
        }

        private void RefreshWorldsList(bool silentIfUnchanged)
        {
            string folder = txtPath.Text.Trim();
            if (!Directory.Exists(folder))
            {
                if (!silentIfUnchanged)
                {
                    lblStatusFooter.Text = "Pasta minecraftWorlds ainda não encontrada neste caminho. Use 'Escolher Pasta' ou 'Abrir .mcworld / level.dat'.";
                }
                return;
            }

            try
            {
                string[] subdirs = Directory.GetDirectories(folder);
                StringBuilder sigBuilder = new StringBuilder();
                foreach (string d in subdirs.OrderBy(x => x))
                {
                    string ldat = Path.Combine(d, "level.dat");
                    if (File.Exists(ldat))
                    {
                        sigBuilder.Append(d).Append('|').Append(File.GetLastWriteTimeUtc(ldat).Ticks).Append(';');
                    }
                }

                string newSig = sigBuilder.ToString();
                if (silentIfUnchanged && newSig == lastSnapshotSignature)
                {
                    return;
                }
                lastSnapshotSignature = newSig;

                var previousSelections = currentWorlds.ToDictionary(w => w.FolderPath, w => w.Selected);

                List<BedrockWorldInfo> loaded = new List<BedrockWorldInfo>();
                foreach (string dir in subdirs)
                {
                    try
                    {
                        BedrockWorldInfo info = BedrockNbtPatcher.InspectWorldFolder(dir);
                        if (info != null)
                        {
                            if (previousSelections.ContainsKey(dir))
                            {
                                info.Selected = previousSelections[dir];
                            }
                            loaded.Add(info);
                        }
                    }
                    catch
                    {
                    }
                }

                currentWorlds = loaded
                    .OrderBy(w => (int)w.Status)
                    .ThenByDescending(w => w.LastModified)
                    .ToList();

                PopulateGrid();
                lblStatusFooter.Text = "Lista atualizada às " + DateTime.Now.ToString("HH:mm:ss") + " (" + currentWorlds.Count + " mundos encontrados).";
            }
            catch (Exception ex)
            {
                if (!silentIfUnchanged)
                {
                    lblStatusFooter.Text = "Erro ao ler pasta: " + ex.Message;
                }
            }
        }

        private void PopulateGrid()
        {
            suppressCheckEvent = true;
            gridWorlds.Rows.Clear();

            string query = (txtSearch != null && txtSearch.Text != null) ? txtSearch.Text.Trim().ToLowerInvariant() : "";

            foreach (var w in currentWorlds)
            {
                if (!string.IsNullOrEmpty(query))
                {
                    bool match = (w.WorldName != null && w.WorldName.ToLowerInvariant().Contains(query)) ||
                                 (w.FolderName != null && w.FolderName.ToLowerInvariant().Contains(query));
                    if (!match) continue;
                }

                int rowIndex = gridWorlds.Rows.Add(
                    w.Selected,
                    w.WorldName,
                    w.StatusText,
                    w.DetailsText,
                    w.FolderName + " (" + w.LastModified.ToString("dd/MM HH:mm") + ")"
                );

                DataGridViewRow row = gridWorlds.Rows[rowIndex];
                row.Tag = w;

                if (w.Status == WorldStatus.BlockedRed)
                {
                    row.DefaultCellStyle.BackColor = ColorTranslator.FromHtml("#4A1218");
                    row.DefaultCellStyle.ForeColor = ColorTranslator.FromHtml("#FEE2E2");
                    row.DefaultCellStyle.SelectionBackColor = ColorTranslator.FromHtml("#7A1C28");
                    row.DefaultCellStyle.SelectionForeColor = Color.White;
                    row.Cells["StatusText"].Style.BackColor = ColorTranslator.FromHtml("#5C1720");
                    row.Cells["StatusText"].Style.ForeColor = Color.White;
                    row.Cells["StatusText"].Style.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
                }
                else if (w.Status == WorldStatus.ExperimentalYellow)
                {
                    row.DefaultCellStyle.BackColor = ColorTranslator.FromHtml("#292112");
                    row.DefaultCellStyle.ForeColor = ColorTranslator.FromHtml("#FDE68A");
                    row.Cells["StatusText"].Style.ForeColor = TrophyGold;
                    row.Cells["StatusText"].Style.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
                }
                else
                {
                    row.DefaultCellStyle.BackColor = ColorTranslator.FromHtml("#0D231D");
                    row.DefaultCellStyle.ForeColor = ColorTranslator.FromHtml("#A7F3D0");
                    row.Cells["StatusText"].Style.ForeColor = EmeraldGreen;
                    row.Cells["StatusText"].Style.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
                }
            }

            suppressCheckEvent = false;
            UpdateKpiCounters();
        }

        private void UpdateKpiCounters()
        {
            int total = currentWorlds.Count;
            int selected = currentWorlds.Count(w => w.Selected);
            int blocked = currentWorlds.Count(w => w.Status == WorldStatus.BlockedRed);
            int active = currentWorlds.Count(w => w.Status == WorldStatus.ActiveGreen);

            lblKpiTotal.Text = total.ToString();
            lblKpiSelected.Text = selected.ToString();
            lblKpiBlocked.Text = blocked.ToString();
            lblKpiActive.Text = active.ToString();
        }

        private void GridWorlds_CurrentCellDirtyStateChanged(object sender, EventArgs e)
        {
            if (gridWorlds.IsCurrentCellDirty)
            {
                gridWorlds.CommitEdit(DataGridViewDataErrorContexts.Commit);
            }
        }

        private void GridWorlds_CellValueChanged(object sender, DataGridViewCellEventArgs e)
        {
            if (suppressCheckEvent || e.RowIndex < 0 || e.ColumnIndex != 0) return;

            DataGridViewRow row = gridWorlds.Rows[e.RowIndex];
            BedrockWorldInfo world = row.Tag as BedrockWorldInfo;
            if (world == null) return;

            bool isChecked = Convert.ToBoolean(row.Cells[0].Value);
            world.Selected = isChecked;
            UpdateKpiCounters();

            if (isChecked && chkAutoApplyOnCheck.Checked)
            {
                PatchSingleWorld(world);
                lastSnapshotSignature = "";
                RefreshWorldsList(false);
            }
        }

        private void SetAllChecked(bool checkState, bool onlyRedBlocked)
        {
            foreach (var w in currentWorlds)
            {
                if (onlyRedBlocked)
                {
                    w.Selected = (w.Status == WorldStatus.BlockedRed || w.Status == WorldStatus.ExperimentalYellow);
                }
                else
                {
                    w.Selected = checkState;
                }
            }
            PopulateGrid();

            if (checkState && chkAutoApplyOnCheck.Checked)
            {
                ApplyPatchToSelectedWorlds();
            }
        }

        private int PatchSingleWorld(BedrockWorldInfo world)
        {
            byte[] original = BedrockNbtPatcher.ReadFileShared(world.LevelDatPath);
            if (chkOptBackup.Checked)
            {
                File.WriteAllBytes(world.LevelDatPath + ".bak", original);
            }

            int changes;
            byte[] patched = BedrockNbtPatcher.PatchLevelDatBytes(
                original,
                chkOptAchievements.Checked,
                chkOptExperiments.Checked,
                chkOptTemplates.Checked,
                chkOptHardcore.Checked,
                chkOptKeepInventory.Checked,
                chkOptShowCoords.Checked,
                chkOptShowDays.Checked,
                chkOptClearWeather.Checked,
                0L,
                out changes
            );

            using (FileStream fs = new FileStream(world.LevelDatPath, FileMode.Create, FileAccess.Write, FileShare.ReadWrite | FileShare.Delete))
            {
                fs.Write(patched, 0, patched.Length);
            }

            return changes;
        }

        private void ApplyPatchToSelectedWorlds()
        {
            var selected = currentWorlds.Where(w => w.Selected).ToList();
            if (selected.Count == 0)
            {
                MessageBox.Show(
                    "Marque pelo menos um mundo com [✔] na tabela para aplicar a reativação de conquistas.",
                    "Nenhum Mapa Marcado",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
                return;
            }

            int worldsPatched = 0;
            int totalFlagsFixed = 0;

            foreach (var w in selected)
            {
                try
                {
                    totalFlagsFixed += PatchSingleWorld(w);
                    w.Selected = false;
                    worldsPatched++;
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Erro ao corrigir '" + w.WorldName + "': " + ex.Message, "Erro de Gravação", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }

            lastSnapshotSignature = "";
            RefreshWorldsList(false);
            lblStatusFooter.Text = "✔ " + worldsPatched + " mundo(s) reativado(s) com sucesso! (" + totalFlagsFixed + " flags corrigidas)";
        }

        private void BtnBrowseFolder_Click(object sender, EventArgs e)
        {
            using (FolderBrowserDialog fbd = new FolderBrowserDialog())
            {
                fbd.Description = "Selecione a pasta minecraftWorlds ou a pasta de um mundo específico";
                if (Directory.Exists(txtPath.Text))
                    fbd.SelectedPath = txtPath.Text;

                if (fbd.ShowDialog() == DialogResult.OK)
                {
                    txtPath.Text = fbd.SelectedPath;
                    lastSnapshotSignature = "";
                    RefreshWorldsList(false);
                }
            }
        }

        private void BtnSingleFile_Click(object sender, EventArgs e)
        {
            using (OpenFileDialog ofd = new OpenFileDialog())
            {
                ofd.Title = "Selecione um arquivo level.dat, .mcworld ou .zip";
                ofd.Filter = "Mundos Minecraft (level.dat;*.mcworld;*.zip)|level.dat;*.mcworld;*.zip|Todos os arquivos (*.*)|*.*";
                if (ofd.ShowDialog() == DialogResult.OK)
                {
                    string filePath = ofd.FileName;
                    try
                    {
                        if (filePath.EndsWith(".mcworld", StringComparison.OrdinalIgnoreCase) ||
                            filePath.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                        {
                            PatchArchiveFile(filePath);
                        }
                        else
                        {
                            byte[] raw = BedrockNbtPatcher.ReadFileShared(filePath);
                            if (chkOptBackup.Checked)
                                File.WriteAllBytes(filePath + ".bak", raw);

                            int changes;
                            byte[] patched = BedrockNbtPatcher.PatchLevelDatBytes(
                                raw,
                                chkOptAchievements.Checked,
                                chkOptExperiments.Checked,
                                chkOptTemplates.Checked,
                                chkOptHardcore.Checked,
                                chkOptKeepInventory.Checked,
                                chkOptShowCoords.Checked,
                                chkOptShowDays.Checked,
                                chkOptClearWeather.Checked,
                                0L,
                                out changes
                            );
                            File.WriteAllBytes(filePath, patched);
                            MessageBox.Show("Arquivo level.dat corrigido com sucesso! (" + changes + " flags alteradas).", "Sucesso", MessageBoxButtons.OK, MessageBoxIcon.Information);
                        }
                    }
                    catch (Exception ex)
                    {
                        MessageBox.Show("Erro ao processar arquivo: " + ex.Message, "Erro", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }
                }
            }
        }

        private void PatchArchiveFile(string archivePath)
        {
            string tempDir = Path.Combine(Path.GetTempPath(), "BedrockPatch_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);
            try
            {
                ZipFile.ExtractToDirectory(archivePath, tempDir);
                string[] levelDats = Directory.GetFiles(tempDir, "level.dat", SearchOption.AllDirectories);
                if (levelDats.Length == 0)
                {
                    MessageBox.Show("Nenhum arquivo level.dat foi encontrado dentro do pacote selecionado.", "Aviso", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                int totalChanges = 0;
                foreach (string ldat in levelDats)
                {
                    byte[] raw = File.ReadAllBytes(ldat);
                    int chg;
                    byte[] patched = BedrockNbtPatcher.PatchLevelDatBytes(
                        raw,
                        chkOptAchievements.Checked,
                        chkOptExperiments.Checked,
                        chkOptTemplates.Checked,
                        chkOptHardcore.Checked,
                        chkOptKeepInventory.Checked,
                        chkOptShowCoords.Checked,
                        chkOptShowDays.Checked,
                        chkOptClearWeather.Checked,
                        0L,
                        out chg
                    );
                    File.WriteAllBytes(ldat, patched);
                    totalChanges += chg;
                }

                if (chkOptBackup.Checked)
                {
                    File.Copy(archivePath, archivePath + ".bak", true);
                }

                File.Delete(archivePath);
                ZipFile.CreateFromDirectory(tempDir, archivePath);
                MessageBox.Show("Pacote " + Path.GetFileName(archivePath) + " corrigido com sucesso! (" + totalChanges + " flags redefinidas).", "Conquistas Reativadas", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            finally
            {
                if (Directory.Exists(tempDir))
                    Directory.Delete(tempDir, true);
            }
        }

        private static Icon CreateGoldenTrophyIcon()
        {
            Bitmap bmp = new Bitmap(64, 64);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (SolidBrush bg = new SolidBrush(ColorTranslator.FromHtml("#0B0F19")))
                using (Pen border = new Pen(ColorTranslator.FromHtml("#1E293B"), 3f))
                using (SolidBrush gold = new SolidBrush(ColorTranslator.FromHtml("#F59E0B")))
                using (Pen goldPen = new Pen(ColorTranslator.FromHtml("#F59E0B"), 4f))
                using (SolidBrush emerald = new SolidBrush(ColorTranslator.FromHtml("#10B981")))
                using (Pen whiteCheck = new Pen(Color.White, 3.5f))
                {
                    g.FillEllipse(bg, 2, 2, 60, 60);
                    g.DrawEllipse(border, 2, 2, 60, 60);
                    g.DrawArc(goldPen, 12, 16, 12, 14, 90, 180);
                    g.DrawArc(goldPen, 34, 16, 12, 14, 270, 180);
                    g.FillPie(gold, 16, 10, 26, 28, 0, 180);
                    g.FillRectangle(gold, 16, 12, 26, 10);
                    g.FillRectangle(gold, 26, 34, 6, 12);
                    g.FillRectangle(gold, 18, 45, 22, 6);
                    g.FillEllipse(emerald, 36, 36, 24, 24);
                    g.DrawLines(whiteCheck, new Point[] { new Point(42, 48), new Point(47, 53), new Point(55, 43) });
                }
            }
            return Icon.FromHandle(bmp.GetHicon());
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
