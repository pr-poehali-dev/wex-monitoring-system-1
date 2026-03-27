import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API = {
  auth: "https://functions.poehali.dev/f7a4b2fd-8ff3-4fcf-917a-175dbfabbbbb",
  servers: "https://functions.poehali.dev/5e170551-0082-4506-a680-4e6a275b1772",
  reviews: "https://functions.poehali.dev/d3182864-acbb-4308-808d-4fe3c06b454f",
};

const MINECRAFT_VERSIONS = ["1.8", "1.12", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"];
const CATEGORIES = ["Все", "Выживание", "SkyBlock", "Мини-игры", "RPG", "Анархия", "Творческий", "Модовый"];
const NAV_ITEMS = [
  { id: "home", label: "Главная" },
  { id: "catalog", label: "Каталог" },
  { id: "top", label: "Топ серверов" },
  { id: "rating", label: "Рейтинг" },
  { id: "reviews", label: "Отзывы" },
  { id: "about", label: "О сайте" },
];

interface Server {
  id: number; name: string; ip: string; description: string; version: string;
  online: number; max_online: number; votes: number; category: string;
  vk_url: string | null; discord_url: string | null; telegram_url: string | null; website_url: string | null;
  image_url: string | null; premium: boolean; top_position: number | null; tags: string[];
  owner_username: string | null; created_at: string;
}

interface Review {
  id: number; stars: number; text: string; created_at: string; username: string; server_name: string;
}

interface User {
  id: number; username: string; email: string; avatar_url: string | null; auth_provider: string;
}

function getSession() { return localStorage.getItem("wex_session"); }
function setSession(sid: string) { localStorage.setItem("wex_session", sid); }
function clearSession() { localStorage.removeItem("wex_session"); }

function authHeaders() {
  const sid = getSession();
  return sid ? { "Content-Type": "application/json", "X-Session-Id": sid } : { "Content-Type": "application/json" };
}

// ── UI helpers ──────────────────────────────────────────────

function OnlineBar({ online, max }: { online: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (online / max) * 100) : 0;
  const color = pct > 70 ? "#22c55e" : pct > 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? "top-badge-1" : rank === 2 ? "top-badge-2" : rank === 3 ? "top-badge-3" : "bg-white/10";
  const label = rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  return <span className={`${cls} text-white font-montserrat font-black text-xs px-2.5 py-1 rounded-full`}>{label}</span>;
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => <span key={s} className={s <= stars ? "text-amber-400" : "text-white/20"}>★</span>)}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-20 text-muted-foreground">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-lg">{text}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-10 h-10 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
    </div>
  );
}

// ── ServerCard ───────────────────────────────────────────────

function ServerCard({ server, rank, onVote, currentUser }: {
  server: Server; rank: number; onVote?: (id: number) => void; currentUser: User | null;
}) {
  const [copied, setCopied] = useState(false);
  const copyIp = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(server.ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="server-card glass glass-hover rounded-2xl overflow-hidden border border-white/8 group">
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-green-900/30 to-cyan-900/30">
        {server.image_url
          ? <img src={server.image_url} alt={server.name} className="server-img w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-4xl">⛏️</div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {server.premium && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-montserrat font-bold px-2.5 py-1 rounded-full">⭐ PREMIUM</div>
        )}
        <div className="absolute top-3 left-3"><RankBadge rank={rank} /></div>
        <div className="absolute bottom-3 left-3 flex gap-1 flex-wrap">
          {(server.tags || []).slice(0, 3).map(t => (
            <span key={t} className="bg-black/50 text-white/80 text-xs px-2 py-0.5 rounded-full border border-white/10">{t}</span>
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-montserrat font-bold text-white text-base leading-tight">{server.name}</h3>
          {server.version && <span className="version-tag shrink-0">{server.version}</span>}
        </div>
        {server.description && <p className="text-muted-foreground text-xs mb-3 leading-relaxed line-clamp-2">{server.description}</p>}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 online-pulse shrink-0" />
          <span className="text-green-400 text-sm font-semibold">{(server.online || 0).toLocaleString()}</span>
          {server.max_online > 0 && <span className="text-muted-foreground text-xs">/ {server.max_online.toLocaleString()}</span>}
          <OnlineBar online={server.online || 0} max={server.max_online || 100} />
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 mb-3 cursor-pointer hover:bg-white/10 transition-colors group/ip" onClick={copyIp}>
          <Icon name="Server" size={12} className="text-muted-foreground" />
          <span className="text-xs text-white/70 font-mono flex-1 truncate">{server.ip}</span>
          <Icon name={copied ? "Check" : "Copy"} size={12} className={copied ? "text-green-400" : "text-muted-foreground"} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {server.vk_url && <a href={server.vk_url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 transition-colors">ВК</a>}
            {server.discord_url && <a href={server.discord_url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/20 flex items-center justify-center transition-colors"><Icon name="MessageCircle" size={12} className="text-indigo-400" /></a>}
            {server.telegram_url && <a href={server.telegram_url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/20 flex items-center justify-center transition-colors"><Icon name="Send" size={12} className="text-sky-400" /></a>}
            {server.website_url && <a href={server.website_url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"><Icon name="Globe" size={12} className="text-white/50" /></a>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-amber-400">
              <Icon name="TrendingUp" size={12} />
              <span className="text-xs font-semibold">{(server.votes || 0).toLocaleString()}</span>
            </div>
            {onVote && (
              <button
                onClick={() => onVote(server.id)}
                className="shimmer-btn text-white text-xs font-montserrat font-bold px-3 py-1.5 rounded-lg hover:scale-105 transition-transform"
              >
                {currentUser ? "Голос" : "Войди"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────

export default function Index() {
  const [activePage, setActivePage] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Servers
  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoading, setServersLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Все");
  const [activeVersion, setActiveVersion] = useState("Все");

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewForm, setReviewForm] = useState({ server_id: "", stars: 0, text: "" });
  const [reviewError, setReviewError] = useState("");

  // Add server
  const [showAddServer, setShowAddServer] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", ip: "", description: "", version: "1.20", category: "Выживание",
    vk_url: "", discord_url: "", telegram_url: "", website_url: "",
  });
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [voteMsg, setVoteMsg] = useState("");

  // Load current user on mount
  useEffect(() => {
    const sid = getSession();
    if (!sid) return;
    fetch(`${API.auth}/me`, { headers: { "X-Session-Id": sid } })
      .then(r => r.json())
      .then(d => { if (d.user) setCurrentUser(d.user); else clearSession(); })
      .catch(() => {});
  }, []);

  // Load servers
  const loadServers = useCallback(() => {
    setServersLoading(true);
    const params = new URLSearchParams();
    if (activeCategory !== "Все") params.set("category", activeCategory);
    if (activeVersion !== "Все") params.set("version", activeVersion);
    if (searchQuery) params.set("search", searchQuery);
    fetch(`${API.servers}/?${params}`)
      .then(r => r.json())
      .then(d => setServers(d.servers || []))
      .catch(() => setServers([]))
      .finally(() => setServersLoading(false));
  }, [activeCategory, activeVersion, searchQuery]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // Load reviews
  const loadReviews = useCallback(() => {
    setReviewsLoading(true);
    fetch(`${API.reviews}/`)
      .then(r => r.json())
      .then(d => setReviews(d.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, []);

  useEffect(() => {
    if (activePage === "reviews") loadReviews();
  }, [activePage, loadReviews]);

  // Auth handlers
  async function handleAuth() {
    setAuthError(""); setAuthLoading(true);
    try {
      const isReg = authTab === "register";
      const body = isReg
        ? { username: authForm.username, email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password };
      const res = await fetch(`${API.auth}/${isReg ? "register" : "login"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Ошибка"); return; }
      setSession(data.session_id);
      setCurrentUser(data.user);
      setShowAuthModal(false);
      setAuthForm({ username: "", email: "", password: "" });
    } catch { setAuthError("Ошибка сети"); }
    finally { setAuthLoading(false); }
  }

  async function handleLogout() {
    await fetch(`${API.auth}/logout`, { method: "POST", headers: authHeaders() });
    clearSession(); setCurrentUser(null);
  }

  // Vote
  async function handleVote(serverId: number) {
    if (!currentUser) { setShowAuthModal(true); return; }
    const res = await fetch(`${API.servers}/vote`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ server_id: serverId }),
    });
    const data = await res.json();
    if (res.ok) {
      setVoteMsg("Голос засчитан! Спасибо 🎉");
      setTimeout(() => setVoteMsg(""), 3000);
      loadServers();
    } else {
      setVoteMsg(data.error || "Ошибка");
      setTimeout(() => setVoteMsg(""), 3000);
    }
  }

  // Add server
  async function handleAddServer() {
    if (!currentUser) { setShowAuthModal(true); return; }
    setAddError(""); setAddLoading(true);
    try {
      const res = await fetch(`${API.servers}/add`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || "Ошибка"); return; }
      setShowAddServer(false);
      setAddForm({ name: "", ip: "", description: "", version: "1.20", category: "Выживание", vk_url: "", discord_url: "", telegram_url: "", website_url: "" });
      loadServers();
    } catch { setAddError("Ошибка сети"); }
    finally { setAddLoading(false); }
  }

  // Add review
  async function handleAddReview() {
    if (!currentUser) { setShowAuthModal(true); return; }
    setReviewError("");
    if (!reviewForm.server_id || !reviewForm.stars || !reviewForm.text) { setReviewError("Заполните все поля"); return; }
    const res = await fetch(`${API.reviews}/`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ server_id: parseInt(reviewForm.server_id), stars: reviewForm.stars, text: reviewForm.text }),
    });
    const data = await res.json();
    if (!res.ok) { setReviewError(data.error || "Ошибка"); return; }
    setReviewForm({ server_id: "", stars: 0, text: "" });
    loadReviews();
  }

  const filteredServers = servers;
  const totalOnline = servers.reduce((s, srv) => s + (srv.online || 0), 0);

  return (
    <div className="min-h-screen bg-background particles-bg grid-pattern font-golos">

      {/* TOAST */}
      {voteMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass border border-green-500/30 text-white px-6 py-3 rounded-2xl animate-fade-in shadow-xl">
          {voteMsg}
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />
          <div className="relative glass border border-white/10 rounded-3xl p-8 w-full max-w-md animate-scale-in shadow-2xl">
            <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors">
              <Icon name="X" size={20} />
            </button>
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">⛏️</div>
              <h2 className="font-montserrat font-black text-xl text-white mb-1">{authTab === "login" ? "Добро пожаловать!" : "Регистрация"}</h2>
              <p className="text-muted-foreground text-sm">{authTab === "login" ? "Войди в свой аккаунт" : "Создай аккаунт и добавь сервер"}</p>
            </div>
            <div className="flex rounded-xl bg-secondary p-1 mb-6">
              <button onClick={() => { setAuthTab("login"); setAuthError(""); }} className={`flex-1 py-2 text-sm font-montserrat font-semibold rounded-lg transition-all ${authTab === "login" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-white"}`}>Войти</button>
              <button onClick={() => { setAuthTab("register"); setAuthError(""); }} className={`flex-1 py-2 text-sm font-montserrat font-semibold rounded-lg transition-all ${authTab === "register" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-white"}`}>Регистрация</button>
            </div>
            <div className="space-y-3 mb-4">
              <button className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 text-white font-semibold transition-colors">
                <span>🔵</span> Войти через Google
              </button>
              <button className="w-full flex items-center justify-center gap-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl py-3 text-indigo-300 font-semibold transition-colors">
                <Icon name="MessageCircle" size={18} /> Войти через Discord
              </button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-muted-foreground text-xs">или</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="space-y-3">
              {authTab === "register" && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Никнейм</label>
                  <input value={authForm.username} onChange={e => setAuthForm(f => ({ ...f, username: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Steve_Pro2004" />
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <input type="email" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors" placeholder="steve@mail.ru" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Пароль</label>
                <input type="password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAuth()} className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors" placeholder="••••••••" />
              </div>
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
              <button onClick={handleAuth} disabled={authLoading} className="w-full shimmer-btn text-white font-montserrat font-bold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-60">
                {authLoading ? "Загрузка..." : authTab === "login" ? "Войти" : "Зарегистрироваться"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SERVER MODAL */}
      {showAddServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddServer(false)} />
          <div className="relative glass border border-white/10 rounded-3xl p-8 w-full max-w-lg animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowAddServer(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors">
              <Icon name="X" size={20} />
            </button>
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🌐</div>
              <h2 className="font-montserrat font-black text-xl text-white mb-1">Добавить сервер</h2>
              <p className="text-muted-foreground text-sm">Заполни информацию о своём сервере</p>
            </div>
            {!currentUser && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 text-amber-300 text-sm text-center">
                Для добавления сервера необходимо <button onClick={() => { setShowAddServer(false); setShowAuthModal(true); }} className="underline font-semibold">войти в аккаунт</button>
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Название *</label>
                  <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors" placeholder="MyServer" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">IP адрес *</label>
                  <input value={addForm.ip} onChange={e => setAddForm(f => ({ ...f, ip: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors font-mono" placeholder="play.myserver.ru" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none" rows={3} placeholder="Расскажи о своём сервере..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Версия</label>
                  <select value={addForm.version} onChange={e => setAddForm(f => ({ ...f, version: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors">
                    {MINECRAFT_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Категория</label>
                  <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors">
                    {CATEGORIES.filter(c => c !== "Все").map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "vk_url", label: "ВКонтакте", ph: "https://vk.com/..." },
                  { key: "discord_url", label: "Discord", ph: "https://discord.gg/..." },
                  { key: "telegram_url", label: "Telegram", ph: "https://t.me/..." },
                  { key: "website_url", label: "Сайт", ph: "https://..." },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                    <input
                      value={addForm[f.key as keyof typeof addForm]}
                      onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                      placeholder={f.ph}
                    />
                  </div>
                ))}
              </div>
              {addError && <p className="text-red-400 text-sm">{addError}</p>}
              <button onClick={handleAddServer} disabled={addLoading || !currentUser} className="w-full shimmer-btn text-white font-montserrat font-bold py-3 rounded-xl hover:scale-[1.02] active:scale-[0.98] shadow-lg transition-all disabled:opacity-60">
                {addLoading ? "Добавление..." : "Добавить сервер"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="sticky top-0 z-40 glass border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
          <button onClick={() => setActivePage("home")} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-sm font-black text-white neon-green">W</div>
            <span className="font-montserrat font-black text-lg hidden sm:block"><span className="text-neon-green">Wex</span><span className="text-white">Monitoring</span></span>
          </button>
          <div className="hidden lg:flex items-center gap-1 flex-1">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActivePage(item.id)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activePage === item.id ? "text-green-400 bg-green-500/10" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setShowAddServer(true)} className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
              <Icon name="Plus" size={14} /><span>Добавить сервер</span>
            </button>
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setActivePage("cabinet")} className="flex items-center gap-2 glass border border-white/10 px-3 py-2 rounded-xl text-sm text-white hover:border-white/20 transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-xs font-black text-white">{currentUser.username[0].toUpperCase()}</div>
                  <span className="hidden sm:block font-semibold">{currentUser.username}</span>
                </button>
                <button onClick={handleLogout} className="text-muted-foreground hover:text-white transition-colors p-2">
                  <Icon name="LogOut" size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="shimmer-btn text-white font-montserrat font-bold text-sm px-4 py-2 rounded-xl hover:scale-105 transition-transform shadow-md">
                Войти
              </button>
            )}
            <button className="lg:hidden text-white p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Icon name={mobileMenuOpen ? "X" : "Menu"} size={22} />
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/8 px-4 py-3 flex flex-col gap-1 animate-fade-in">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => { setActivePage(item.id); setMobileMenuOpen(false); }} className={`px-3 py-2 rounded-lg text-sm font-semibold text-left transition-all ${activePage === item.id ? "text-green-400 bg-green-500/10" : "text-muted-foreground hover:text-white"}`}>
                {item.label}
              </button>
            ))}
            <button onClick={() => { setShowAddServer(true); setMobileMenuOpen(false); }} className="px-3 py-2 rounded-lg text-sm font-semibold text-left text-muted-foreground hover:text-white">
              + Добавить сервер
            </button>
          </div>
        )}
      </nav>

      {/* ====== HOME ====== */}
      {activePage === "home" && (
        <div>
          <section className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 via-transparent to-transparent" />
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-green-500/8 rounded-full blur-3xl float" />
            <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-cyan-500/6 rounded-full blur-3xl float" style={{ animationDelay: "2s" }} />
            <div className="relative z-10 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 glass border border-green-500/20 rounded-full px-4 py-1.5 text-sm text-green-400 font-semibold mb-6 fade-in-up">
                <div className="w-2 h-2 rounded-full bg-green-500 online-pulse" />
                {totalOnline > 0 ? `${totalOnline.toLocaleString()} игроков онлайн прямо сейчас` : "Мониторинг активен"}
              </div>
              <h1 className="font-montserrat font-black text-5xl sm:text-6xl md:text-7xl leading-tight mb-6 fade-in-up fade-in-up-delay-1">
                Лучший мониторинг<br /><span className="gradient-text">серверов Minecraft</span>
              </h1>
              <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed fade-in-up fade-in-up-delay-2">
                Найди идеальный сервер среди сотен площадок. Выживание, PvP, RPG, SkyBlock — любой жанр для любого игрока.
              </p>
              <div className="flex flex-wrap gap-4 justify-center mb-12 fade-in-up fade-in-up-delay-3">
                <button onClick={() => setActivePage("catalog")} className="shimmer-btn text-white font-montserrat font-bold text-base px-8 py-4 rounded-2xl hover:scale-105 transition-transform shadow-xl shadow-green-500/20 neon-green">
                  Найти сервер
                </button>
                <button onClick={() => setShowAddServer(true)} className="glass border border-white/15 hover:border-white/30 text-white font-montserrat font-bold text-base px-8 py-4 rounded-2xl hover:bg-white/8 transition-all">
                  + Добавить свой сервер
                </button>
              </div>
              <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto fade-in-up fade-in-up-delay-4">
                {[
                  { val: `${servers.length}`, label: "Серверов" },
                  { val: totalOnline > 0 ? `${totalOnline.toLocaleString()}` : "0", label: "Игроков" },
                  { val: "TOP", label: "Рейтинг" },
                ].map(stat => (
                  <div key={stat.label} className="glass rounded-2xl p-4 border border-white/8">
                    <div className="font-montserrat font-black text-2xl gradient-text">{stat.val}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* TOP-3 */}
          <section className="max-w-7xl mx-auto px-4 pb-20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-montserrat font-black text-3xl text-white">🔥 Топ серверов</h2>
                <p className="text-muted-foreground text-sm mt-1">Самые популярные прямо сейчас</p>
              </div>
              <button onClick={() => setActivePage("top")} className="text-green-400 hover:text-green-300 text-sm font-semibold flex items-center gap-1 transition-colors">
                Все <Icon name="ChevronRight" size={14} />
              </button>
            </div>
            {serversLoading ? <Spinner /> : servers.length === 0 ? (
              <EmptyState icon="🏗️" text="Серверов пока нет — добавь первый!" />
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {servers.slice(0, 3).map((s, i) => <ServerCard key={s.id} server={s} rank={i + 1} onVote={handleVote} currentUser={currentUser} />)}
              </div>
            )}
          </section>

          {/* Версии */}
          <section className="max-w-7xl mx-auto px-4 pb-20">
            <h2 className="font-montserrat font-black text-2xl text-white mb-6">Поиск по версии Minecraft</h2>
            <div className="flex flex-wrap gap-3">
              {MINECRAFT_VERSIONS.map(v => (
                <button key={v} onClick={() => { setActiveVersion(v); setActivePage("catalog"); }}
                  className="glass hover:bg-cyan-500/10 hover:border-cyan-500/30 border border-white/10 rounded-xl px-5 py-3 text-white font-montserrat font-bold text-sm transition-all hover:text-cyan-400 group">
                  <span className="version-tag group-hover:border-cyan-500/50">{v}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {servers.filter(s => s.version === v).length} серв.
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ====== CATALOG ====== */}
      {activePage === "catalog" && (
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h1 className="font-montserrat font-black text-4xl text-white mb-2">Каталог серверов</h1>
          <p className="text-muted-foreground mb-8">Найди сервер по жанру, версии и названию</p>
          <div className="glass border border-white/8 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-primary transition-colors" placeholder="Поиск по названию или IP..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <select className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors" value={activeVersion} onChange={e => setActiveVersion(e.target.value)}>
              <option value="Все">Все версии</option>
              {MINECRAFT_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground shadow neon-green" : "glass border border-white/10 text-muted-foreground hover:text-white hover:border-white/20"}`}>
                {cat}
              </button>
            ))}
          </div>
          {serversLoading ? <Spinner /> : filteredServers.length === 0 ? (
            <EmptyState icon="🔍" text="Серверов не найдено. Добавь первый!" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServers.map((s, i) => <ServerCard key={s.id} server={s} rank={i + 1} onVote={handleVote} currentUser={currentUser} />)}
            </div>
          )}
        </div>
      )}

      {/* ====== TOP ====== */}
      {activePage === "top" && (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="font-montserrat font-black text-4xl text-white mb-2">Топ серверов</h1>
          <p className="text-muted-foreground mb-4">Рейтинг строится на основе голосов игроков</p>
          <div className="glass border border-amber-500/20 rounded-2xl p-5 mb-8 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div>
                <div className="font-montserrat font-black text-lg text-white mb-1">💎 Купи место в топе</div>
                <p className="text-muted-foreground text-sm">Закрепи сервер на первых позициях и получи тысячи новых игроков</p>
              </div>
              <button className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-montserrat font-bold px-6 py-3 rounded-xl hover:scale-105 transition-all shadow-lg shadow-amber-500/20">
                Узнать цены
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { pos: "1", price: "2 990 ₽/мес", desc: "Золото — максимум трафика", color: "from-amber-500 to-orange-500" },
              { pos: "2", price: "1 990 ₽/мес", desc: "Серебро — отличная видимость", color: "from-slate-400 to-slate-300" },
              { pos: "3", price: "990 ₽/мес", desc: "Бронза — старт в топе", color: "from-amber-700 to-amber-600" },
            ].map(tier => (
              <div key={tier.pos} className="glass border border-white/10 rounded-2xl p-5 text-center hover:border-white/20 transition-colors">
                <div className={`text-4xl font-montserrat font-black bg-gradient-to-br ${tier.color} bg-clip-text text-transparent mb-1`}>#{tier.pos}</div>
                <div className="font-montserrat font-bold text-white text-lg mb-1">{tier.price}</div>
                <div className="text-muted-foreground text-sm">{tier.desc}</div>
              </div>
            ))}
          </div>
          {serversLoading ? <Spinner /> : servers.length === 0 ? (
            <EmptyState icon="🏆" text="Топ пока пуст — добавь первый сервер!" />
          ) : (
            <div className="space-y-3">
              {servers.map((s, i) => (
                <div key={s.id} className="glass glass-hover border border-white/8 rounded-2xl p-4 flex items-center gap-4">
                  <div className="shrink-0"><RankBadge rank={i + 1} /></div>
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-green-900/30 to-cyan-900/30 flex items-center justify-center text-2xl">
                    {s.image_url ? <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" /> : "⛏️"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-montserrat font-bold text-white text-sm truncate">{s.name}</p>
                      {s.version && <span className="version-tag shrink-0">{s.version}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-green-400 text-xs font-semibold">{(s.online || 0).toLocaleString()} онлайн</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-amber-400 font-montserrat font-bold text-sm">{(s.votes || 0).toLocaleString()}</div>
                    <div className="text-muted-foreground text-xs">голосов</div>
                  </div>
                  {i < 3 && (
                    <button className="shrink-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 border border-amber-500/30 text-amber-400 text-xs font-montserrat font-semibold px-3 py-1.5 rounded-xl transition-colors">
                      Купить место
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== RATING ====== */}
      {activePage === "rating" && (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="font-montserrat font-black text-4xl text-white mb-2">Рейтинг серверов</h1>
          <p className="text-muted-foreground mb-8">Голосуй за любимый сервер каждые 24 часа</p>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {[
              { label: "Серверов в базе", val: servers.length.toString(), icon: "Server", color: "text-green-400" },
              { label: "Игроков онлайн", val: totalOnline.toLocaleString(), icon: "Users", color: "text-cyan-400" },
              { label: "Голосов всего", val: servers.reduce((s, srv) => s + (srv.votes || 0), 0).toLocaleString(), icon: "TrendingUp", color: "text-amber-400" },
              { label: "Версий Minecraft", val: [...new Set(servers.map(s => s.version).filter(Boolean))].length.toString(), icon: "Layers", color: "text-purple-400" },
            ].map(stat => (
              <div key={stat.label} className="glass border border-white/8 rounded-2xl p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl glass flex items-center justify-center ${stat.color}`}>
                  <Icon name={stat.icon} size={22} />
                </div>
                <div>
                  <div className="font-montserrat font-black text-2xl text-white">{stat.val}</div>
                  <div className="text-muted-foreground text-sm">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
          {serversLoading ? <Spinner /> : servers.length === 0 ? (
            <EmptyState icon="📊" text="Рейтинг пока пуст — добавь первый сервер!" />
          ) : (
            <div className="space-y-3">
              {servers.map((s, i) => (
                <div key={s.id} className="glass glass-hover border border-white/8 rounded-2xl p-4 flex items-center gap-4">
                  <span className="font-montserrat font-black text-2xl text-muted-foreground w-8 text-center">#{i+1}</span>
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-green-900/30 to-cyan-900/30 flex items-center justify-center text-xl">
                    {s.image_url ? <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" /> : "⛏️"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-montserrat font-bold text-white">{s.name}</span>
                      {s.version && <span className="version-tag">{s.version}</span>}
                    </div>
                    <div className="text-muted-foreground text-xs">{s.category}</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-amber-400 font-bold font-montserrat">{(s.votes || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">голосов</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="text-green-400 font-bold font-montserrat">{(s.online || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">онлайн</div>
                  </div>
                  <button onClick={() => handleVote(s.id)} className="shimmer-btn text-white font-montserrat font-bold text-sm px-4 py-2 rounded-xl hover:scale-105 transition-transform shadow-md">
                    Голосовать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== REVIEWS ====== */}
      {activePage === "reviews" && (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="font-montserrat font-black text-4xl text-white mb-2">Отзывы игроков</h1>
          <p className="text-muted-foreground mb-8">Читай мнения игроков и оставляй свои</p>
          <div className="glass border border-white/10 rounded-2xl p-6 mb-8">
            <h3 className="font-montserrat font-bold text-white text-lg mb-4">Оставить отзыв</h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <select value={reviewForm.server_id} onChange={e => setReviewForm(f => ({ ...f, server_id: e.target.value }))} className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors">
                <option value="">Выбери сервер...</option>
                {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div className="flex gap-1 items-center">
                <span className="text-sm text-muted-foreground mr-2">Оценка:</span>
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setReviewForm(f => ({ ...f, stars: s }))} className={`text-2xl transition-colors ${s <= reviewForm.stars ? "text-amber-400" : "text-white/20 hover:text-amber-400"}`}>★</button>
                ))}
              </div>
            </div>
            <textarea value={reviewForm.text} onChange={e => setReviewForm(f => ({ ...f, text: e.target.value }))} className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors resize-none mb-3 placeholder:text-muted-foreground" rows={3} placeholder="Расскажи об опыте игры..." />
            {reviewError && <p className="text-red-400 text-sm mb-2">{reviewError}</p>}
            <button onClick={handleAddReview} className="shimmer-btn text-white font-montserrat font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-transform">
              {currentUser ? "Опубликовать отзыв" : "Войди чтобы оставить отзыв"}
            </button>
          </div>
          {reviewsLoading ? <Spinner /> : reviews.length === 0 ? (
            <EmptyState icon="💬" text="Отзывов пока нет — оставь первый!" />
          ) : (
            <div className="space-y-4">
              {reviews.map(r => (
                <div key={r.id} className="glass glass-hover border border-white/8 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center font-montserrat font-black text-white text-sm">{r.username[0].toUpperCase()}</div>
                      <div>
                        <div className="font-semibold text-white text-sm">{r.username}</div>
                        <div className="text-muted-foreground text-xs">{r.server_name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <StarRating stars={r.stars} />
                      <div className="text-muted-foreground text-xs mt-0.5">{new Date(r.created_at).toLocaleDateString("ru-RU")}</div>
                    </div>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== CABINET ====== */}
      {activePage === "cabinet" && (
        <div className="max-w-4xl mx-auto px-4 py-10">
          {!currentUser ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🔐</div>
              <p className="text-muted-foreground text-lg mb-4">Войди в аккаунт чтобы увидеть личный кабинет</p>
              <button onClick={() => setShowAuthModal(true)} className="shimmer-btn text-white font-montserrat font-bold px-8 py-3 rounded-xl hover:scale-105 transition-transform">Войти</button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center font-montserrat font-black text-white text-2xl neon-green">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <div>
                  <h1 className="font-montserrat font-black text-3xl text-white">{currentUser.username}</h1>
                  <p className="text-muted-foreground text-sm">{currentUser.email}</p>
                </div>
              </div>
              <div className="glass border border-white/10 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-montserrat font-bold text-white text-lg">Мои серверы</h3>
                  <button onClick={() => setShowAddServer(true)} className="flex items-center gap-2 shimmer-btn text-white text-sm font-semibold px-4 py-2 rounded-xl hover:scale-105 transition-transform">
                    <Icon name="Plus" size={14} /> Добавить
                  </button>
                </div>
                {servers.filter(s => s.owner_username === currentUser.username).length === 0 ? (
                  <p className="text-muted-foreground text-sm">У тебя пока нет серверов</p>
                ) : (
                  <div className="space-y-3">
                    {servers.filter(s => s.owner_username === currentUser.username).map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-900/50 to-cyan-900/50 flex items-center justify-center text-lg">
                          {s.image_url ? <img src={s.image_url} alt="" className="w-full h-full object-cover rounded-lg" /> : "⛏️"}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white text-sm">{s.name}</div>
                          <div className="text-muted-foreground text-xs font-mono">{s.ip}</div>
                        </div>
                        <div className="text-green-400 text-xs font-semibold">{(s.online || 0)} онлайн</div>
                        <div className="text-amber-400 text-xs font-semibold">{(s.votes || 0)} голосов</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ====== ABOUT ====== */}
      {activePage === "about" && (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="font-montserrat font-black text-4xl text-white mb-2">О WexMonitoring</h1>
          <p className="text-muted-foreground mb-10">Лучший рейтинг и мониторинг серверов Minecraft в России</p>
          <div className="glass border border-white/10 rounded-3xl p-8 mb-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-4xl font-black text-white mx-auto mb-4 neon-green">W</div>
            <h2 className="font-montserrat font-black text-2xl text-white mb-4">WexMonitoring</h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Добро пожаловать на лучший рейтинг и мониторинг серверов Майнкрафт в России. У нас вы можете найти игровые сервера на любой вкус. Пользуйтесь поиском серверов с мини-играми, модами и плагинами. Следите за онлайн статистикой, читайте отзывы игроков и оставляйте свои. Если у вас есть свой сервер — добавьте его к нам!
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: "🎮", title: "Для игроков", desc: "Находи лучшие серверы, читай отзывы, голосуй и следи за статистикой онлайна" },
              { icon: "🖥️", title: "Для владельцев", desc: "Добавляй свой сервер, получай игроков, покупай топовые места для максимальной видимости" },
              { icon: "🌟", title: "Честный рейтинг", desc: "Рейтинг формируется на основе реальных голосов и онлайна без накруток" },
            ].map(card => (
              <div key={card.title} className="glass border border-white/8 rounded-2xl p-6 text-center hover:border-white/15 transition-colors">
                <div className="text-4xl mb-3">{card.icon}</div>
                <h3 className="font-montserrat font-bold text-white mb-2">{card.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
          <div className="glass border border-white/8 rounded-2xl p-6">
            <h3 className="font-montserrat font-bold text-white text-lg mb-4">Контакты команды</h3>
            <div className="flex flex-wrap gap-3">
              {[
                { icon: "MessageCircle", label: "Discord сервер", color: "text-indigo-400" },
                { icon: "Send", label: "Telegram канал", color: "text-sky-400" },
                { icon: "Mail", label: "admin@wexmonitoring.ru", color: "text-green-400" },
              ].map(c => (
                <button key={c.label} className="flex items-center gap-2 glass border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-white transition-colors">
                  <Icon name={c.icon} size={16} className={c.color} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-white/8 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center font-black text-white text-sm">W</div>
              <div>
                <div className="font-montserrat font-black text-white"><span className="text-green-400">Wex</span>Monitoring</div>
                <div className="text-muted-foreground text-xs">Лучший мониторинг серверов Minecraft</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => setActivePage(item.id)} className="hover:text-white transition-colors">{item.label}</button>
              ))}
            </div>
            <div className="text-muted-foreground text-sm">© 2026 WexMonitoring</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
