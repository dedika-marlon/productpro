import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * ProductPro — Generate photo-style variants & poster mockups from a product image + prompts.
 * - Mobile-first UI, black/white glassmorphism, Notion/Framer vibes
 * - Features (client-only demo):
 *   • Upload product image (PNG/JPG)
 *   • Mode: Photo or Poster
 *   • Style presets + custom prompt
 *   • 4 variations (filters/overlays as placeholders for real model outputs)
 *   • Caption & Ad Copy generator (template-based)
 *   • Aspect Ratio & Quality options
 *   • Watermark toggle
 *   • Export: ZIP (JSZip via dynamic import; fallback to individual PNGs)
 *   • Upscale 2x (canvas)
 *   • Google Auth placeholder + client-side rate-limit (30 ops/day)
 * - Production note: replace `generateVariants()` with AI inference calls (e.g., your AI Studio / model API).
 */

// ---------- Utility: minimal Tailwind-y helpers ----------
const glass = "backdrop-blur-md bg-white/5 border border-white/10 shadow-xl";
const btn =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition active:scale-[.98]";
const btnPrimary = `${btn} bg-white text-black hover:bg-zinc-200`;
const btnGhost = `${btn} bg-white/10 text-white hover:bg-white/20`;

// ---------- Types ----------
interface GenOptions {
  mode: "photo" | "poster";
  style: string;
  customPrompt: string;
  ratio: "1:1" | "4:5" | "16:9" | "9:16";
  quality: "standard" | "high" | "ultra";
  watermark: boolean;
}

// ---------- Main Component ----------
export default function ProductPro() {
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<GenOptions>({
    mode: "photo",
    style: "Studio softbox, glossy table, minimal shadows",
    customPrompt: "",
    ratio: "1:1",
    quality: "standard",
    watermark: true,
  });
  const [variants, setVariants] = useState<string[]>([]);
  const [copies, setCopies] = useState<{ caption: string; ad: string }[]>([]);
  const [opsUsed, setOpsUsed] = useState<number>(() => getOpsUsed());
  const fileRef = useRef<HTMLInputElement>(null);

  // ---------- Rate limit (client demo) ----------
  function getOpsUsed() {
    const key = keyForToday();
    return Number(localStorage.getItem(key) || "0");
  }
  function incOpsUsed(n = 1) {
    const key = keyForToday();
    const v = getOpsUsed() + n;
    localStorage.setItem(key, String(v));
    setOpsUsed(v);
  }
  function keyForToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `pp_ops_${y}-${m}-${day}`;
  }

  const remaining = 30 - opsUsed;
  const authUser = useMemo(() => ({
    // Placeholder for Google Auth subject
    name: "Guest",
    email: "guest@example.com",
    picture: "",
  }), []);

  // ---------- Handlers ----------
  const onUpload = async (file: File) => {
    setError(null);
    if (!file || !file.type.startsWith("image/")) {
      setError("Unggah file gambar (PNG/JPG)");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setImg(dataUrl);
  };

  const runGenerate = async () => {
    try {
      setBusy(true);
      setError(null);
      if (!img) throw new Error("Harap unggah foto produk dulu.");
      if (remaining <= 0) throw new Error("Batas 30 operasi/hari tercapai.");

      // DEMO: Synthesize 4 variants with CSS/canvas transforms
      const out = await generateVariants(img, options);
      setVariants(out);

      // DEMO: Caption & ad copy from template
      const c = buildCopies(options);
      setCopies(c);

      incOpsUsed(1);
    } catch (e: any) {
      setError(e.message || "Gagal generate.");
    } finally {
      setBusy(false);
    }
  };

  const doUpscale = async () => {
    try {
      setBusy(true);
      const up = await Promise.all(
        variants.map((v) => upscale2x(v))
      );
      setVariants(up);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportAll = async () => {
    try {
      setBusy(true);
      // Try ZIP with JSZip; fallback to individual downloads
      try {
        const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
        const zip = new JSZip();
        variants.forEach((v, i) => {
          const b64 = v.split(",")[1];
          zip.file(`productpro_${i + 1}.png`, b64, { base64: true });
        });
        const blob = await zip.generateAsync({ type: "blob" });
        triggerDownload(blob, `ProductPro_${Date.now()}.zip`);
      } catch (zipErr) {
        console.warn("ZIP failed, fallback to individual downloads", zipErr);
        variants.forEach((v, i) => triggerDownload(dataURLtoBlob(v), `productpro_${i + 1}.png`));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setVariants([]);
    setCopies([]);
  };

  return (
    <div className="min-h-dvh w-full bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-white text-black grid place-content-center font-bold">P</div>
            <div>
              <div className="text-lg font-semibold">ProductPro</div>
              <div className="text-xs text-white/60">Generate product photos & posters</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/70">
            <span className="hidden sm:inline">{authUser.email}</span>
            <span className="rounded-full px-2 py-1 bg-white/10">Sisa: {Math.max(0, remaining)} ops</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-5xl px-4 py-6 grid md:grid-cols-3 gap-4">
        {/* Left: Controls */}
        <section className={`${glass} rounded-2xl p-4 md:col-span-1`}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60 mb-3">Controls</h2>
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-xs text-white/70">Upload Foto Produk</label>
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                <button className={btnPrimary} onClick={() => fileRef.current?.click()}>Pilih Gambar</button>
                {img && (
                  <button className={btnGhost} onClick={() => setImg(null)}>Hapus</button>
                )}
              </div>
              <p className="text-[11px] text-white/50">Format: PNG/JPG. Gunakan latar bersih untuk hasil terbaik.</p>
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-white/70">Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(["photo", "poster"] as const).map((m) => (
                  <button key={m} className={`${options.mode === m ? btnPrimary : btnGhost}`} onClick={() => setOptions({ ...options, mode: m })}>
                    {m === "photo" ? "Photo" : "Poster"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-white/70">Style Preset</label>
              <select
                value={options.style}
                onChange={(e) => setOptions({ ...options, style: e.target.value })}
                className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none"
              >
                <option>Studio softbox, glossy table, minimal shadows</option>
                <option>Natural window light, soft matte, lifestyle</option>
                <option>Dark moody, rim light, reflective surface</option>
                <option>Color pop, gradient backdrop, high contrast</option>
                <option>Minimal Swiss poster, bold grid, large type</option>
                <option>Elegant serif poster, beige/cream palette</option>
              </select>
              <textarea
                placeholder="Custom prompt tambahan (opsional)"
                value={options.customPrompt}
                onChange={(e) => setOptions({ ...options, customPrompt: e.target.value })}
                className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none min-h-[72px]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <label className="text-xs text-white/70">Aspect</label>
                <select value={options.ratio} onChange={(e) => setOptions({ ...options, ratio: e.target.value as any })} className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
                  <option>1:1</option>
                  <option>4:5</option>
                  <option>16:9</option>
                  <option>9:16</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-white/70">Quality</label>
                <select value={options.quality} onChange={(e) => setOptions({ ...options, quality: e.target.value as any })} className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2 text-sm">
                  <option>standard</option>
                  <option>high</option>
                  <option>ultra</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.watermark} onChange={(e) => setOptions({ ...options, watermark: e.target.checked })} />
                  Watermark
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button disabled={busy} className={btnPrimary} onClick={runGenerate}>{busy ? "Generating…" : "Generate"}</button>
              <button disabled={!variants.length || busy} className={btnGhost} onClick={doUpscale}>Upscale 2x</button>
              <button disabled={!variants.length || busy} className={btnGhost} onClick={exportAll}>Export ZIP</button>
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}
          </div>
        </section>

        {/* Right: Preview */}
        <section className="md:col-span-2 grid gap-4">
          {/* Input preview */}
          <div className={`${glass} rounded-2xl p-4`}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60 mb-3">Input Preview</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="aspect-square rounded-2xl bg-white/5 border border-white/10 overflow-hidden grid place-content-center">
                {img ? (
                  <img src={img} alt="input" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-white/40 text-sm">Belum ada gambar.</div>
                )}
              </div>
              <div className="text-sm text-white/80">
                <p><span className="text-white/60">Mode:</span> {options.mode}</p>
                <p><span className="text-white/60">Style:</span> {options.style}</p>
                {options.customPrompt && <p className="line-clamp-3"><span className="text-white/60">Custom:</span> {options.customPrompt}</p>}
                <p><span className="text-white/60">Aspect:</span> {options.ratio} · <span className="text-white/60">Quality:</span> {options.quality}</p>
                <p><span className="text-white/60">Watermark:</span> {options.watermark ? "On" : "Off"}</p>
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60">Variations (4)</h2>
              <div className="text-xs text-white/50">Klik gambar untuk download</div>
            </div>
            {variants.length === 0 ? (
              <div className="text-white/40 text-sm">Belum ada output. Klik Generate.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {variants.map((v, i) => (
                  <motion.a
                    key={i}
                    href={v}
                    download={`productpro_${i + 1}.png`}
                    whileHover={{ scale: 1.02 }}
                    className="relative block rounded-xl overflow-hidden border border-white/10"
                  >
                    <img src={v} className="w-full h-full object-cover" />
                    {options.watermark && (
                      <div className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/50">ProductPro</div>
                    )}
                  </motion.a>
                ))}
              </div>
            )}
          </div>

          {/* Captions & Ads */}
          <div className={`${glass} rounded-2xl p-4`}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60 mb-3">Caption & Ad Copy</h2>
            {copies.length === 0 ? (
              <div className="text-white/40 text-sm">Belum ada teks. Generate terlebih dahulu.</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {copies.map((c, i) => (
                  <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-xs text-white/60 mb-1">Var {i + 1}</div>
                    <p className="font-medium mb-2">{c.caption}</p>
                    <p className="text-white/70">{c.ad}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 justify-end">
            <button className={btnGhost} onClick={clearAll}>Reset</button>
          </div>
        </section>
      </main>

      {/* Tiny footer */}
      <footer className="mx-auto max-w-5xl px-4 py-6 text-xs text-white/40">
        <p>
          Demo lokal tanpa server. Untuk produksi: tambahkan Google OAuth, server rate-limit, dan integrasi model gambar (AI Studio / pilihan Anda).
        </p>
      </footer>
    </div>
  );
}

// ---------- Demo Generators ----------
async function generateVariants(src: string, opts: GenOptions): Promise<string[]> {
  // Create 4 variations using canvas filters/overlays as placeholders
  const ratios: Record<GenOptions["ratio"], [number, number]> = {
    "1:1": [1024, 1024],
    "4:5": [1024, 1280],
    "16:9": [1280, 720],
    "9:16": [1080, 1920],
  };
  const [w, h] = ratios[opts.ratio];
  const qualityScale = opts.quality === "ultra" ? 1.6 : opts.quality === "high" ? 1.3 : 1;

  const base = await loadImage(src);
  const presets = buildPresetFilters(opts);

  const out: string[] = [];
  for (let i = 0; i < 4; i++) {
    const cw = Math.round(w * qualityScale);
    const ch = Math.round(h * qualityScale);
    const c = document.createElement("canvas");
    c.width = cw; c.height = ch;
    const ctx = c.getContext("2d")!;

    // Background
    ctx.fillStyle = opts.mode === "poster" ? "#0a0a0a" : "#111";
    ctx.fillRect(0, 0, cw, ch);

    // Place product image
    const pad = Math.round(Math.min(cw, ch) * 0.08);
    const iw = cw - pad * 2;
    const ih = ch - pad * 2;
    // fit contain
    const fit = contain(base.width, base.height, iw, ih);
    const ix = (cw - fit.w) / 2;
    const iy = (ch - fit.h) / 2;

    // Apply filter preset
    ctx.save();
    ctx.filter = presets[i % presets.length].filter;
    ctx.globalAlpha = 1;
    ctx.drawImage(base, ix, iy, fit.w, fit.h);
    ctx.restore();

    // Poster mode: add typographic blocks
    if (opts.mode === "poster") {
      const p = presets[i % presets.length];
      // grid accent
      ctx.fillStyle = hexWithAlpha("#ffffff", 0.06);
      for (let gx = pad; gx < cw - pad; gx += Math.round((cw - pad * 2) / 6)) {
        ctx.fillRect(gx, pad, 1, ch - pad * 2);
      }
      // title block
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.round(cw * 0.06)}px sans-serif`;
      ctx.fillText("PRODUCTPRO", pad, ch - pad * 1.2);
      ctx.globalAlpha = 0.8;
      ctx.font = `${Math.round(cw * 0.03)}px sans-serif`;
      ctx.fillText(truncate(opts.style, 42), pad, ch - pad * 0.6);
      ctx.globalAlpha = 1;

      // accent bar
      ctx.fillStyle = hexWithAlpha("#ffffff", 0.12);
      ctx.fillRect(pad, pad, Math.round(cw * 0.28), Math.round(ch * 0.02));
    }

    // Watermark
    if (opts.watermark) {
      ctx.fillStyle = hexWithAlpha("#ffffff", 0.7);
      ctx.font = `${Math.round(cw * 0.018)}px sans-serif`;
      const text = "ProductPro";
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, cw - tw - pad, ch - pad);
    }

    out.push(c.toDataURL("image/png"));
  }
  return out;
}

function buildPresetFilters(opts: GenOptions) {
  const base = "contrast(1.05) saturate(1.05)";
  const list = [
    { name: "clean", filter: `${base} brightness(1.03)` },
    { name: "moody", filter: `${base} brightness(0.92) contrast(1.15)` },
    { name: "pop", filter: `${base} brightness(1.1) saturate(1.25)` },
    { name: "matte", filter: `${base} brightness(1.0) contrast(0.95)` },
  ];
  if (opts.mode === "poster") list.reverse();
  return list;
}

function buildCopies(opts: GenOptions) {
  const base = [
    {
      caption: `Upgrade tampilan produkmu. ${opts.mode === "photo" ? "Foto studio bersih" : "Poster modern"} dengan gaya: ${opts.style}. #ProductPro`,
      ad: `Kenalkan produk Anda dengan visual ${opts.mode}. Gaya: ${opts.style}. Coba gratis hari ini.`,
    },
    {
      caption: `Visual yang bikin berhenti scroll. ${opts.mode === "photo" ? "Foto" : "Poster"} bergaya ${opts.style}.`,
      ad: `Tingkatkan CTR dengan aset ${opts.mode} berkualitas ${opts.quality}. Mulai sekarang!`,
    },
    {
      caption: `Dari foto biasa jadi materi siap upload. Aspect ${opts.ratio}.`,
      ad: `Generate 4 variasi otomatis + watermark opsional. Cocok untuk UMKM.`,
    },
    {
      caption: `Tampil konsisten di feed. ${opts.mode === "photo" ? "Lighting terkontrol" : "Grid tipografi rapi"}.`,
      ad: `Sesuaikan style & export ZIP. Scale kontenmu tanpa ribet.`,
    },
  ];
  return base;
}

// ---------- Helpers ----------
function contain(iw: number, ih: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / iw, maxH / ih);
  return { w: Math.round(iw * r), h: Math.round(ih * r) };
}
function hexWithAlpha(hex: string, a: number) {
  const x = hex.replace("#", "");
  const r = parseInt(x.substring(0, 2), 16);
  const g = parseInt(x.substring(2, 4), 16);
  const b = parseInt(x.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("Gagal membaca file."));
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(file);
  });
}
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Gagal memuat gambar."));
    img.src = src;
  });
}
async function upscale2x(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.width * 2; c.height = img.height * 2;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}
function triggerDownload(data: Blob | string, filename: string) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof data !== "string") URL.revokeObjectURL(url);
}

