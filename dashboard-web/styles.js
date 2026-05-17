// styles.js - All CSS styles for the dashboard
function getStyles() {
  return `
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            line-height: 1.6;
        }
        .header {
            background: #161b22;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #30363d;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        .header h1 {
            font-size: 1.5rem;
            color: #58a6ff;
        }
        .nav-buttons {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }
        .nav-btn {
            padding: 0.5rem 1rem;
            background: #21262d;
            border: 1px solid #30363d;
            color: #c9d1d9;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 500;
            transition: all 0.2s;
        }
        .nav-btn:hover {
            background: #30363d;
        }
        .nav-btn.active {
            background: #1f6feb;
            border-color: #1f6feb;
            color: #fff;
        }
        .nav-btn.queue {
            background: #238636;
            border-color: #238636;
        }
        .nav-btn.queue:hover {
            background: #2ea043;
        }
        .stats {
            display: flex;
            gap: 1.5rem;
            font-size: 0.85rem;
            flex-wrap: wrap;
        }
        .stat {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .stat-value {
            font-weight: 600;
            color: #fff;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.5rem;
        }
        .top-picks {
            background: linear-gradient(135deg, #161b22 0%, #0d1117 100%);
            border: 2px solid #238636;
            border-radius: 12px;
            padding: 1.25rem;
            margin-bottom: 1.5rem;
        }
        .top-picks h2 {
            color: #3fb950;
            font-size: 1.1rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .top-picks-list {
            display: grid;
            gap: 0.75rem;
        }
        .top-pick-item {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .top-pick-info {
            flex: 1;
            min-width: 250px;
        }
        .top-pick-company {
            font-weight: 600;
            color: #fff;
            font-size: 1rem;
        }
        .top-pick-role {
            color: #8b949e;
            font-size: 0.9rem;
            margin-top: 0.25rem;
        }
        .top-pick-score {
            background: #238636;
            color: #fff;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.9rem;
        }
        .section-title {
            font-size: 1.1rem;
            color: #58a6ff;
            margin-bottom: 1rem;
            font-weight: 600;
        }
        .eval-card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 1.25rem;
            margin-bottom: 1rem;
            transition: border-color 0.2s;
        }
        .eval-card:hover {
            border-color: #58a6ff;
        }
        .eval-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.75rem;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .eval-rank {
            font-size: 0.75rem;
            color: #8b949e;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .eval-company {
            font-size: 1.25rem;
            font-weight: 600;
            color: #fff;
            margin-top: 0.25rem;
        }
        .eval-role {
            color: #c9d1d9;
            font-size: 0.95rem;
            margin-top: 0.25rem;
        }
        .eval-archetype {
            display: inline-block;
            background: #21262d;
            color: #58a6ff;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.8rem;
            margin-top: 0.5rem;
        }
        .eval-score {
            text-align: right;
        }
        .score-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #f0883e;
        }
        .score-label {
            font-size: 0.75rem;
            color: #8b949e;
            text-transform: uppercase;
        }
        .eval-meta {
            display: flex;
            gap: 1.5rem;
            margin: 0.75rem 0;
            flex-wrap: wrap;
        }
        .meta-item {
            display: flex;
            gap: 0.5rem;
            font-size: 0.9rem;
        }
        .meta-label {
            color: #8b949e;
        }
        .meta-value {
            color: #c9d1d9;
        }
        .eval-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 1rem;
            flex-wrap: wrap;
            gap: 0.75rem;
        }
        .eval-verdict {
            font-size: 0.85rem;
            font-weight: 600;
            padding: 0.35rem 0.75rem;
            border-radius: 6px;
        }
        .verdict-apply {
            background: #238636;
            color: #fff;
        }
        .verdict-consider {
            background: #f0883e;
            color: #fff;
        }
        .verdict-blocked {
            background: #da3633;
            color: #fff;
        }
        .verdict-decent {
            background: #1f6feb;
            color: #fff;
        }
        .btn {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.2s;
        }
        .btn-view {
            background: #21262d;
            color: #58a6ff;
            border: 1px solid #30363d;
        }
        .btn-view:hover {
            background: #30363d;
        }
        .btn-details {
            background: #1f6feb;
            color: #fff;
        }
        .btn-details:hover {
            background: #388bfd;
        }
        .btn-generate {
            background: #d29922;
            color: #fff;
        }
        .btn-generate:hover {
            background: #e3b341;
        }
        .btn-cover {
            background: #8957e5;
            color: #fff;
        }
        .btn-cover:hover {
            background: #a371f7;
        }
        .pdf-status {
            margin-top: 0.5rem;
            padding: 0.5rem;
            border-radius: 6px;
            font-size: 0.85rem;
            display: none;
        }
        .pdf-status.success {
            background: #238636;
            color: #fff;
            display: block;
        }
        .pdf-status.error {
            background: #da3633;
            color: #fff;
            display: block;
        }
        .details-content {
            display: none;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid #30363d;
        }
        .details-content.show {
            display: block;
        }
        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1rem;
        }
        .detail-block {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1rem;
        }
        .block-title {
            font-size: 0.8rem;
            color: #58a6ff;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
        }
        .block-value {
            color: #fff;
            font-size: 0.9rem;
        }
        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #8b949e;
        }
        .job-list {
            display: grid;
            gap: 0.75rem;
        }
        .job-item {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .job-company {
            font-weight: 600;
            color: #fff;
        }
        .job-role {
            color: #8b949e;
            font-size: 0.9rem;
        }
        .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        .status-pending {
            background: #d29922;
            color: #fff;
        }
        .status-evaluated {
            background: #238636;
            color: #fff;
        }
        .btn-eval {
            background: #8957e5;
            color: #fff;
        }
        .btn-eval:hover {
            background: #a371f7;
        }
    </style>
  `;
}

module.exports = { getStyles };
