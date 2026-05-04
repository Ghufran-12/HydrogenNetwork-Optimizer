import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/bookmarks-page.css";
import "../styles/bookmarks-filters.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

export default function BookmarksPage() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [selectedForComparison, setSelectedForComparison] = useState(new Set());
  const [filters, setFilters] = useState({
    tags: new Set(),
    dateRange: "all",
    search: "",
    sortBy: "date",
  });

  useEffect(() => {
    const saved = localStorage.getItem("smr_bookmarks");
    if (saved) {
      setBookmarks(JSON.parse(saved));
    }
  }, []);

  const filteredAndSorted = useMemo(() => {
    let result = [...bookmarks];

    // Filter by tags
    if (filters.tags.size > 0) {
      result = result.filter(bm => 
        bm.tags && bm.tags.some(tag => filters.tags.has(tag))
      );
    }

    // Filter by date range
    if (filters.dateRange !== "all") {
      const now = new Date();
      
      result = result.filter(bm => {
        try {
          const bmDate = new Date(bm.timestamp);
          const diff = now - bmDate;
          const days = diff / (1000 * 60 * 60 * 24);
          
          if (filters.dateRange === "7days") return days <= 7;
          if (filters.dateRange === "30days") return days <= 30;
          if (filters.dateRange === "90days") return days <= 90;
          return true;
        } catch (e) {
          return true;
        }
      });
    }

    // Filter by search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(bm =>
        bm.scenarioName.toLowerCase().includes(q) ||
        (bm.description && bm.description.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case "date":
          try {
            return new Date(b.timestamp) - new Date(a.timestamp);
          } catch (e) {
            return 0;
          }
        case "h2_cost":
          return (a.apiResult?.current?.h2_cost || 0) - (b.apiResult?.current?.h2_cost || 0);
        case "h2_production":
          return (b.apiResult?.current?.h2_production || 0) - (a.apiResult?.current?.h2_production || 0);
        case "co2":
          return (a.apiResult?.current?.co2_annual_tonnes || 0) - (b.apiResult?.current?.co2_annual_tonnes || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [bookmarks, filters.tags.size, filters.dateRange, filters.search, filters.sortBy]);

  const toggleTagFilter = (tag) => {
    const newTags = new Set(filters.tags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setFilters({ ...filters, tags: newTags });
  };

  const toggleComparison = (id) => {
    if (selectedForComparison.size >= 3 && !selectedForComparison.has(id)) {
      alert("You can compare up to 3 scenarios at a time");
      return;
    }
    const newSelected = new Set(selectedForComparison);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForComparison(newSelected);
  };

  const handleCompare = () => {
    if (selectedForComparison.size < 2) {
      alert("Please select at least 2 scenarios to compare");
      return;
    }
    const selectedBookmarks = bookmarks.filter(b => selectedForComparison.has(b.id));
    navigate("/compare", { state: { bookmarks: selectedBookmarks } });
  };

  const handleRunBookmark = (bookmark) => {
    navigate("/results", {
      state: {
        apiResult: bookmark.apiResult,
        form: bookmark.form,
        scenarioName: bookmark.scenarioName,
      },
    });
  };

  const handleDeleteBookmark = (id) => {
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem("smr_bookmarks", JSON.stringify(updated));
    
    // Also remove from comparison selection
    const newSelected = new Set(selectedForComparison);
    newSelected.delete(id);
    setSelectedForComparison(newSelected);
  };

  const handleClearAll = () => {
    if (window.confirm("Delete all bookmarks? This cannot be undone.")) {
      setBookmarks([]);
      localStorage.removeItem("smr_bookmarks");
      setSelectedForComparison(new Set());
    }
  };

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Saved Scenarios" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">Saved Scenarios</div>
              <div className="page-heading-sub">Quick access to your bookmarked SMR scenarios</div>
            </div>
          </div>
          <div className="page-heading-actions">
            <button className="page-btn page-btn-solid" onClick={() => navigate("/smr")}>+ New Scenario</button>
          </div>
        </div>

        {bookmarks.length === 0 ? (
          <div className="bookmarks-empty">
            <div className="bookmarks-empty-icon">📌</div>
            <div className="bookmarks-empty-title">No bookmarks yet</div>
            <div className="bookmarks-empty-text">
              Start a scenario and click the star (☆) on the results page to save it.
            </div>
            <button className="bookmarks-new-btn" onClick={() => navigate("/smr")}>
              Create New Scenario
            </button>
          </div>
        ) : (
          <>
            {/* ── Filters Panel ── */}
            <div className="bookmarks-filters">
              <div className="filter-section">
                <label className="filter-label">Search</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search scenarios..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>

              <div className="filter-section">
                <label className="filter-label">Tags</label>
                <div className="filter-tags">
                  {["baseline", "optimized", "experimental"].map(tag => (
                    <label key={tag} className="filter-tag-checkbox">
                      <input
                        type="checkbox"
                        checked={filters.tags.has(tag)}
                        onChange={() => toggleTagFilter(tag)}
                      />
                      <span className={`filter-tag-badge filter-tag-${tag}`}>{tag}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <label className="filter-label">Date Range</label>
                <select
                  className="filter-select"
                  value={filters.dateRange}
                  onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                >
                  <option value="all">All Time</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="30days">Last 30 Days</option>
                  <option value="90days">Last 90 Days</option>
                </select>
              </div>

              <div className="filter-section">
                <label className="filter-label">Sort By</label>
                <select
                  className="filter-select"
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                >
                  <option value="date">Newest First</option>
                  <option value="h2_cost">Lowest H₂ Cost</option>
                  <option value="h2_production">Highest H₂ Production</option>
                  <option value="co2">Lowest CO₂ Emissions</option>
                </select>
              </div>
            </div>

            <div className="bookmarks-controls">
              <div className="bookmarks-count">
                {filteredAndSorted.length} of {bookmarks.length} scenario{bookmarks.length !== 1 ? "s" : ""}
                {selectedForComparison.size > 0 && ` • ${selectedForComparison.size} selected`}
              </div>
              <div className="control-buttons">
                {selectedForComparison.size >= 2 && (
                  <button className="compare-btn" onClick={handleCompare}>
                    Compare {selectedForComparison.size} Scenarios →
                  </button>
                )}
                {bookmarks.length > 0 && (
                  <button className="bookmarks-clear-btn" onClick={handleClearAll}>
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="bookmarks-grid">
              {filteredAndSorted.map((bm) => (
                <div key={bm.id} className={`bookmark-item ${selectedForComparison.has(bm.id) ? 'selected' : ''}`}>
                  <div className="bookmark-item-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedForComparison.has(bm.id)}
                      onChange={() => toggleComparison(bm.id)}
                      title="Select for comparison"
                    />
                  </div>

                  <div className="bookmark-item-header">
                    <h3 className="bookmark-item-name">{bm.scenarioName}</h3>
                    <button
                      className="bookmark-item-delete"
                      onClick={() => handleDeleteBookmark(bm.id)}
                      title="Delete bookmark"
                    >
                      ✕
                    </button>
                  </div>

                  {bm.description && (
                    <div className="bookmark-item-description">{bm.description}</div>
                  )}

                  {bm.tags && bm.tags.length > 0 && (
                    <div className="bookmark-item-tags">
                      {bm.tags.map((tag) => (
                        <span key={tag} className={`bookmark-tag bookmark-tag-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="bookmark-item-meta">
                    <span className="bookmark-item-time">{bm.timestamp}</span>
                  </div>

                  {bm.notes && (
                    <div className="bookmark-item-notes">{bm.notes}</div>
                  )}

                  <div className="bookmark-item-stats">
                    <div className="bookmark-stat">
                      <span className="bookmark-stat-label">H₂ Production</span>
                      <span className="bookmark-stat-value">{bm.apiResult?.predictions?.h2_production?.toFixed(1) || bm.apiResult?.current?.h2_production?.toFixed(1) || "—"}</span>
                      <span className="bookmark-stat-unit">kmol/h</span>
                    </div>
                    <div className="bookmark-stat">
                      <span className="bookmark-stat-label">H₂ Cost</span>
                      <span className="bookmark-stat-value">${(bm.apiResult?.current?.h2_cost / 1e6)?.toFixed(2) || "—"}</span>
                      <span className="bookmark-stat-unit">M/yr</span>
                    </div>
                    <div className="bookmark-stat">
                      <span className="bookmark-stat-label">CO₂ Annual</span>
                      <span className="bookmark-stat-value">{(bm.apiResult?.current?.co2_annual_tonnes / 1000)?.toFixed(1) || "—"}</span>
                      <span className="bookmark-stat-unit">k t/yr</span>
                    </div>
                  </div>

                  <button
                    className="bookmark-item-run"
                    onClick={() => handleRunBookmark(bm)}
                  >
                    View Results →
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
