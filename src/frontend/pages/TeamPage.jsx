import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/team-page.css";
import "../styles/shared-page.css";
import PageHeader from "../components/PageHeader";

export default function TeamPage() {
  const navigate = useNavigate();
  const { user, authFetch } = useAuth();

  const [team,        setTeam]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");
  const [teamName,    setTeamName]    = useState("");
  const [creating,    setCreating]    = useState(false);
  const [addEmail,    setAddEmail]    = useState("");
  const [adding,      setAdding]      = useState(false);
  const [removing,    setRemoving]    = useState(null);
  const [promoting,   setPromoting]   = useState(null);
  const [claimingMgr, setClaimingMgr] = useState(false);

  const isManager = user?.role === "manager";

  useEffect(() => { loadTeam(); }, []);

  async function loadTeam() {
    setLoading(true);
    try {
      const res  = await authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/teams/my-team");
      const data = await res.json();
      setTeam(data.team);
    } catch {
      setError("Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreating(true); setError(""); setSuccess("");
    try {
      const res  = await authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/teams/create", {
        method: "POST",
        body:   JSON.stringify({ name: teamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create team");
      setSuccess(`Team "${teamName.trim()}" created.`);
      setTeamName("");
      await loadTeam();
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setAdding(true); setError(""); setSuccess("");
    try {
      const res  = await authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/teams/add-member", {
        method: "POST",
        body:   JSON.stringify({ email: addEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add member");
      setSuccess(`${addEmail.trim()} added to the team.`);
      setAddEmail("");
      await loadTeam();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  }

  async function handleRemoveMember(memberEmail) {
    setRemoving(memberEmail); setError(""); setSuccess("");
    try {
      const res  = await authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/teams/remove-member", {
        method: "POST",
        body:   JSON.stringify({ email: memberEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to remove member");
      setSuccess(`${memberEmail} removed from the team.`);
      await loadTeam();
    } catch (err) { setError(err.message); }
    finally { setRemoving(null); }
  }

  async function handlePromote(memberEmail) {
    if (!window.confirm(`Promote ${memberEmail} to Manager? They will gain full manager permissions.`)) return;
    setPromoting(memberEmail); setError(""); setSuccess("");
    try {
      const res  = await authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/teams/promote-manager", {
        method: "POST",
        body:   JSON.stringify({ email: memberEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to promote");
      setSuccess(`${memberEmail} is now a Manager.`);
      await loadTeam();
    } catch (err) { setError(err.message); }
    finally { setPromoting(null); }
  }

  async function handleClaimManager() {
    if (!window.confirm("Claim the Manager role? This only works if no manager exists yet in the system.")) return;
    setClaimingMgr(true); setError(""); setSuccess("");
    try {
      const res  = await authFetch("http://https://hydrogennetwork-optimizer-1.onrender.com/auth/claim-manager", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not claim manager role");
      setSuccess("You are now a Manager. Please sign out and sign back in to refresh your role.");
    } catch (err) { setError(err.message); }
    finally { setClaimingMgr(false); }
  }

  return (
    <div className="shared-page">
      <div className="shared-shell">

        <PageHeader subtitle="Team Management" />

        <div className="shared-page-card">
        <div className="page-heading">
          <div className="page-heading-left">
            <button className="page-back-btn" onClick={() => navigate("/")}>← Home</button>
            <div>
              <div className="page-heading-title">My Team</div>
              <div className="page-heading-sub">
                {isManager ? "Manage members and collaboration settings" : "View your team"}
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error   && <div className="team-alert team-alert-error">{error}</div>}
        {success && <div className="team-alert team-alert-success">{success}</div>}

        {/* Loading */}
        {loading ? (
          <div className="team-loading">
            <div className="team-spinner" />
            Loading team data…
          </div>

        ) : !team ? (
          /* ── No team ── */
          <div className="team-empty-wrap">
            {isManager ? (
              <>
                <div className="team-empty-icon">👥</div>
                <div className="team-empty-title">No team yet</div>
                <div className="team-empty-sub">Create a team to collaborate with engineers and track shared goals.</div>
                <form className="team-create-form" onSubmit={handleCreateTeam}>
                  <input
                    className="team-input"
                    placeholder="Team name (e.g. SMR Team A)"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                  />
                  <button className="team-btn team-btn-solid" type="submit" disabled={creating || !teamName.trim()}>
                    {creating ? "Creating…" : "Create Team"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="team-empty-icon">🔗</div>
                <div className="team-empty-title">Not on a team yet</div>
                <div className="team-empty-sub">Your manager hasn't added you to a team yet. Once added, team targets and progress will appear here.</div>

                <div className="team-claim-divider">or</div>
                <div className="team-claim-box">
                  <div className="team-claim-title">Are you the first manager?</div>
                  <div className="team-claim-sub">If no manager exists in the system yet, you can claim the manager role to get started.</div>
                  <button
                    className="team-btn team-btn-solid"
                    onClick={handleClaimManager}
                    disabled={claimingMgr}
                  >
                    {claimingMgr ? "Claiming…" : "Claim Manager Role"}
                  </button>
                </div>
              </>
            )}
          </div>

        ) : (
          /* ── Has team ── */
          <>
            {/* Team hero */}
            <div className="team-hero">
              <div className="team-hero-avatar">{team.name.charAt(0).toUpperCase()}</div>
              <div className="team-hero-info">
                <div className="team-hero-name">{team.name}</div>
                <div className="team-hero-manager">Manager: {team.manager?.split("@")[0] || team.manager}</div>
              </div>
              <div className="team-hero-stats">
                <div className="team-hero-stat">
                  <div className="team-hero-stat-val">{team.members.length}</div>
                  <div className="team-hero-stat-label">Members</div>
                </div>
              </div>
            </div>

            {/* Add member (manager only) */}
            {isManager && (
              <div className="team-card">
                <div className="team-card-title">Add Member</div>
                <form className="team-add-form" onSubmit={handleAddMember}>
                  <input
                    className="team-input"
                    type="email"
                    placeholder="Engineer's email address"
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                  />
                  <button className="team-btn team-btn-solid" type="submit" disabled={adding || !addEmail.trim()}>
                    {adding ? "Adding…" : "Add Member"}
                  </button>
                </form>
              </div>
            )}

            {/* Members list */}
            <div className="team-card">
              <div className="team-card-title">
                <span>Members</span>
                <span style={{ fontWeight: 600, color: "#9CA3AF", textTransform: "none", letterSpacing: 0 }}>
                  {team.members.length} {team.members.length === 1 ? "person" : "people"}
                </span>
              </div>
              <div className="team-members-list">
                {team.members.map(member => {
                  const isMe = member.email === user?.username;
                  const isMgr = member.role === "manager";
                  return (
                    <div key={member.email} className={`team-member-row${isMe ? " team-member-row-me" : ""}`}>
                      <div className={`team-member-avatar ${isMgr ? "team-member-avatar-manager" : "team-member-avatar-engineer"}`}>
                        {(member.username || member.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="team-member-info">
                        <div className="team-member-name">{member.username || member.email}</div>
                        <div className="team-member-email">{member.email}</div>
                      </div>
                      <div className="team-member-badges">
                        {isMe && <span className="team-you-chip">You</span>}
                        <span className={`team-role-pill ${isMgr ? "team-role-pill-manager" : "team-role-pill-engineer"}`}>
                          {isMgr ? "Manager" : "Engineer"}
                        </span>
                        {isManager && !isMe && !isMgr && (
                          <button
                            className="team-promote-btn"
                            onClick={() => handlePromote(member.email)}
                            disabled={promoting === member.email}
                          >
                            {promoting === member.email ? "…" : "Make Manager"}
                          </button>
                        )}
                        {isManager && member.email !== team.manager && (
                          <button
                            className="team-remove-btn"
                            onClick={() => handleRemoveMember(member.email)}
                            disabled={removing === member.email}
                          >
                            {removing === member.email ? "…" : "Remove"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        </div> {/* shared-page-card */}
      </div>
    </div>
  );
}
