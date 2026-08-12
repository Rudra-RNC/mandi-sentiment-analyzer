import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Wheat, TrendingUp, TrendingDown, AlertTriangle, Upload, Plus, Copy, Check,
  MessageSquareText, Scale, Clock, IndianRupee, Sprout, Download, X,
} from "lucide-react";

// ---------- Sentiment lexicon (English + common Hinglish mandi-trade terms) ----------
const POS_WORDS = new Set([
  "good","great","excellent","nice","fresh","quality","best","cheap","fair","satisfied",
  "happy","prompt","timely","honest","clean","genuine","reliable","consistent","superb",
  "awesome","trustworthy","loyal","recommend","thanks","thankyou","smooth","perfect",
  "sasta","accha","achha","badhiya","khush","taaza","sundar","bharosa","imaandar",
]);
const NEG_WORDS = new Set([
  "bad","poor","rotten","spoiled","spoilt","late","delay","delayed","cheat","cheated",
  "fraud","overpriced","expensive","complaint","complain","disappointed","unhappy",
  "worst","terrible","damaged","wastage","broken","unfair","dishonest","reject",
  "rejected","refuse","refused","rude","dirty","stale","moldy","mouldy","short",
  "underweight","kharab","bekar","ganda","mehenga","dhokha","gussa","naraaz",
]);
const POS_PHRASES = ["on time","well packed","correct weight","fair price","fair rate","no complaints","good quality","full weight"];
const NEG_PHRASES = ["short weight","under weight","not fresh","low quality","price drop","too expensive","not happy","poor quality","bad quality"];

function analyzeSentiment(text) {
  const lower = (text || "").toLowerCase();
  const tokens = lower.replace(/[.,!?;:()"']/g, "").split(/\s+/).filter(Boolean);
  let score = 0;
  tokens.forEach((t) => {
    if (POS_WORDS.has(t)) score += 1;
    if (NEG_WORDS.has(t)) score -= 1;
  });
  POS_PHRASES.forEach((p) => { if (lower.includes(p)) score += 1; });
  NEG_PHRASES.forEach((p) => { if (lower.includes(p)) score -= 1; });
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

const TAGS = [
  { id: "price", label: "Price", icon: IndianRupee },
  { id: "quality", label: "Quality", icon: Sprout },
  { id: "quantity", label: "Weight/Qty", icon: Scale },
  { id: "service", label: "Service", icon: Clock },
  { id: "other", label: "Other", icon: MessageSquareText },
];

const REPLY_TEMPLATES = {
  price: [
    "Namaste {buyer}, thank you for flagging the rate. We are reviewing this week's pricing and will offer a fairer rate on your next visit.",
    "{buyer} ji, we understand the price felt high. We will check nearby mandi rates and adjust going forward.",
  ],
  quality: [
    "Sorry to hear about the quality, {buyer} ji. We will inspect the batch more carefully and replace any damaged produce next time.",
    "{buyer}, thank you for the feedback. We are sourcing fresher stock and will ensure better quality on your next order.",
  ],
  quantity: [
    "{buyer} ji, apologies for the short weight. We will double check the scale before your next pickup and make up the difference.",
    "Thank you for pointing this out, {buyer}. Our weighing process is being reviewed to avoid this happening again.",
  ],
  service: [
    "{buyer} ji, sorry for the delay. We are working on faster, more courteous service at the counter.",
    "Thank you for your patience, {buyer}. We will ensure timely payment and better service going forward.",
  ],
  other: [
    "Thank you for your feedback, {buyer} ji. We are taking this seriously and will work to improve.",
    "{buyer}, we appreciate you letting us know. We will look into this and follow up with you soon.",
  ],
};

const STOPWORDS = new Set([
  "the","a","an","and","or","but","was","were","is","are","been","be","this","that",
  "it","its","for","of","to","in","on","at","with","from","as","very","too","not",
  "no","again","this","week","time","got","get","had","have","has","did","do","does",
  "our","your","my","mandi","farmer","buyer","trader","comment","feedback",
  ...POS_WORDS, ...NEG_WORDS,
]);

// ---------- Date helpers ----------
function getWeekStart(dateInput) {
  const d = new Date(dateInput);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
function fmtWeek(d) {
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---------- Seed data ----------
const SEED_RAW = [
  // recent week (0-6 days ago) — skewed negative to demonstrate the alert
  { d: 0, buyer: "Ramesh Traders", tag: "price", c: "Rate is too mehenga compared to nearby mandi, feels overpriced." },
  { d: 1, buyer: "Sunita Agro", tag: "quantity", c: "Short weight again, bag was underweight, very disappointed." },
  { d: 1, buyer: "Om Vegetables", tag: "quality", c: "Tomatoes were half rotten, poor quality this time." },
  { d: 2, buyer: "Krishna Foods", tag: "service", c: "Payment delayed by three days, unhappy experience at the counter." },
  { d: 3, buyer: "Patel Trading Co", tag: "quality", c: "Accha maal tha, sasta bhi mila. Khush hoon." },
  { d: 4, buyer: "Green Basket", tag: "other", c: "Received the delivery, quantity looks okay, standard batch." },
  { d: 5, buyer: "Bansal Traders", tag: "price", c: "Price suddenly increased, feels unfair for regular buyers." },
  { d: 6, buyer: "Mehta Foods", tag: "quality", c: "Fresh onions, well packed, no complaints at all." },
  // week 2
  { d: 9, buyer: "Sunita Agro", tag: "quality", c: "Best quality wheat this season, superb rate too." },
  { d: 10, buyer: "Om Vegetables", tag: "service", c: "Timely delivery and honest dealing, trustworthy farmer." },
  { d: 11, buyer: "Ramesh Traders", tag: "quantity", c: "Weight was correct, payment on time, very satisfied." },
  { d: 12, buyer: "Krishna Foods", tag: "quality", c: "Onions were stale and damaged during transport." },
  { d: 13, buyer: "Patel Trading Co", tag: "price", c: "Fair price, fair rate, will buy again next week." },
  { d: 13, buyer: "Green Basket", tag: "other", c: "Order was fulfilled as per the agreement, nothing special." },
  // week 3
  { d: 16, buyer: "Bansal Traders", tag: "service", c: "Rude behaviour at the weighing counter, not happy." },
  { d: 17, buyer: "Mehta Foods", tag: "quality", c: "Good quality potatoes, clean and fresh, reliable seller." },
  { d: 18, buyer: "Sunita Agro", tag: "quantity", c: "Correct weight, well packed, good quality overall." },
  { d: 19, buyer: "Om Vegetables", tag: "price", c: "Kharab rate mila, bekar deal compared to last season." },
  { d: 20, buyer: "Ramesh Traders", tag: "other", c: "Standard delivery, order fulfilled, no issues to report." },
  { d: 21, buyer: "Krishna Foods", tag: "quality", c: "Excellent produce, genuine dealing, will recommend to others." },
  // week 4
  { d: 24, buyer: "Patel Trading Co", tag: "quantity", c: "Bag was underweight by two kilos, disappointed with this batch." },
  { d: 25, buyer: "Green Basket", tag: "quality", c: "Nice fresh spinach, badhiya quality, khush hoon with the deal." },
  { d: 26, buyer: "Bansal Traders", tag: "price", c: "Cheap and fair price this week, good value for money." },
  { d: 27, buyer: "Mehta Foods", tag: "service", c: "Prompt payment, honest trader, smooth transaction as always." },
  { d: 28, buyer: "Sunita Agro", tag: "other", c: "Average batch, nothing to complain about, standard quality." },
  // week 5
  { d: 31, buyer: "Om Vegetables", tag: "quality", c: "Damaged onions on arrival, poor quality and low quality overall." },
  { d: 32, buyer: "Ramesh Traders", tag: "price", c: "Best rate offered this season, sasta aur accha both." },
  { d: 33, buyer: "Krishna Foods", tag: "quantity", c: "Full weight delivered, no shortfall, very reliable dealing." },
];

const SEED_DATA = SEED_RAW.map((r, i) => ({
  id: `seed-${i}`,
  date: daysAgo(r.d),
  buyer: r.buyer,
  tag: r.tag,
  comment: r.c,
  sentiment: analyzeSentiment(r.c),
}));

const SENTIMENT_COLOR = { positive: "#3F6B2E", neutral: "#8A7B4E", negative: "#A8432B" };
const SENTIMENT_BG = { positive: "#E4EBD4", neutral: "#EDE3C6", negative: "#F1DCCF" };

export default function MandiSentimentDashboard() {
  const [feedback, setFeedback] = useState(SEED_DATA);
  const [threshold, setThreshold] = useState(35);
  const [openReplyId, setOpenReplyId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [csvMsg, setCsvMsg] = useState(null);
  const [tagFilter, setTagFilter] = useState("all");
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({ buyer: "", tag: "price", comment: "", date: new Date().toISOString().slice(0, 10) });
  const [formErr, setFormErr] = useState("");

  // ---------- derived data ----------
  const stats = useMemo(() => {
    const total = feedback.length;
    const pos = feedback.filter((f) => f.sentiment === "positive").length;
    const neg = feedback.filter((f) => f.sentiment === "negative").length;
    const neu = total - pos - neg;
    return {
      total, pos, neg, neu,
      posPct: total ? Math.round((pos / total) * 100) : 0,
      negPct: total ? Math.round((neg / total) * 100) : 0,
    };
  }, [feedback]);

  const weeklyData = useMemo(() => {
    const map = new Map();
    feedback.forEach((f) => {
      const wk = getWeekStart(f.date).getTime();
      if (!map.has(wk)) map.set(wk, { positive: 0, neutral: 0, negative: 0 });
      map.get(wk)[f.sentiment] += 1;
    });
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([wk, v]) => {
        const total = v.positive + v.neutral + v.negative;
        return {
          weekTs: wk,
          week: fmtWeek(new Date(wk)),
          positive: v.positive,
          neutral: v.neutral,
          negative: v.negative,
          negPct: total ? Math.round((v.negative / total) * 100) : 0,
          total,
        };
      });
  }, [feedback]);

  const currentWeekTs = getWeekStart(new Date()).getTime();
  const currentWeekStats = weeklyData.find((w) => w.weekTs === currentWeekTs);
  const alertActive = currentWeekStats && currentWeekStats.total >= 3 && currentWeekStats.negPct >= threshold;

  const negWordFreq = useMemo(() => {
    const freq = new Map();
    feedback.filter((f) => f.sentiment === "negative").forEach((f) => {
      const tokens = f.comment.toLowerCase().replace(/[.,!?;:()"']/g, "").split(/\s+/);
      tokens.forEach((t) => {
        if (t.length > 2 && !STOPWORDS.has(t)) freq.set(t, (freq.get(t) || 0) + 1);
      });
    });
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [feedback]);

  const tagSplit = useMemo(() => {
    return TAGS.map((tg) => {
      const rows = feedback.filter((f) => f.tag === tg.id);
      const total = rows.length;
      const pos = rows.filter((r) => r.sentiment === "positive").length;
      const neg = rows.filter((r) => r.sentiment === "negative").length;
      const neu = total - pos - neg;
      return { ...tg, total, pos, neu, neg,
        posPct: total ? (pos / total) * 100 : 0,
        neuPct: total ? (neu / total) * 100 : 0,
        negPct: total ? (neg / total) * 100 : 0 };
    });
  }, [feedback]);

  const recentFeed = useMemo(() => {
    const rows = tagFilter === "all" ? feedback : feedback.filter((f) => f.tag === tagFilter);
    return [...rows].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);
  }, [feedback, tagFilter]);

  // ---------- actions ----------
  function addFeedback(e) {
    e.preventDefault();
    if (!form.buyer.trim() || !form.comment.trim()) {
      setFormErr("Enter a buyer/trader name and a comment.");
      return;
    }
    const entry = {
      id: `manual-${Date.now()}`,
      date: form.date,
      buyer: form.buyer.trim(),
      tag: form.tag,
      comment: form.comment.trim(),
      sentiment: analyzeSentiment(form.comment),
    };
    setFeedback((prev) => [entry, ...prev]);
    setForm({ buyer: "", tag: "price", comment: "", date: new Date().toISOString().slice(0, 10) });
    setFormErr("");
  }

  function handleCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validTagIds = new Set(TAGS.map((t) => t.id));
        const rows = results.data
          .filter((r) => r.comment && r.comment.trim())
          .map((r, i) => {
            const tag = validTagIds.has((r.tag || "").toLowerCase()) ? r.tag.toLowerCase() : "other";
            const date = r.date && !isNaN(new Date(r.date)) ? new Date(r.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
            return {
              id: `csv-${Date.now()}-${i}`,
              date,
              buyer: (r.buyer || "Unknown buyer").trim(),
              tag,
              comment: r.comment.trim(),
              sentiment: analyzeSentiment(r.comment),
            };
          });
        if (rows.length) {
          setFeedback((prev) => [...rows, ...prev]);
          setCsvMsg(`Added ${rows.length} comment${rows.length === 1 ? "" : "s"} from CSV.`);
        } else {
          setCsvMsg("No usable rows found. Check the comment column.");
        }
        setTimeout(() => setCsvMsg(null), 4500);
      },
    });
    e.target.value = "";
  }

  function downloadSampleCsv() {
    const sample = "date,buyer,tag,comment\n2026-08-08,Ramesh Traders,price,Rate felt too high this week\n2026-08-09,Sunita Agro,quality,Fresh produce and well packed";
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mandi-feedback-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyReply(key, text) {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  return (
    <div style={{ background: "#EDE3C6", minHeight: "100vh", fontFamily: "'Karla', sans-serif", color: "#23301D" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rokkitt:wght@500;700&family=Karla:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .mandi-display { font-family: 'Rokkitt', serif; }
        .mandi-mono { font-family: 'IBM Plex Mono', monospace; }
        .mandi-plate { background: #F7F1DD; border: 1px solid #C7B583; border-radius: 6px; }
        .mandi-rule { border-bottom: 1px dashed #B9A876; }
        .mandi-btn { background: #23301D; color: #F7F1DD; border: none; border-radius: 4px; padding: 9px 16px; font-weight: 700; cursor: pointer; font-size: 13px; letter-spacing: 0.02em; }
        .mandi-btn:hover { background: #3B4A2E; }
        .mandi-btn-outline { background: transparent; color: #23301D; border: 1.5px solid #23301D; border-radius: 4px; padding: 8px 15px; font-weight: 700; cursor: pointer; font-size: 13px; }
        .mandi-btn-outline:hover { background: #23301D; color: #F7F1DD; }
        .mandi-input, .mandi-select, .mandi-textarea { background: #FFFDF5; border: 1px solid #B9A876; border-radius: 4px; padding: 8px 10px; font-family: 'Karla', sans-serif; font-size: 14px; color: #23301D; width: 100%; box-sizing: border-box; }
        .mandi-input:focus, .mandi-select:focus, .mandi-textarea:focus { outline: 2px solid #3F6B2E; outline-offset: 1px; }
        .mandi-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; letter-spacing: 0.02em; text-transform: uppercase; }
        .mandi-stamp { border: 3px double #A8432B; color: #A8432B; transform: rotate(-6deg); font-family: 'Rokkitt', serif; font-weight: 700; }
        .mandi-scroll::-webkit-scrollbar { width: 6px; }
        .mandi-scroll::-webkit-scrollbar-thumb { background: #C7B583; border-radius: 4px; }
      `}</style>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 60px" }}>

        {/* Header / rate board */}
        <div className="mandi-plate" style={{ padding: "20px 24px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#23301D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wheat size={24} color="#F7F1DD" />
              </div>
              <div>
                <h1 className="mandi-display" style={{ fontSize: 26, margin: 0, letterSpacing: "0.01em" }}>Mandi Feedback Ledger</h1>
                <p className="mandi-mono" style={{ margin: "2px 0 0", fontSize: 12, color: "#5C5738" }}>
                  {stats.total} entries on record &middot; updated as you add feedback
                </p>
              </div>
            </div>
            {alertActive && (
              <div className="mandi-stamp" style={{ padding: "8px 14px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, background: "#FFFDF5" }}>
                <AlertTriangle size={20} />
                <div style={{ lineHeight: 1.15 }}>
                  <div style={{ fontSize: 14 }}>RATE ALERT</div>
                  <div className="mandi-mono" style={{ fontSize: 10, fontWeight: 600 }}>{currentWeekStats.negPct}% negative this week</div>
                </div>
              </div>
            )}
          </div>

          {/* stat plates */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 20 }}>
            <StatPlate label="Total feedback" value={stats.total} icon={MessageSquareText} />
            <StatPlate label="Positive" value={`${stats.posPct}%`} sub={`${stats.pos} comments`} icon={TrendingUp} tone="positive" />
            <StatPlate label="Negative" value={`${stats.negPct}%`} sub={`${stats.neg} comments`} icon={TrendingDown} tone="negative" />
            <StatPlate
              label="This week's negative"
              value={currentWeekStats ? `${currentWeekStats.negPct}%` : "—"}
              sub={currentWeekStats ? `${currentWeekStats.total} comments so far` : "No entries yet"}
              icon={AlertTriangle}
              tone={alertActive ? "negative" : "neutral"}
            />
          </div>
        </div>

        {/* Add feedback + CSV + threshold row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 20 }}>
          <div className="mandi-plate" style={{ padding: 18 }}>
            <h2 className="mandi-display" style={{ fontSize: 17, margin: "0 0 12px" }}>Add a comment</h2>
            <form onSubmit={addFeedback}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Buyer / trader</label>
                  <input className="mandi-input" placeholder="e.g. Ramesh Traders" value={form.buyer}
                    onChange={(e) => setForm({ ...form, buyer: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" className="mandi-input" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>About</label>
                <select className="mandi-select" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
                  {TAGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Comment</label>
                <textarea className="mandi-textarea" rows={3} placeholder="What did the buyer say?"
                  value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
              </div>
              {formErr && <p style={{ color: "#A8432B", fontSize: 12, margin: "0 0 8px" }}>{formErr}</p>}
              <button type="submit" className="mandi-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={15} /> Add to ledger
              </button>
            </form>

            <div className="mandi-rule" style={{ margin: "16px 0" }} />

            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.03em", color: "#5C5738" }}>Or upload a CSV</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="mandi-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> Upload CSV
              </button>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCsv} />
              <button className="mandi-btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={downloadSampleCsv}>
                <Download size={14} /> Sample format
              </button>
            </div>
            <p className="mandi-mono" style={{ fontSize: 11, color: "#8A8360", margin: "8px 0 0" }}>Columns: date, buyer, tag, comment</p>
            {csvMsg && <p style={{ fontSize: 12, color: "#3F6B2E", fontWeight: 700, marginTop: 8 }}>{csvMsg}</p>}
          </div>

          <div className="mandi-plate" style={{ padding: 18 }}>
            <h2 className="mandi-display" style={{ fontSize: 17, margin: "0 0 12px" }}>Alert threshold</h2>
            <p style={{ fontSize: 13, color: "#5C5738", margin: "0 0 10px" }}>
              Stamp fires when a week's negative share crosses this line (needs at least 3 comments that week).
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <input type="range" min={10} max={70} step={5} value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))} style={{ flex: 1 }} />
              <span className="mandi-mono" style={{ fontWeight: 700, minWidth: 40 }}>{threshold}%</span>
            </div>
            <div className="mandi-rule" style={{ margin: "16px 0" }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.03em", color: "#5C5738" }}>
              Filter the feed below
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button onClick={() => setTagFilter("all")} className="mandi-chip" style={{ background: tagFilter === "all" ? "#23301D" : "#E9DFC2", color: tagFilter === "all" ? "#F7F1DD" : "#5C5738", border: "none", cursor: "pointer" }}>All</button>
              {TAGS.map((t) => (
                <button key={t.id} onClick={() => setTagFilter(t.id)} className="mandi-chip"
                  style={{ background: tagFilter === t.id ? "#23301D" : "#E9DFC2", color: tagFilter === t.id ? "#F7F1DD" : "#5C5738", border: "none", cursor: "pointer" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly chart */}
        <div className="mandi-plate" style={{ padding: 18, marginBottom: 20 }}>
          <h2 className="mandi-display" style={{ fontSize: 17, margin: "0 0 4px" }}>Sentiment by week</h2>
          <p style={{ fontSize: 12, color: "#8A8360", margin: "0 0 12px" }}>Positive, neutral and negative comment counts per week.</p>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCCFA0" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "#5C5738", fontSize: 12, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#B9A876" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#5C5738", fontSize: 12, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "#B9A876" }} tickLine={false} />
                <Tooltip contentStyle={{ background: "#FFFDF5", border: "1px solid #B9A876", borderRadius: 6, fontFamily: "Karla", fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Karla" }} />
                <Bar dataKey="positive" stackId="s" fill={SENTIMENT_COLOR.positive} name="Positive" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutral" stackId="s" fill={SENTIMENT_COLOR.neutral} name="Neutral" />
                <Bar dataKey="negative" stackId="s" fill={SENTIMENT_COLOR.negative} name="Negative" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* word freq + tag split */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div className="mandi-plate" style={{ padding: 18 }}>
            <h2 className="mandi-display" style={{ fontSize: 17, margin: "0 0 12px" }}>Common words in negative feedback</h2>
            {negWordFreq.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8A8360" }}>No negative feedback yet.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {negWordFreq.map(([word, count]) => (
                  <span key={word} className="mandi-chip" style={{ background: "#F1DCCF", color: "#7A2E1A", textTransform: "none", fontSize: 12 + Math.min(count, 5), border: "1px solid #E0B79C" }}>
                    {word} <span className="mandi-mono" style={{ opacity: 0.7 }}>&times;{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mandi-plate" style={{ padding: 18 }}>
            <h2 className="mandi-display" style={{ fontSize: 17, margin: "0 0 12px" }}>Sentiment split by topic</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tagSplit.map((t) => (
                <div key={t.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700 }}><t.icon size={13} /> {t.label}</span>
                    <span className="mandi-mono" style={{ color: "#8A8360" }}>{t.total}</span>
                  </div>
                  <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "#E9DFC2" }}>
                    {t.total === 0 ? null : (
                      <>
                        <div style={{ width: `${t.posPct}%`, background: SENTIMENT_COLOR.positive }} />
                        <div style={{ width: `${t.neuPct}%`, background: SENTIMENT_COLOR.neutral }} />
                        <div style={{ width: `${t.negPct}%`, background: SENTIMENT_COLOR.negative }} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* recent feed */}
        <div className="mandi-plate" style={{ padding: 18 }}>
          <h2 className="mandi-display" style={{ fontSize: 17, margin: "0 0 12px" }}>
            Recent comments {tagFilter !== "all" && <span style={{ fontSize: 13, fontWeight: 400, color: "#8A8360" }}>&middot; {TAGS.find((t) => t.id === tagFilter)?.label}</span>}
          </h2>
          <div className="mandi-scroll" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto" }}>
            {recentFeed.length === 0 && <p style={{ fontSize: 13, color: "#8A8360" }}>No comments for this filter yet.</p>}
            {recentFeed.map((f) => {
              const tagInfo = TAGS.find((t) => t.id === f.tag) || TAGS[4];
              return (
                <div key={f.id} style={{ background: "#FFFDF5", border: "1px solid #E0D6AE", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13 }}>{f.buyer}</strong>
                      <span className="mandi-chip" style={{ background: SENTIMENT_BG[f.sentiment], color: SENTIMENT_COLOR[f.sentiment] }}>{f.sentiment}</span>
                      <span className="mandi-chip" style={{ background: "#E9DFC2", color: "#5C5738" }}>{tagInfo.label}</span>
                    </div>
                    <span className="mandi-mono" style={{ fontSize: 11, color: "#8A8360" }}>{fmtDate(f.date)}</span>
                  </div>
                  <p style={{ fontSize: 14, margin: "0 0 8px", lineHeight: 1.45 }}>{f.comment}</p>
                  {f.sentiment === "negative" && (
                    <div>
                      <button className="mandi-btn-outline" style={{ fontSize: 12, padding: "5px 10px" }}
                        onClick={() => setOpenReplyId(openReplyId === f.id ? null : f.id)}>
                        {openReplyId === f.id ? "Hide reply templates" : "Suggest a reply"}
                      </button>
                      {openReplyId === f.id && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                          {REPLY_TEMPLATES[f.tag].map((tpl, i) => {
                            const text = tpl.replace("{buyer}", f.buyer);
                            const key = `${f.id}-${i}`;
                            return (
                              <div key={key} style={{ background: "#F7F1DD", border: "1px dashed #C7B583", borderRadius: 5, padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <span style={{ fontSize: 13, lineHeight: 1.4 }}>{text}</span>
                                <button onClick={() => copyReply(key, text)} title="Copy reply" aria-label="Copy reply"
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#3F6B2E", flexShrink: 0 }}>
                                  {copiedKey === key ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="mandi-mono" style={{ textAlign: "center", fontSize: 11, color: "#8A8360", marginTop: 24 }}>
          Sentiment is estimated with a plain-language keyword model — treat borderline calls as a starting point, not the final word.
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, color: "#5C5738", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.02em" };

function StatPlate({ label, value, sub, icon: Icon, tone }) {
  const toneColor = tone === "positive" ? "#3F6B2E" : tone === "negative" ? "#A8432B" : "#23301D";
  return (
    <div style={{ background: "#FFFDF5", border: "1px solid #E0D6AE", borderRadius: 6, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon size={14} color={toneColor} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#5C5738", textTransform: "uppercase", letterSpacing: "0.02em" }}>{label}</span>
      </div>
      <div className="mandi-display" style={{ fontSize: 26, color: toneColor, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#8A8360", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
