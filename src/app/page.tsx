"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const ParticleCanvas = () => {
  useEffect(() => {
    const canvas = document.getElementById("particle-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number, y: number, r: number, dx: number, dy: number, alpha: number }[] = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1.5,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5,
        alpha: Math.random() * 0.2 + 0.1
      });
    }

    let animationFrameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(204, 255, 0, ${p.alpha})`;
        ctx.fill();
      });
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas id="particle-canvas" className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-70"></canvas>;
};

// API Documentation details matching backend api-router.js
const apiDocs = {
  domains: {
    title: "List Active Domains",
    desc: "Fetch a list of all active domains available for generating temporary email addresses.",
    endpoint: "GET /api/domains",
    curl: "curl -X GET http://your-vps-ip:8081/api/domains",
    js: `fetch("http://your-vps-ip:8081/api/domains")\n  .then(res => res.json())\n  .then(data => console.log(data.domains));`,
    response: `{\n  "domains": [\n    "tempemail.vps"\n  ]\n}`
  },
  generate: {
    title: "Generate Mailbox",
    desc: "Dynamically allocates a random transient email address. Optionally specify a ?domain= parameter.",
    endpoint: "GET /api/mailbox/generate",
    curl: "curl -X GET http://your-vps-ip:8081/api/mailbox/generate \\\n  -H \"Authorization: Bearer demo\"",
    js: `fetch("http://your-vps-ip:8081/api/mailbox/generate", {\n  headers: { "Authorization": "Bearer demo" }\n})\n  .then(res => res.json())\n  .then(data => console.log(data.email));`,
    response: `{\n  "email": "x9f3q2y8@tempemail.vps"\n}`
  }
};

export default function Home() {
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeApiTab, setActiveApiTab] = useState<"domains" | "generate">("domains");
  const [apiLang, setApiLang] = useState<"curl" | "javascript">("curl");
  const [baseUrl, setBaseUrl] = useState("http://localhost:8081");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [simulationStep, setSimulationStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedReq, setCopiedReq] = useState(false);
  const [copiedRes, setCopiedRes] = useState(false);

  const handleCopyCode = (text: string, isReq: boolean) => {
    navigator.clipboard.writeText(text);
    if (isReq) {
      setCopiedReq(true);
      setTimeout(() => setCopiedReq(false), 2000);
    } else {
      setCopiedRes(true);
      setTimeout(() => setCopiedRes(false), 2000);
    }
  };

  const [liveResponse, setLiveResponse] = useState<string | null>(null);

  const runApi = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulationLogs([]);
    setSimulationStep(1);
    setLiveResponse(null);

    let logs: string[] = [];
    const isGenerate = activeApiTab === "generate";
    
    logs.push(isGenerate 
      ? `$ curl -X GET ${baseUrl}/api/mailbox/generate -H "Authorization: Bearer demo"`
      : `$ curl -X GET ${baseUrl}/api/domains`);
    logs.push(`Connecting to Live API Node at ${baseUrl.replace(/^https?:\/\//, '')}...`);
    
    if (isGenerate) {
      logs.push(`Requesting new dynamic transient address...`);
    } else {
      logs.push(`Querying active domain list...`);
    }
    
    setSimulationLogs([...logs]);

    try {
      let res;
      if (isGenerate) {
        res = await fetch(`${baseUrl}/api/mailbox/generate`, {
          headers: { "Authorization": "Bearer demo" }
        });
      } else {
        res = await fetch(`${baseUrl}/api/domains`);
      }
      
      const data = await res.json();
      setTimeout(() => {
        setLiveResponse(JSON.stringify(data, null, 2));
        logs.push(`HTTP/1.1 ${res.status} OK\nContent-Type: application/json\nAccess-Control-Allow-Origin: *`);
        setSimulationLogs([...logs]);
        setIsSimulating(false);
      }, 600);

    } catch (err: any) {
      setTimeout(() => {
        logs.push(`Error: Failed to fetch from API. Is the server running? ${err.message}`);
        setSimulationLogs([...logs]);
        setIsSimulating(false);
      }, 600);
    }
  };

  const projectName = process.env.NEXT_PUBLIC_PROJECT_NAME || "TempMail VPS";
  const contactUsEmail = process.env.NEXT_PUBLIC_CONTACT_US_EMAIL || "admin@tempemail.vps";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "admin@tempemail.vps";

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactUsEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="bg-transparent text-gray-100 min-h-screen relative overflow-x-hidden font-sans">
      <ParticleCanvas />
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0"></div>

      {/* Decorative Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-radial from-emerald-500/10 to-transparent pointer-events-none z-0 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute top-[25%] right-[-10%] w-[45vw] h-[45vw] bg-radial from-violet-500/8 to-transparent pointer-events-none z-0 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[15%] left-[10%] w-[40vw] h-[40vw] bg-radial from-teal-500/6 to-transparent pointer-events-none z-0 rounded-full blur-[100px] animate-pulse"></div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-[#030712]/80 backdrop-blur-xl border-b border-white/[0.06] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5 text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
              {projectName}
            </span>
          </div>

          {/* Nav Links - Desktop */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <button onClick={() => scrollToSection("features")} className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Features</button>
            <Link href="/doc" className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Developer APIs</Link>
            <button onClick={() => scrollToSection("consoles")} className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Consoles</button>
            <button onClick={() => scrollToSection("contact-section")} className="hover:text-white transition-colors cursor-pointer bg-transparent border-none">Contact Us</button>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/admin/" className="text-xs sm:text-sm font-semibold text-gray-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] px-4 py-2 rounded-xl transition-all">Login</Link>
            <button onClick={() => setIsModalOpen(true)} className="text-xs sm:text-sm font-bold text-black bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 px-4 py-2 rounded-xl transition-all cursor-pointer shimmer-btn">Sign Up</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Hero Content Left */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-3.5 py-1 text-xs font-semibold text-emerald-400 tracking-wide font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              100% Private REST API Mail Server
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-[52px] font-extrabold tracking-tight text-white leading-tight">
              API-First VPS <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                Temporary Email
              </span>
            </h1>

            <p className="text-base sm:text-lg text-gray-400 leading-relaxed max-w-xl font-sans">
              Deploy a robust temporary email testing node on your own VPS. Built specifically to generate random mailboxes, receive testing emails, parse attachments, and extract verification OTP codes programmatically via standard REST endpoints.
            </p>

            <div className="flex flex-wrap gap-4 pt-3">
              <Link href="/live/" className="relative inline-flex items-center justify-center p-[2px] rounded-xl shadow-[0_0_15px_rgba(204,255,0,0.2)] group hover:shadow-[0_0_30px_rgba(204,255,0,0.4)] transition-all">
                <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl"></span>
                <span className="relative flex items-center justify-center w-full h-full bg-[#0b0f19] group-hover:bg-gradient-to-r group-hover:from-emerald-500 group-hover:to-teal-500 text-emerald-400 group-hover:text-black font-bold text-sm px-6 py-3.5 rounded-[10px] transition-all duration-300 shimmer-btn overflow-hidden">
                  mailer
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Link>
              <Link href="/doc" className="inline-flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.18] text-gray-300 hover:text-white font-semibold text-sm px-6 py-3.5 rounded-xl transition-all cursor-pointer">
                View API Docs
              </Link>
            </div>

            {/* Quick Badges */}
            <div className="pt-6 border-t border-white/[0.05] grid grid-cols-3 gap-4 font-mono">
              <div>
                <p className="text-xl font-bold text-white">REST API</p>
                <p className="text-[10px] text-gray-500">JSON Ingestion</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white">OTP Parser</p>
                <p className="text-[10px] text-gray-500">Auto regex extraction</p>
              </div>
              <div>
                <p className="text-xl font-bold text-white">Attachments</p>
                <p className="text-[10px] text-gray-500">Direct server downloads</p>
              </div>
            </div>
          </div>

          {/* Hero API Explorer Right */}
          <div className="lg:col-span-7 animate-float">
            <div className="bg-[#0b0f19]/70 backdrop-blur-xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl shadow-black/80 relative flex flex-col min-h-[480px]">

              {/* API Header Controls */}
              <div className="bg-[#050a14]/80 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setActiveApiTab("domains"); setSimulationStep(0); setLiveResponse(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${activeApiTab === "domains" && simulationStep === 0
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/5"
                      : "text-gray-400 hover:text-white bg-transparent border border-transparent"
                      }`}
                  >GET /domains</button>
                  <button
                    onClick={() => { setActiveApiTab("generate"); setSimulationStep(0); setLiveResponse(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${activeApiTab === "generate" && simulationStep === 0
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md shadow-emerald-500/5"
                      : "text-gray-400 hover:text-white bg-transparent border border-transparent"
                      }`}
                  >GET /generate</button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1 bg-[#030712] p-1 border border-white/[0.06] rounded-lg">
                    <button
                      onClick={() => { setApiLang("curl"); setSimulationStep(0); }}
                      className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded cursor-pointer ${apiLang === "curl" ? "bg-white/[0.06] text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >cURL</button>
                    <button
                      onClick={() => { setApiLang("javascript"); setSimulationStep(0); }}
                      className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded cursor-pointer ${apiLang === "javascript" ? "bg-white/[0.06] text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >Fetch JS</button>
                  </div>
                  <button
                    onClick={runApi}
                    disabled={isSimulating}
                    className={`px-3 py-1 text-[10px] font-mono font-bold rounded-lg cursor-pointer transition-all border ${isSimulating
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-500 hover:border-emerald-400 font-extrabold shadow-lg shadow-emerald-500/10"
                      }`}
                  >{isSimulating ? "Running..." : "Run API ⚡"}</button>
                </div>
              </div>

              {/* Endpoint Details */}
              <div className="p-5 border-b border-white/[0.04] bg-slate-950/20">
                <div className="flex items-center gap-3.5 mb-2 font-mono">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-md">HTTP REQUEST</span>
                  <span className="text-xs font-bold text-white tracking-wide">{apiDocs[activeApiTab].endpoint}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed font-sans">{apiDocs[activeApiTab].desc}</p>
              </div>

              {/* API Snippets Console */}
              {simulationStep > 0 ? (
                <div className="flex-grow flex flex-col bg-slate-950 p-6 font-mono text-xs text-emerald-400 space-y-4 overflow-y-auto min-h-[300px] border-t border-white/[0.04]">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold select-none">
                    <span>VPS Simulation Terminal</span>
                    <button onClick={() => setSimulationStep(0)} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-none font-bold">
                      Reset & Close [X]
                    </button>
                  </div>
                  <div className="space-y-3 flex-grow">
                    {simulationLogs.map((log, index) => {
                      const isCommand = log.startsWith("$");
                      const isHeader = log.includes("HTTP/1.1") || log.includes("Content-Type");
                      return (
                        <div key={index} className="leading-relaxed">
                          {isCommand ? (
                            <div className="text-white font-semibold">
                              <span className="text-emerald-500 select-none mr-2">$</span>{log.substring(2)}
                            </div>
                          ) : isHeader ? (
                            <pre className="text-cyan-400/90 whitespace-pre-wrap">{log.replace(/\\n/g, '\n')}</pre>
                          ) : (
                            <div className="text-gray-400 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 animate-ping"></span>{log}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {liveResponse && (
                      <pre className="text-teal-300 bg-[#030712]/60 p-3 rounded-lg border border-white/[0.04] whitespace-pre overflow-x-auto max-w-full">
                        {liveResponse}
                      </pre>
                    )}
                    {isSimulating && (
                      <div className="flex items-center gap-1">
                        <span className="text-emerald-500 select-none mr-2">&gt;</span>
                        <span className="animate-pulse bg-emerald-400 w-2 h-4 inline-block"></span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col bg-slate-950/40 font-mono text-xs leading-relaxed">
                  <div className="p-5 border-b border-white/[0.04] relative group">
                    <div className="flex justify-between items-center mb-2 select-none">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                        Request Snippet ({apiLang === "curl" ? "curl command" : "JavaScript fetch"})
                      </div>
                      <button
                        onClick={() => handleCopyCode(apiLang === "curl" ? apiDocs[activeApiTab].curl : apiDocs[activeApiTab].js, true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1.5 cursor-pointer border border-white/[0.06]"
                      >
                        {copiedReq ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3 text-emerald-400"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Copied!</>
                        ) : (
                          <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" /></svg>Copy</>
                        )}
                      </button>
                    </div>
                    <pre className="text-sm font-mono text-gray-300 leading-relaxed font-bold">
                      {apiLang === "curl" ? apiDocs[activeApiTab].curl.replace("http://your-vps-ip:8081", baseUrl) : apiDocs[activeApiTab].js.replace(/http:\/\/your-vps-ip:8081/g, baseUrl)}
                    </pre>
                  </div>

                  <div className="p-5 flex-grow relative group">
                    <div className="flex justify-between items-center mb-2 select-none">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">Expected Response (JSON Object)</div>
                      <button
                        onClick={() => handleCopyCode(apiDocs[activeApiTab].response, false)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 hover:text-white px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1.5 cursor-pointer border border-white/[0.06]"
                      >
                        {copiedRes ? (
                          <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3 text-emerald-400"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Copied!</>
                        ) : (
                          <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" /></svg>Copy</>
                        )}
                      </button>
                    </div>
                    <pre className="text-gray-300 whitespace-pre-wrap break-all p-3 rounded-xl bg-[#030712]/50 border border-white/[0.04] max-h-[170px] overflow-y-auto font-medium leading-relaxed">
                      {apiDocs[activeApiTab].response}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/[0.05]">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Robust Architecture</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Designed for Programmatic Mail Testing</p>
          <p className="text-sm sm:text-base text-gray-400">A self-hosted API node is perfect for automating registration, password recovery, and email verification testing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { color: "emerald", icon: "M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5", title: "Programmatic REST API", desc: "Connect and control your mailboxes completely via HTTP APIs. Instantly query incoming mail objects, sender metadata, and raw headers in standard JSON." },
            { color: "teal", icon: "M7.864 4.243A4 4 0 0111 2c.699 0 1.398.182 2.013.543l7.137 4.195a4 4 0 012 3.464v8.196a4 4 0 01-2 3.464l-7.137 4.195a4 4 0 01-4.026 0l-7.137-4.195a4 4 0 01-2-3.464V10.2c0-1.398.718-2.697 1.905-3.44l7.136-4.517z", title: "Automated OTP Parsing", desc: "The parser automatically scans inbound mail subjects and body texts for 4-6 digit numeric authentication codes. Retrieve clean verification codes instantly." },
            { color: "violet", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636", title: "Zero-Log VPS Privacy", desc: "Host the server on your own node. Email records, raw bodies, and attachments remain entirely under your local file paths. No external tracking logs." },
            { color: "indigo", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", title: "MIME Attachments", desc: "Integrated SMTP parser automatically isolates files from base64 streams and saves them to local storage. Retrieve raw media resources directly over API." },
            { color: "emerald", icon: "M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.656 48.656 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l-3 3m3-3l3-3", title: "Transient Routing", desc: "Generate random mailbox prefixes on demand. The server captures and routes emails to dynamic addresses instantly without prior inbox setup." },
            { color: "teal", icon: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z", title: "DKIM Compliance", desc: "Integrated support for generating cryptographically signed DKIM signatures. Easily test bidirectional mailing integrations with full SPF verification." },
          ].map((card, i) => (
            <div key={i} className={`glass-panel hover-3d border border-white/[0.05] hover:border-${card.color}-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] p-6 rounded-2xl transition-all duration-300 flex flex-col group`}>
              <div className={`w-11 h-11 bg-${card.color}-500/5 border border-${card.color}-500/10 group-hover:border-${card.color}-500/30 rounded-xl flex items-center justify-center mb-5 text-${card.color}-400 transition-all`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
              </div>
              <h3 className={`text-lg font-bold text-white mb-2 group-hover:text-${card.color}-400 transition-colors`}>{card.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Programmatic REST API Section */}
      <section id="api-explorer" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/[0.05]">
        <div className="glass-panel hover-3d rounded-3xl p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/[0.01] rounded-full blur-3xl pointer-events-none"></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5 space-y-5 text-left">
              <span className="text-xs font-bold font-mono text-violet-400 uppercase tracking-widest bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/25">Developer API</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">Integrate with Testing Scripts in Minutes</h3>
              <p className="text-sm text-gray-400 leading-relaxed font-sans">The VPS email server hosts a lightweight HTTP listener. Write scripts to generate transient mail addresses, submit them in sign-up pages, query the inbox for verification codes, and fetch attachments programmatically.</p>
              <div className="pt-2 space-y-3 font-sans text-xs text-gray-400">
                {["Regex-extracted OTP values in standard fields", "Supports automated attachments retrieval and download", "No account signup or token config required for local testing"].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-emerald-400 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="bg-[#030712]/80 border border-white/[0.06] rounded-2xl p-5 space-y-4 font-mono text-xs text-gray-300">
                <div className="flex justify-between items-center pb-3 border-b border-white/[0.04] text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  <span>Available REST API Endpoints</span><span>Payload Type</span>
                </div>
                {[
                  { method: "GET", endpoint: "/api/domains", type: "JSON Array [Domains]", color: "emerald" },
                  { method: "GET", endpoint: "/api/mailbox/generate?domain=...", type: "JSON Object", color: "emerald" },
                  { method: "GET", endpoint: "/api/mailbox/custom?name=...&domain=...", type: "JSON Object", color: "emerald" },
                  { method: "GET", endpoint: "/api/mailbox/:email", type: "JSON Array [Emails]", color: "emerald" },
                  { method: "GET", endpoint: "/api/mailbox/:email/otps", type: "JSON Array [OTPs]", color: "emerald" },
                  { method: "DELETE", endpoint: "/api/mailbox/:email", type: "JSON Object", color: "rose" },
                  { method: "DELETE", endpoint: "/api/mailbox/:email/:mailId", type: "JSON Object", color: "rose" },
                  { method: "GET", endpoint: "/storage/media/:filename", type: "Binary payload stream", color: "violet" },
                ].map((ep, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] transition-all border border-white/[0.02] hover:border-white/[0.08]">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-extrabold bg-${ep.color}-500/10 border border-${ep.color}-500/20 text-${ep.color}-400 px-2 py-0.5 rounded`}>{ep.method}</span>
                      <span className="font-bold text-white">{ep.endpoint}</span>
                    </div>
                    <span className="text-gray-500">{ep.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Portals / Consoles Selector Section */}
      <section id="consoles" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/[0.05]">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-400">Console Gateways</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Choose Your Gateway Portal</p>
          <p className="text-sm sm:text-base text-gray-400">Select one of the ready consoles below to start capturing emails.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Live Console Card */}
          <div className="glass-panel hover-3d border-emerald-500/20 hover:border-emerald-500/50 p-8 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25">Public Network</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-3 group-hover:text-emerald-400 transition-colors">Live Console</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Connects to the internet-facing SMTP server. Best for capturing real emails sent from platforms like Gmail, GitHub, or AWS to your configured public domains.</p>
              <div className="grid grid-cols-2 gap-3 mt-6 mb-8 py-3 px-4 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] font-mono text-gray-500 select-none">
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span><span>Port: 25 (SMTP)</span></div>
                <div className="text-right text-emerald-400 font-bold uppercase">ACTIVE</div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span>Latency: ~5ms</span>
                </div>
                <div className="text-right text-gray-400">99.98%</div>
              </div>
            </div>
            <Link href="/live/" className="w-full text-center bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all font-sans">Launch Live Console</Link>
          </div>

          {/* Local Sandbox Card */}
          <div className="glass-panel hover-3d border-violet-500/20 hover:border-violet-500/50 p-8 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-500/10 transition-colors"></div>
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold font-mono text-violet-400 uppercase tracking-widest bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/25">Private Mailbox</span>
                <span className="text-[10px] text-gray-500 font-mono">Auth Protected</span>
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-3 group-hover:text-violet-400 transition-colors">Mail Box</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Access your dedicated project mailbox. View all incoming emails for your account with persistent, long-term storage. Manage your access credentials securely via the admin panel.</p>
              <div className="grid grid-cols-2 gap-3 mt-6 mb-8 py-3 px-4 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] font-mono text-gray-500 select-none">
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span><span>Auth: Required</span></div>
                <div className="text-right text-violet-400 font-bold uppercase">SECURE</div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  <span>Persistent Storage</span>
                </div>
                <div className="text-right text-gray-400">ACTIVE</div>
              </div>
            </div>
            <Link href="/mailbox/inbox" className="w-full text-center bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-violet-500/15 hover:shadow-violet-500/25 transition-all font-sans">Open Mail Box</Link>
          </div>

          {/* Admin Panel Card */}
          <div className="glass-panel hover-3d border-white/[0.08] hover:border-white/[0.18] p-8 rounded-3xl relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none group-hover:bg-white/10 transition-colors"></div>
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold font-mono text-gray-400 uppercase tracking-widest bg-white/[0.06] px-3 py-1 rounded-full border border-white/[0.08]">System Control</span>
                <span className="text-[10px] text-gray-500 font-mono font-medium">Auth Protected</span>
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-3 group-hover:text-white transition-colors">Admin Panel</h3>
              <p className="text-sm text-gray-400 leading-relaxed">Protected administration space. Clean up database records, inspect storage paths, configure incoming whitelist domains, and generate cryptographic DKIM keys.</p>
              <div className="grid grid-cols-2 gap-3 mt-6 mb-8 py-3 px-4 rounded-xl bg-black/40 border border-white/[0.04] text-[11px] font-mono text-gray-500 select-none">
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-white/40"></span><span>Scope: Server Control</span></div>
                <div className="text-right text-gray-400 font-semibold uppercase">SECURE</div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  <span>DKIM Keys</span>
                </div>
                <div className="text-right text-teal-400 font-bold">SIGNED</div>
              </div>
            </div>
            <Link href="/admin/" className="w-full text-center bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.08] hover:border-white/[0.2] font-bold text-sm py-3.5 rounded-xl transition-all font-sans">Access Admin Settings</Link>
          </div>
        </div>
      </section>


      {/* FAQ Section */}
      <section id="faq" className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-white/[0.05]">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Support Resources</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Frequently Asked Questions</p>
          <p className="text-sm text-gray-400">Got questions about self-hosting, configuration, or API limits? Here are common answers.</p>
        </div>

        <div className="space-y-3 max-w-3xl mx-auto">
          {[
            { q: "How does the VPS email server capture incoming mails?", a: "It runs a lightweight SMTP receiver listening on Port 25 (public mail network) and Port 1025 (local sandbox loop). Any mail dispatched to your configured MX domain routes directly into our local Node/Bun parser, which stores them into a lightweight SQLite database." },
            { q: "What are the prerequisites to host this on my VPS?", a: "You need a Linux or Windows VPS with public port 25 open, a domain name where you can configure DNS records (specifically an MX record pointing to your server's IP), and Bun or Node.js runtime installed." },
            { q: "Is my email data secure and private?", a: "Yes, entirely. Since it's self-hosted, no email logs or attachments are processed by third-party APIs. Your data remains stored locally inside your VPS sqlite files, which you control." },
            { q: "How does the OTP parser and regex engine extract verification codes?", a: "When a mail arrives, the backend engine processes the plain text and HTML payloads. It applies standard Regex patterns to locate 4-6 digit numeric codes, matching common formatting patterns from verification companies, and indexes them in a secondary collection for fast lookup." },
            { q: "Can I whitelist specific sender domains?", a: "Yes! The admin settings console allows configuration of incoming whitelist parameters to filter out spam or restrict incoming traffic to only match specific test domains." }
          ].map((faq, idx) => (
            <div key={idx} className="bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl overflow-hidden transition-all duration-300 backdrop-blur-sm">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 font-sans font-semibold text-sm sm:text-base text-white hover:text-emerald-400 transition-colors cursor-pointer bg-transparent border-none"
              >
                <span>{faq.q}</span>
                <span className={`transform transition-transform duration-300 ${openFaq === idx ? "rotate-180 text-emerald-400" : "text-gray-500"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </span>
              </button>
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${openFaq === idx ? "max-h-40 border-t border-white/[0.03]" : "max-h-0"}`}>
                <p className="px-6 py-4 text-xs sm:text-sm text-gray-400 leading-relaxed font-sans">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact-section" className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-white/[0.05]">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-400">Support & Feedback</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Contact Server Administrator</p>
          <p className="text-sm text-gray-400 max-w-xl mx-auto leading-relaxed">Need help configuring DNS MX records, managing email storage volumes, or adjusting administrative settings? Get in touch with the system owner.</p>
        </div>

        <div className="relative max-w-2xl mx-auto p-[1px] rounded-3xl bg-gradient-to-br from-violet-500/30 via-white/[0.06] to-emerald-500/30 shadow-2xl shadow-black/80">
          <div className="bg-[#0b0f19]/90 backdrop-blur-xl rounded-[23px] p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-5 w-full md:w-auto text-left">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-emerald-500 rounded-2xl blur-md opacity-40 animate-pulse"></div>
                <div className="w-14 h-14 bg-[#030712] border border-white/[0.1] rounded-2xl flex items-center justify-center text-white relative z-10 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-7 h-7 text-violet-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0b0f19] rounded-full z-20"></span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white">System Admin</h4>
                  <span className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-300 px-2 py-0.5 rounded font-mono font-medium">Owner</span>
                </div>
                <p className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Active & Available
                </p>
                <div className="pt-1.5">
                  <span className="font-mono text-sm text-white select-all hover:text-emerald-400 transition-colors break-all">{contactUsEmail}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-row md:flex-col sm:items-stretch gap-3 w-full md:w-auto min-w-[185px]">
              <button
                onClick={handleCopyEmail}
                className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/15 hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer border border-violet-500/20 font-sans"
              >
                {copied ? (
                  <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-green-300"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Copied!</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" /></svg>Copy Address</>
                )}
              </button>

              <a
                href={`mailto:${supportEmail}`}
                className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-gray-300 border border-white/[0.08] hover:text-white transition-all flex items-center justify-center gap-2 font-sans"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Send Email
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PREMIUM FOOTER ─── */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#030712] overflow-hidden pt-16 pb-8 mt-8">
        {/* Glowing top accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[30%] h-[200px] bg-emerald-500/5 blur-[80px] pointer-events-none rounded-full"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16 mb-16 relative z-10">

            {/* Brand Column */}
            <div className="col-span-1 md:col-span-4 space-y-6">
              {/* Logo + Name */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/5">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 text-emerald-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <span className="text-xl font-bold tracking-tight text-white font-sans">{projectName}</span>
              </div>

              <p className="text-sm leading-relaxed text-gray-500 font-sans max-w-xs">
                A high-performance, entirely private disposable email testing environment. Deploy your own API-first SMTP server in minutes.
              </p>

            </div>

            {/* Navigation Columns */}
            <div className="col-span-1 md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-8">
              {/* Platform */}
              <div className="space-y-5">
                <h3 className="text-[11px] font-mono font-bold text-gray-300 uppercase tracking-[0.15em]">Platform</h3>
                <ul className="space-y-3.5 text-sm font-sans">
                  <li><button onClick={() => scrollToSection("features")} className="text-gray-500 hover:text-emerald-400 transition-colors duration-200 bg-transparent border-none cursor-pointer p-0">Features</button></li>
                  <li><Link href="/doc" className="text-gray-500 hover:text-emerald-400 transition-colors duration-200 bg-transparent border-none cursor-pointer p-0">API Reference</Link></li>
                  <li><button onClick={() => scrollToSection("consoles")} className="text-gray-500 hover:text-emerald-400 transition-colors duration-200 bg-transparent border-none cursor-pointer p-0">Live Gateway</button></li>
                  <li><Link href="/admin/" className="text-gray-500 hover:text-emerald-400 transition-colors duration-200">Admin Console</Link></li>
                </ul>
              </div>

              {/* Developers */}
              <div className="space-y-5">
                <h3 className="text-[11px] font-mono font-bold text-gray-300 uppercase tracking-[0.15em]">Developers</h3>
                <ul className="space-y-3.5 text-sm font-sans">
                  <li><a href="https://github.com" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors duration-200">GitHub Repo ↗</a></li>
                  <li><Link href="/doc" className="text-gray-500 hover:text-white transition-colors duration-200 bg-transparent border-none cursor-pointer p-0">REST Endpoints</Link></li>
                  <li><button onClick={() => scrollToSection("faq")} className="text-gray-500 hover:text-white transition-colors duration-200 bg-transparent border-none cursor-pointer p-0">Architecture FAQs</button></li>
                  <li><button onClick={() => setApiLang("javascript")} className="text-gray-500 hover:text-white transition-colors duration-200 bg-transparent border-none cursor-pointer p-0">JS Examples</button></li>
                </ul>
              </div>

              {/* Support */}
              <div className="space-y-5">
                <h3 className="text-[11px] font-mono font-bold text-gray-300 uppercase tracking-[0.15em]">Support</h3>
                <ul className="space-y-3.5 text-sm font-sans">
                  <li><a href={`mailto:${contactUsEmail}`} className="text-gray-500 hover:text-white transition-colors duration-200">Contact Admin</a></li>
                  <li><button onClick={() => scrollToSection("contact-section")} className="text-gray-500 hover:text-white transition-colors duration-200 bg-transparent border-none cursor-pointer p-0">Report Abuse</button></li>
                  <li><span className="text-gray-700 cursor-not-allowed">Privacy Policy</span></li>
                  <li><span className="text-gray-700 cursor-not-allowed">Terms of Service</span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-white/[0.05] gap-4 relative z-10">
            <div className="text-xs text-gray-600 font-mono">
              &copy; {new Date().getFullYear()} {projectName}. Released under the MIT License.
            </div>

            <div className="flex gap-4">
              <a href="https://github.com" target="_blank" rel="noreferrer" className="p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] text-gray-500 hover:text-white transition-all duration-200">
                <span className="sr-only">GitHub</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Sign Up Explanation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"></div>
          <div className="bg-[#0b0f19] border border-white/[0.08] rounded-3xl p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl shadow-black animate-popIn">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer bg-transparent border-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="space-y-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>

              <div className="space-y-2 text-left">
                <h3 className="text-xl font-bold text-white">Private VPS Infrastructure</h3>
                <p className="text-sm text-gray-400 leading-relaxed font-sans">
                  This instance of TempMail is configured as a private self-hosted server. Public sign-ups are disabled to preserve server storage and domain reputation.
                </p>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4 border border-white/[0.04] text-xs leading-relaxed text-gray-400 space-y-2 text-left font-sans">
                <p><strong>How to access:</strong> Credentials are created by the administrator of this VPS during initial deployment.</p>
                <p>Check the project <code>.env</code> file or database records to verify, set, or modify administrative passwords.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Link href="/admin/" onClick={() => setIsModalOpen(false)} className="flex-1 text-center bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm py-3 rounded-xl transition-all font-sans">
                  Go to Admin Login
                </Link>
                <button onClick={() => setIsModalOpen(false)} className="flex-1 text-center bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 hover:text-white border border-white/[0.08] font-bold text-sm py-3 rounded-xl transition-all cursor-pointer font-sans">
                  Close Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
