const SOICWatchlist = ({ items = [] }) => (
<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
<h2 className="text-lg font-semibold text-slate-900">Watchlist</h2>
<ul className="mt-3 space-y-2 text-sm text-slate-700">
{items.length ? items.slice(0, 8).map((item) => (
<li key={item._id} className="rounded border border-slate-100 px-3 py-2">
Site {String(item.user_id)} · Ratio {Number(item.performance_ratio || 0).toFixed(3)}
</li>
)) : <li className="text-slate-500">No watchlist items.</li>}
</ul>
</section>
);

export default SOICWatchlist;
