import { useEffect, useState } from "react";
import treesData from "./data/trees.json";
import {
  LineChart,  Line,  XAxis,  YAxis,  Tooltip,  ResponsiveContainer,} from "recharts";

// ================= SYMBOL MAP =================
const symbolMap = {
  Bitcoin: "BTCUSDT",
  Ethereum: "ETHUSDT",
  Litecoin: "LTCUSDT",
  XRP: "XRPUSDT",
  Dogecoin: "DOGEUSDT",
  Solana: "SOLUSDT",
};
const coinGeckoMap = {
  Bitcoin: "bitcoin",
  Ethereum: "ethereum",
  Litecoin: "litecoin",
  XRP: "ripple",
  Dogecoin: "dogecoin",
  Solana: "solana",
  BinanceCoin: "binancecoin",
  ChainLink: "chainlink",
};
// ================= TREE =================
function traverseTree(node, features, steps = []) {
  if (!node) return { value: 0, steps };

  if (node.leaf) {
    steps.push({ type: "leaf", value: node.value });
    return { value: node.value, steps };
  }

  const val = features[node.feature] ?? 0;
  const goLeft = val <= node.threshold;

  steps.push({
    feature: node.feature,
    threshold: node.threshold,
    value: val,
    direction: goLeft ? "YES" : "NO",
  });

  return traverseTree(
    goLeft ? node.left : node.right,
    features,
    steps
  );
}

// ================= API =================
async function fetchPriceData(coinId) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30`
  );
  const data = await res.json();

  return data.prices.map((p, i) => ({
    date: new Date(p[0]).toLocaleDateString(),
    close: p[1],
    volume: data.total_volumes[i][1],
    high: p[1], // approx
    low: p[1],  // approx
    open: p[1], // approx
  }));
}
// ================= FEATURES =================
function generateFeatures(data) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];

  const ma7 =
    data.slice(-7).reduce((s, d) => s + d.close, 0) / 7;

  return {
    ret_1d: (last.close - prev.close) / prev.close,
    ma_7: ma7,
    rolling_ret3:
      (last.close - data[data.length - 4].close) /
      data[data.length - 4].close,
    volatility: Math.abs(last.high - last.low),
    Open: last.open,
    Close: last.close,
    High: last.high,
    Low: last.low,
    body: last.close - last.open,
    vol_change: (last.volume - prev.volume) / prev.volume,
    close_vs_ma: last.close - ma7,
    "Unnamed: 0": 0,
    day_of_week: new Date().getDay(),
  };
}

// ================= UI =================
function Navbar({ theme, setTheme, search, setSearch }) {
  return (
    <div className="flex flex-col md:flex-row gap-2 justify-between items-center p-4 backdrop-blur-md bg-white/10 border-b border-white/10">
      <h1 className="text-xl font-bold">TokenTrend</h1>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search coin..."
        className="px-3 py-1 rounded bg-white/20 outline-none"
      />

      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="px-3 py-1 rounded bg-white/20"
      >
        {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
      </button>
    </div>
  );
}

function TokenCard({ coinData, onClick }) {
  return (
    <div
      onClick={() => onClick(coinData)}
      className="p-4 rounded-xl cursor-pointer backdrop-blur-md bg-white/10 border border-white/10 hover:scale-105 transition"
    >
      <h2>{coinData.coin}</h2>
      <p className="text-sm opacity-70">
        Accuracy: {(coinData.acc * 100).toFixed(1)}%
      </p>
    </div>
  );
}

function PriceChart({ data }) {
  return (
    <div className="p-4 rounded-xl backdrop-blur-md bg-white/10">
      <h2 className="mb-2">Price Trend</h2>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <XAxis dataKey="date" hide />
          <YAxis hide />
          <Tooltip />
          <Line type="monotone" dataKey="close" stroke="#22c55e" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PredictionPanel({ result }) {
  return (
    <div className="p-4 rounded-xl backdrop-blur-md bg-white/10">
      <h2 className="font-bold">Prediction</h2>

      <div className="text-3xl mt-2">
        {result.label === "UP" ? "📈 UP" : "📉 DOWN"}
      </div>

      <p>{result.confidence}% confidence</p>

      <div className="w-full h-2 bg-gray-400 mt-2 rounded">
        <div
          className={`h-2 rounded transition-all duration-700 ${
            result.label === "UP" ? "bg-green-400" : "bg-red-400"
          }`}
          style={{ width: `${result.confidence}%` }}
        />
      </div>
    </div>
  );
}

function DecisionSteps({ steps }) {
  return (
    <div className="p-4 rounded-xl backdrop-blur-md bg-white/10">
      <h2 className="mb-3 font-bold">Why this prediction?</h2>

      <div className="space-y-2 text-sm">
        {steps.map((s, i) => {
          if (s.type === "leaf") {
            return (
              <div
                key={i}
                className="p-2 rounded bg-green-500 text-black font-bold"
              >
                Final Decision → {s.value === 1 ? "UP 📈" : "DOWN 📉"}
              </div>
            );
          }

          return (
            <div
              key={i}
              className="p-2 rounded bg-white/20 flex justify-between"
            >
              <span>
                {s.feature} ≤ {s.threshold.toFixed(2)}
              </span>
              <span>
                Value: {s.value.toFixed(2)} → {s.direction}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}



export default function App() {
  const [coins, setCoins] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [result, setResult] = useState({ label: "UP", confidence: "0" });
  const [priceData, setPriceData] = useState([]);
  const [steps, setSteps] = useState([]);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setCoins(Object.values(treesData));
  }, []);

  useEffect(() => {
    document.body.className =
      theme === "dark"
        ? "bg-black text-white"
        : "bg-white text-black";
  }, [theme]);

  useEffect(() => {
    async function run() {
      if (!selectedCoin) return;

      const coinId = coinGeckoMap[selectedCoin.coin] || "bitcoin";
const data = await fetchPriceData(coinId);
      setPriceData(data);

      const features = generateFeatures(data);

      const { value, steps } = traverseTree(
        selectedCoin.tree,
        features,
        []
      );

      setSteps(steps);

      setResult({
        label: value === 1 ? "UP" : "DOWN",
        confidence: (selectedCoin.acc * 100).toFixed(2),
      });
    }

    run();
  }, [selectedCoin]);

  const filteredCoins = coins.filter((c) =>
    c.coin.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <Navbar
        theme={theme}
        setTheme={setTheme}
        search={search}
        setSearch={setSearch}
      />

      <div className="p-4 space-y-4">
        {/* Coins */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filteredCoins.map((c, i) => (
            <TokenCard key={i} coinData={c} onClick={setSelectedCoin} />
          ))}
        </div>

        {selectedCoin && (
          <>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <PriceChart data={priceData} />
              </div>
              <PredictionPanel result={result} />
            </div>

            <DecisionSteps steps={steps} />
          </>
        )}
      </div>
    </div>
  );
}
