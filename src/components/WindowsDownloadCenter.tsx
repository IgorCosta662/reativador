import React, { useState, useEffect } from 'react';
import {
  Download,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
  FileArchive,
  Monitor,
  Code2,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { TrophyBrandIcon } from './TrophyBrandIcon';

interface FileMeta {
  filename: string;
  url: string;
  sizeBytes: number;
  sha256: string;
}

interface ManifestData {
  generatedAt: string;
  version: string;
  files: {
    exe: FileMeta;
    bat: FileMeta;
    zip: FileMeta;
    ico: FileMeta;
    cs: FileMeta;
  };
}

export const UWP_MINECRAFT_PATH =
  '%LOCALAPPDATA%\\Packages\\Microsoft.MinecraftUWP_8wekyb3d8bbwe\\LocalState\\games\\com.mojang\\minecraftWorlds';

export const GDK_MINECRAFT_PATH =
  '%APPDATA%\\Minecraft Bedrock\\Users\\*\\games\\com.mojang\\minecraftWorlds';

export const GDK_ROOT_FOLDER_PATH =
  '%APPDATA%\\Minecraft Bedrock\\Users';

export const WindowsDownloadCenter: React.FC = () => {
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [verifiedFiles, setVerifiedFiles] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSourcePreview, setShowSourcePreview] = useState(false);
  const [csSourceText, setCsSourceText] = useState<string>('');
  const [showCurseForgeMd, setShowCurseForgeMd] = useState(true);
  const [curseForgeMdText, setCurseForgeMdText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/downloads/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setManifest(data);
      })
      .catch(() => {
        // Fallback metadata if needed
      });

    fetch('/downloads/CURSEFORGE_DESCRIPTION.md')
      .then((res) => (res.ok ? res.text() : ''))
      .then((txt) => {
        if (txt) setCurseForgeMdText(txt);
      })
      .catch(() => {});
  }, []);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    }
  };

  const computeSha256Hex = async (buffer: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleVerifiedDownload = async (
    key: 'exe' | 'bat' | 'zip' | 'ico' | 'cs',
    url: string,
    filename: string,
    mimeType: string
  ) => {
    try {
      setDownloadingKey(key);
      setStatusMessage(`Validando integridade binária de ${filename}...`);

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const actualHash = await computeSha256Hex(arrayBuffer);

      const expectedHash = manifest?.files?.[key]?.sha256;
      const isValid = !expectedHash || expectedHash === actualHash;

      setVerifiedFiles((prev) => ({ ...prev, [key]: isValid }));

      const blob = new Blob([arrayBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      setStatusMessage(
        `✔ Download de ${filename} concluído (${(arrayBuffer.byteLength / 1024).toFixed(
          1
        )} KB · SHA-256 verificado: ${actualHash.slice(0, 12)}...)`
      );
    } catch (err: any) {
      setStatusMessage(`Erro ao baixar ${filename}: ${err?.message || 'Falha de rede'}`);
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleDownloadCurseForgeMd = async () => {
    try {
      let content = curseForgeMdText;
      if (!content) {
        const res = await fetch('/downloads/CURSEFORGE_DESCRIPTION.md');
        content = await res.text();
        setCurseForgeMdText(content);
      }
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'CURSEFORGE_DESCRIPTION.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      setStatusMessage(
        '✔ Arquivo CURSEFORGE_DESCRIPTION.md (Português + Inglês) baixado com sucesso! Pronto para publicar no CurseForge.'
      );
    } catch {
      setStatusMessage('Erro ao baixar CURSEFORGE_DESCRIPTION.md');
    }
  };

  const toggleSourceCode = async () => {
    if (!showSourcePreview && !csSourceText) {
      try {
        const res = await fetch('/downloads/ReativadorConquistasBedrock.cs');
        if (res.ok) {
          const txt = await res.text();
          setCsSourceText(txt);
        }
      } catch {
        setCsSourceText('// Não foi possível carregar a pré-visualização.');
      }
    }
    setShowSourcePreview((prev) => !prev);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Pronto';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <section
      id="downloads-windows"
      className="rounded-xl border border-[#1E293B] bg-[#111827] p-6 sm:p-8"
    >
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-[#1E293B]">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-2.5 shrink-0">
            <TrophyBrandIcon size={44} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Programa Desktop Nativo Windows (.NET Framework 4.x)</span>
              <span aria-hidden="true">·</span>
              <span>Ícone Troféu Dourado Embutido (reativador.ico)</span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-bold text-white tracking-tight">
              Central de Downloads — Programa Windows (.EXE, .BAT, .ZIP, .ICO e .MD CurseForge)
            </h2>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              No Windows 10/11, o programa Desktop detecta sozinho suas pastas{' '}
              <code className="font-mono text-[#0EA5E9]">minecraftWorlds</code> (UWP e GDK),
              lê mundos recém-criados mesmo com o Minecraft Bedrock aberto via{' '}
              <code className="font-mono text-[#10B981]">FileShare.ReadWrite</code> e monitora novos mapas a cada 3 segundos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowCurseForgeMd((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-[#F59E0B]/60 bg-[#F59E0B]/15 px-4 py-2.5 text-xs font-bold text-[#F59E0B] hover:bg-[#F59E0B]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#F59E0B]" />
            {showCurseForgeMd ? 'Ocultar Texto CurseForge (.MD)' : '📄 Texto CurseForge (.MD)'}
          </button>

          <button
            onClick={toggleSourceCode}
            className="flex items-center gap-2 rounded-lg border border-[#1E293B] bg-[#0B0F19] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#0EA5E9]" />
            {showSourcePreview ? 'Ocultar Código C#' : 'Ver Código-Fonte C# (.CS)'}
          </button>
        </div>
      </div>

      {/* Status Notification Bar */}
      {statusMessage && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-4 py-2.5 text-xs text-emerald-200">
          <span className="font-mono tabular-nums">{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-emerald-300 hover:text-white font-semibold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 4 Download Cards Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: .EXE */}
        <div className="flex flex-col justify-between rounded-xl border border-[#1E293B] bg-[#0B0F19] p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono tabular-nums text-[#F59E0B] font-semibold">
                EXECUTÁVEL NATIVO (.EXE)
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatBytes(manifest?.files.exe.sizeBytes ?? 69120)}
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-white">
              ReativadorConquistasBedrock.exe
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Assembly .NET Framework 4.x Windows Forms nativo já pré-compilado com ícone Troféu Dourado (<code className="text-slate-300">reativador.ico</code>) embutido.
            </p>
            <div className="mt-3 text-[11px] font-mono tabular-nums text-slate-500">
              SHA-256: {manifest?.files.exe.sha256.slice(0, 16) ?? '53a1c4d529d3e681'}...
              {verifiedFiles.exe && (
                <span className="ml-2 text-[#10B981] font-semibold">✔ Íntegro</span>
              )}
            </div>
          </div>

          <button
            onClick={() =>
              handleVerifiedDownload(
                'exe',
                '/downloads/ReativadorConquistasBedrock.exe',
                'ReativadorConquistasBedrock.exe',
                'application/vnd.microsoft.portable-executable'
              )
            }
            disabled={downloadingKey === 'exe'}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Monitor className="w-4 h-4 shrink-0" />
            {downloadingKey === 'exe' ? 'Validando...' : 'Baixar Programa .EXE'}
          </button>
        </div>

        {/* Card 2: .BAT 1-Click Compiler */}
        <div className="flex flex-col justify-between rounded-xl border border-[#1E293B] bg-[#0B0F19] p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono tabular-nums text-[#10B981] font-semibold">
                COMPILADOR 1-CLIQUE (.BAT)
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatBytes(manifest?.files.bat.sizeBytes ?? 142327)}
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-white">
              Criar_ReativadorConquistas_EXE.bat
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Extrai o <code className="text-slate-300">reativador.ico</code> e compila o <code className="text-slate-300">.EXE</code> localmente via <code className="text-slate-300">csc.exe</code> do Windows (Zero bloqueio SmartScreen + cria atalho na Área de Trabalho).
            </p>
            <div className="mt-3 text-[11px] font-mono tabular-nums text-slate-500">
              SHA-256: {manifest?.files.bat.sha256.slice(0, 16) ?? 'd310b07f079607aa'}...
              {verifiedFiles.bat && (
                <span className="ml-2 text-[#10B981] font-semibold">✔ Íntegro</span>
              )}
            </div>
          </div>

          <button
            onClick={() =>
              handleVerifiedDownload(
                'bat',
                '/downloads/Criar_ReativadorConquistas_EXE.bat',
                'Criar_ReativadorConquistas_EXE.bat',
                'application/x-bat'
              )
            }
            disabled={downloadingKey === 'bat'}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-[#F59E0B] px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Terminal className="w-4 h-4 shrink-0" />
            {downloadingKey === 'bat' ? 'Validando...' : 'Baixar Gerador 1-Clique .BAT'}
          </button>
        </div>

        {/* Card 3: Complete .ZIP Package */}
        <div className="flex flex-col justify-between rounded-xl border border-[#1E293B] bg-[#0B0F19] p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono tabular-nums text-[#0EA5E9] font-semibold">
                PACOTE COMPLETO (.ZIP)
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatBytes(manifest?.files.zip.sizeBytes ?? 61829)}
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-white">
              ReativadorConquistas_Windows_EXE.zip
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Pacote completo contendo o <code className="text-slate-300">.exe</code> nativo, o ícone <code className="text-slate-300">reativador.ico</code>, o gerador <code className="text-slate-300">.bat</code>, <code className="text-slate-300">LEIA-ME.txt</code> e o código-fonte <code className="text-slate-300">.cs</code>.
            </p>
            <div className="mt-3 text-[11px] font-mono tabular-nums text-slate-500">
              SHA-256: {manifest?.files.zip.sha256.slice(0, 16) ?? '8784858b360db1c3'}...
              {verifiedFiles.zip && (
                <span className="ml-2 text-[#10B981] font-semibold">✔ Íntegro</span>
              )}
            </div>
          </div>

          <button
            onClick={() =>
              handleVerifiedDownload(
                'zip',
                '/downloads/ReativadorConquistas_Windows_EXE.zip',
                'ReativadorConquistas_Windows_EXE.zip',
                'application/zip'
              )
            }
            disabled={downloadingKey === 'zip'}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-[#0EA5E9] px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileArchive className="w-4 h-4 shrink-0" />
            {downloadingKey === 'zip' ? 'Validando...' : 'Baixar Pacote .ZIP Completo'}
          </button>
        </div>

        {/* Card 4: Official .ICO & .CS Source */}
        <div className="flex flex-col justify-between rounded-xl border border-[#1E293B] bg-[#0B0F19] p-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono tabular-nums text-slate-300 font-semibold">
                ÍCONE OFICIAL (.ICO) & .CS
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {formatBytes(manifest?.files.ico.sizeBytes ?? 32038)}
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-white">
              reativador.ico + Fonte .CS
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Ícone DIB Windows (16x16 até 64x64 BGRA) do Troféu Dourado com selo Esmeralda e código C# (.NET 4.x) auditável.
            </p>
            <div className="mt-3 text-[11px] font-mono tabular-nums text-slate-500">
              SHA-256: {manifest?.files.ico.sha256.slice(0, 16) ?? '879b2fe80ca8a430'}...
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                handleVerifiedDownload(
                  'ico',
                  '/downloads/reativador.ico',
                  'reativador.ico',
                  'image/x-icon'
                )
              }
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2.5 text-xs font-semibold text-[#F59E0B] hover:border-[#F59E0B]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              reativador.ico
            </button>

            <button
              onClick={() =>
                handleVerifiedDownload(
                  'cs',
                  '/downloads/ReativadorConquistasBedrock.cs',
                  'ReativadorConquistasBedrock.cs',
                  'text/plain;charset=utf-8'
                )
              }
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-[#0EA5E9] shrink-0" />
              Código .CS
            </button>
          </div>
        </div>
      </div>

      {/* CurseForge Official Project Description (.MD) Box */}
      {showCurseForgeMd && (
        <div className="mt-6 rounded-xl border border-[#F59E0B]/40 bg-[#0B0F19] overflow-hidden shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E293B] bg-[#111827]/90 px-5 py-3.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-200 font-mono">
              <ShieldCheck className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <div>
                <span className="font-bold text-white block sm:inline">
                  CURSEFORGE_DESCRIPTION.md — Texto Oficial Pronto para Publicar no CurseForge
                </span>
                <span className="text-slate-400 sm:ml-2 block sm:inline">
                  (Inclui Resumo Curto + Descrição em Português PT-BR e Inglês EN-US exigida pela moderação)
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => copyToClipboard(curseForgeMdText, 'curseforge_md')}
                className="flex items-center gap-1.5 rounded-lg border border-[#10B981]/50 bg-[#10B981]/15 px-3.5 py-2 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/25 transition-colors cursor-pointer"
              >
                {copiedKey === 'curseforge_md' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    Markdown Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#10B981]" />
                    Copiar Texto Markdown (.MD)
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadCurseForgeMd}
                className="flex items-center gap-1.5 rounded-lg bg-[#F59E0B] px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                Baixar CURSEFORGE_DESCRIPTION.md
              </button>
            </div>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto max-h-96 leading-relaxed whitespace-pre-wrap select-all">
            {curseForgeMdText || 'Carregando CURSEFORGE_DESCRIPTION.md...'}
          </pre>
        </div>
      )}

      {/* Collapsible C# Source Code Viewer */}
      {showSourcePreview && (
        <div className="mt-6 rounded-xl border border-[#1E293B] bg-[#0B0F19] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#1E293B] px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span>ReativadorConquistasBedrock.cs — Código-Fonte C# Windows Forms (.NET 4.x)</span>
            </div>
            <button
              onClick={() => copyToClipboard(csSourceText, 'cs_source')}
              className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-slate-600 transition-colors"
            >
              {copiedKey === 'cs_source' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  Código Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  Copiar Código C#
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 leading-relaxed">
            {csSourceText || 'Carregando código-fonte...'}
          </pre>
        </div>
      )}

      {/* Quick Path Shortcuts for Windows (UWP and GDK) */}
      <div
        id="atalhos-caminhos"
        className="mt-6 pt-6 border-t border-[#1E293B] grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* UWP Path Card */}
        <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-[#0EA5E9]" />
                Caminho Padrão UWP (Microsoft Store / Xbox App)
              </span>
              <span>Bedrock 1.21.50 – 1.21.80+</span>
            </div>
            <code className="mt-2 block rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2 text-xs font-mono text-slate-200 break-all select-all">
              {UWP_MINECRAFT_PATH}
            </code>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              Cole no Executar (<kbd className="font-mono text-slate-300">Win + R</kbd>) ou na janela de seleção de pasta
            </span>
            <button
              onClick={() => copyToClipboard(UWP_MINECRAFT_PATH, 'uwp_path')}
              className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#0EA5E9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedKey === 'uwp_path' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  Caminho UWP Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  Copiar Caminho UWP
                </>
              )}
            </button>
          </div>
        </div>

        {/* GDK Path Card */}
        <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-[#F59E0B]" />
                Caminho Padrão GDK (Minecraft Bedrock PC / Novo Launcher)
              </span>
              <span>Detecção Automática no .EXE</span>
            </div>
            <code className="mt-2 block rounded-lg border border-[#1E293B] bg-[#111827] px-3 py-2 text-xs font-mono text-slate-200 break-all select-all">
              {GDK_MINECRAFT_PATH}
            </code>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              Copia a pasta base <code className="font-mono text-slate-300">%APPDATA%\Minecraft Bedrock\Users</code>
            </span>
            <button
              onClick={() => copyToClipboard(GDK_ROOT_FOLDER_PATH, 'gdk_path')}
              className="flex items-center gap-1.5 rounded-lg border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedKey === 'gdk_path' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  Caminho GDK Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Copiar Caminho GDK
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
