# 🏆 Reativador de Conquistas & Hardcore — Minecraft Bedrock (v5.0 TITAN)
**Bedrock Achievement Enabler, Hardcore Mode Converter, Days Played Editor & Experimental Flag Remover**

> 📌 **DICA PARA PUBLICAÇÃO NO CURSEFORGE:**  
> Os moderadores do CurseForge exigem que a página do projeto contenha descrição em **Inglês** (ou **Bilíngue: Português + Inglês**) para aprovação rápida. Abaixo você encontra os campos prontos para copiar e colar no formulário do CurseForge, seguidos do texto completo em **Português (PT-BR)** e **Inglês (EN-US)**.

---

## 📋 Campos Rápidos para o Formulário do CurseForge

- **Project Name (Nome do Projeto):** `Bedrock Achievement Enabler & Hardcore Converter (Reativador de Conquistas)`
- **Summary (Resumo Curto - máx. 255 caracteres):**
  - **PT-BR:** `Reative conquistas da Xbox Live, ative/reviva o Modo Hardcore oficial, aumente os Dias Jogados e remova o selo [Experimental] em mundos do Minecraft Bedrock (1.21.50 a 1.21.80+) sem perder construções ou inventário.`
  - **EN-US:** `Re-enable Xbox Live Achievements, toggle/revive official Hardcore Mode, edit Days Played, and remove [Experimental] tags in Minecraft Bedrock worlds (1.21.50 to 1.21.80+) without losing builds or inventory.`
- **Suggested Category (Categoria Sugerida):** `Utility & QoL` / `Map & Information` / `External Tools`
- **Supported Versions:** `Minecraft Bedrock 1.21.50`, `1.21.60`, `1.21.70`, `1.21.80+` (Windows 10/11 UWP & GDK, Android, iOS)

---
---

# 🇧🇷 DESCRIÇÃO EM PORTUGUÊS (PT-BR)

# 🏆 Reativador de Conquistas & Editor NBT — Minecraft Bedrock (v5.0 TITAN)

Você precisou entrar no **Modo Criativo**, ativar **Cheats/Comandos** para recuperar um item perdido por bug, testar um recurso **[Experimental]** ou morreu injustamente no **Modo Hardcore** e agora seu mundo perdeu as conquistas da Xbox Live para sempre?

O **Reativador de Conquistas — Minecraft Bedrock (v5.0 TITAN)** é uma ferramenta completa — disponível tanto como **Programa Desktop Nativo para Windows (`.EXE`)** quanto como **Plataforma Web (PC, Android e iOS)** — que edita cirurgicamente o arquivo binário `level.dat` (formato NBT Little-Endian) para **reativar conquistas da Xbox Live**, **colocar ou reviver mundos no Modo Hardcore Oficial**, **aumentar os Dias Jogados** e **destravar templates do Marketplace**, preservando **100% das suas construções, inventário, animais, chunks e entidades**.

---

## ✨ Principais Funcionalidades (v5.0 TITAN)

### 1. 🏆 Reativação Total de Conquistas (Xbox Live / PlayStation / Switch / Mobile)
- Limpa instantaneamente todas as travas permanentes de conquistas gravadas no `level.dat`:
  - `hasBeenLoadedInCreative = 0`
  - `commandsEnabled = 0`
  - `cheatsEnabled = 0`
  - `commandblockoutput = 0` e `commandblocksacEnabled = 0`
  - `ForceGameType = 0` e retorna `GameType` de `1` (Criativo) para `0` (Sobrevivência)

### 2. 💀 Conversor e Revivedor de Modo Hardcore Oficial (Bedrock 1.21+)
- **Ativar Modo Hardcore em 1 Clique (`💀 Ativar Hardcore`):** Transforme qualquer mundo de sobrevivência antigo no **Modo Hardcore Oficial** do Minecraft Bedrock (`IsHardcore = 1`, `Difficulty = 3 [Difícil]`, `GameType = 0` e conquistas ativas).
- **Reviver do Modo Espectador (`💖 Tirar Hardcore / Reviver`):** Morreu no Hardcore e ficou preso como fantasma no modo Espectador (`GameType = 6`)? Remova a trava `IsHardcore = 0` e volte imediatamente ao modo Sobrevivência com todos os seus itens!

### 3. 📅 Editor de Dias Jogados + Calculadora de Tempo Real
- **Aumentar ou Editar Dias Jogados:** Adicione `+10`, `+100`, `+500`, `+1.000`, `+5.000` dias ou digite qualquer valor personalizado!
- Sincroniza automaticamente as tags binárias de 64 bits `Time` e `currentTick` (`1 Dia = 24.000 Ticks = 20 minutos reais`) e ativa o contador nativo na tela (`showdaysplayed = 1`) **sem desativar conquistas**.
- **Metas de Sobrevivência:** Acompanhe seu progresso rumo aos marcos de *100 Dias*, *500 Dias*, *1.000 Dias Titan* e *2.500 Dias Imortal*.

### 4. 🧪 Remoção do Selo `[Experimental]` (14 Flags NBT)
- Remove o aviso `[Experimental]` da lista de mundos e permite atualizar o mapa normalmente em versões futuras do jogo, zerando:
  - `experiments_ever_used`, `saved_with_toggled_experiments`, `gametest`, `data_driven_items`, `data_driven_biomes`, `upcoming_creator_features`, `experimental_molang_features`, `cameras`, `villager_trades_rebalance` e `updateAnnouncedLive2023`.

### 5. 🔓 Desbloqueio de Mapas Template / Marketplace
- Destrava mundos criados a partir de templates que bloqueiam opções ou conquistas:
  - `hasLockedBehaviorPack = 0`, `hasLockedResourcePack = 0`, `isFromLockedTemplate = 0`, `isFromWorldTemplate = 0` e `isWorldTemplateOptionLocked = 0`.

### 6. 🎮 Gamerules Seguras (Sem Perder Conquistas!)
Ative vantagens diretamente no binário `level.dat` mantendo `commandsEnabled = 0` (conquistas 100% liberadas):
- 🎒 **Manter Inventário ao Morrer (`keepinventory = 1`)**
- 📍 **Mostrar Coordenadas na Tela (`showcoordinates = 1`)**
- 📅 **Mostrar Contador de Dias Jogados (`showdaysplayed = 1`)**
- 🛏️ **1 Jogador Dorme e Pula a Noite no Multiplayer (`playerssleepingpercentage = 1%`)**
- 🌱 **Velocidade das Plantas / Tick Speed (`randomtickspeed = 1, 3, 10`)**
- 🔥 **Desativar Espalhamento de Fogo (`dofiretick = 0`)**
- ☀️ **Limpar Chuva/Tempestade e Definir Meio-Dia (preservando os Dias Jogados)**
- 🧭 **Editor de Ponto de Spawn (`SpawnX`, `SpawnY`, `SpawnZ`) e Seed (`RandomSeed`)**
- 📑 **Clonador de Mundos Limpos:** Cria uma cópia completa do seu mundo em uma nova pasta já com conquistas ativas.

---

## 🖥️ Como Usar no Windows (`.EXE` ou Gerador 1-Clique `.BAT`)

1. Baixe o **`ReativadorConquistasBedrock.exe`** (ou o pacote completo `.ZIP`).
2. Ao abrir o programa, ele **detecta automaticamente** a sua pasta `minecraftWorlds` (compatível tanto com a instalação padrão **UWP** da Microsoft Store quanto **GDK** do novo Launcher).
   - *Leitura em Tempo Real (`FileShare.ReadWrite`):* O programa consegue listar e ler mundos recém-criados mesmo com o Minecraft aberto, destacando em **🔴 VERMELHO** os mundos bloqueados sem conquista e em **🟢 VERDE** os mundos liberados.
3. Marque os mundos desejados com **`[✔]`** (ou clique em **"🔴 Marcar Só os Vermelhos"**).
4. Escolha as opções desejadas (Reativar Conquistas, Modo Hardcore, KeepInventory, +100 Dias Jogados) e clique em **"✔ APLICAR NOS MARCADOS"**.
5. **Backup Automático (`level.dat.bak`):** Antes de qualquer alteração, o programa cria automaticamente uma cópia de segurança exata (`level.dat.bak`) que pode ser restaurada em 1 clique.

> 💡 **Opção Sem Bloqueio do Windows Defender / SmartScreen (`.BAT`):**  
> Caso prefira, basta executar o arquivo **`Criar_ReativadorConquistas_EXE.bat`**. Ele utiliza o compilador oficial nativo do próprio Windows (`csc.exe` do .NET Framework) para gerar o `ReativadorConquistasBedrock.exe` com o ícone dourado `reativador.ico` diretamente na sua máquina e criar o atalho na Área de Trabalho!

---

## 📱 Como Usar no Android, iOS ou Navegador Web

1. Exporte seu mundo como `.mcworld` / `.zip` ou localize o arquivo `level.dat` na pasta `games/com.mojang/minecraftWorlds/`.
2. Carregue o arquivo na plataforma Web.
3. Clique em **Aplicar / Editar Dias / Ativar Hardcore** e baixe o novo arquivo **`.mcworld`** pronto para abrir e importar direto no Minecraft Bedrock!

---
---

# 🇺🇸 ENGLISH DESCRIPTION (EN-US)

# 🏆 Bedrock Achievement Enabler, Hardcore Converter & NBT World Editor (v5.0 TITAN)

Did you accidentally switch to **Creative Mode**, enable **Cheats/Commands** to recover items lost to a bug, toggle **[Experimental]** features, or die in **Hardcore Mode** and lose your world forever?

**Bedrock Achievement Enabler & Hardcore Converter (v5.0 TITAN)** is an all-in-one binary Little-Endian NBT patcher for **Minecraft Bedrock Edition (1.21.50 to 1.21.80+)** — available both as a **Native Windows Desktop Application (`.EXE`)** and a **Web Application (Windows, Android, iOS)**. It safely patches your world's `level.dat` file to **re-enable Xbox Live Achievements**, **convert worlds to or from Official Hardcore Mode**, **increase Days Played**, and **remove Experimental locks**, while keeping **100% of your builds, inventory, chunks, and entities intact**.

---

## ✨ Key Features (v5.0 TITAN)

### 1. 🏆 Re-Enable Xbox Live Achievements
- Resets all achievement-blocking NBT flags inside `level.dat` back to clean survival state:
  - `hasBeenLoadedInCreative = 0`
  - `commandsEnabled = 0` & `cheatsEnabled = 0`
  - `commandblockoutput = 0` & `commandblocksacEnabled = 0`
  - `ForceGameType = 0` and switches `GameType` from `1` (Creative) to `0` (Survival)

### 2. 💀 Official Hardcore Mode Converter & Spectator Revival (Bedrock 1.21+)
- **1-Click Enable Hardcore Mode (`💀 Hardcore`):** Convert any existing world into official Minecraft Bedrock Hardcore Mode (`IsHardcore = 1`, `Difficulty = 3 [Hard]`, `GameType = 0`, Achievements Active).
- **1-Click Revive / Disable Hardcore (`💖 Revive`):** Died in Hardcore and stuck in Spectator Mode (`GameType = 6`)? Set `IsHardcore = 0` and restore `GameType = 0` (Survival) in one click without losing your world!

### 3. 📅 Days Played Editor & Real-Time Survival Calculator
- **Add or Edit Days Played:** Boost your world counter by `+10`, `+100`, `+500`, `+1,000`, `+5,000` days or set any exact day count.
- Synchronizes 64-bit `Time` and `currentTick` tags (`1 Day = 24,000 Ticks = 20 real-life minutes`) while preserving your current time of day, and enables the on-screen counter (`showdaysplayed = 1`) with achievements active.

### 4. 🧪 Remove `[Experimental]` World Tag (14 Flags)
- Clears all experimental flags (`experiments_ever_used`, `saved_with_toggled_experiments`, `gametest`, `data_driven_items`, `data_driven_biomes`, `upcoming_creator_features`, `experimental_molang_features`, `cameras`, `villager_trades_rebalance`, `updateAnnouncedLive2023`).

### 5. 🔓 Unlock Marketplace & World Templates
- Removes template restrictions (`hasLockedBehaviorPack = 0`, `hasLockedResourcePack = 0`, `isFromLockedTemplate = 0`, `isFromWorldTemplate = 0`, `isWorldTemplateOptionLocked = 0`).

### 6. 🎮 Safe Gamerules (Keep Achievements Active!)
Enable quality-of-life gamerules directly in the binary NBT while keeping `commandsEnabled = 0`:
- 🎒 **Keep Inventory (`keepinventory = 1`)** — Never lose your items on death while still earning Xbox Achievements!
- 📍 **Show Coordinates (`showcoordinates = 1`)** & **Show Days Played (`showdaysplayed = 1`)**
- 🛏️ **1-Player Sleep for Multiplayer (`playerssleepingpercentage = 1%`)**
- 🌱 **Custom Random Tick Speed (`randomtickspeed`)**
- 🧭 **Edit World Name (with `§` color codes), RandomSeed, and Spawn Coordinates (`SpawnX`, `SpawnY`, `SpawnZ`)**
- 🛡️ **Automatic Binary Backup (`level.dat.bak`):** Every operation automatically saves a backup of your original `level.dat` for 1-click restoration.

---

## 📦 Files Included
- **`ReativadorConquistasBedrock.exe`**: Standalone native Windows Forms executable (.NET Framework 4.x) with auto-detection for UWP & GDK `minecraftWorlds` folders, vivid red/green status highlighting, and a 3-second live world watcher.
- **`Criar_ReativadorConquistas_EXE.bat`**: 1-click local compiler script using Windows built-in `csc.exe` (100% transparent plain-text source code, zero Base64/PowerShell obfuscation, zero SmartScreen warnings).
- **`ReativadorConquistasBedrock.cs`**: Full auditable C# source code (`[assembly: AssemblyVersion("5.0.0.0")]`).

---

## 🛡️ Nota de Segurança & Falso-Positivo de Antivírus / SmartScreen (100% Open-Source)
- **Por que o Windows Defender / SmartScreen pode exibir aviso em programas independentes?**
  1. **Assinatura Digital Comercial (SmartScreen):** A Microsoft exige um certificado digital pago (*Authenticode EV*, que custa centenas de dólares por ano) para que novos executáveis `.exe` não exibam o aviso *"O Windows protegeu o computador (Editor Desconhecido)"*.
  2. **Versão v5.0 100% Limpa (Sem Gatilhos Heurísticos):** Removemos qualquer uso de codificação Base64 (`certutil -decode`) ou `powershell -ExecutionPolicy Bypass` do script `.BAT`, que costumavam acionar falsos-positivos heurísticos em antivírus. Agora o arquivo `.BAT` e o `.CS` são **100% texto puro legível** (você pode clicar com o botão direito -> *Editar no Bloco de Notas* e ler cada linha do código!).
  3. **Compilação Local 1-Clique:** Se o seu antivírus bloquear o `.exe` baixado da internet, basta dar 2 cliques em **`Criar_ReativadorConquistas_EXE.bat`** — ele usa o compilador oficial da própria Microsoft que já vem dentro do seu Windows (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`) para gerar o `.exe` na hora na sua máquina, com confiança total do sistema!

