import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.js";

const rideStatuses = ["Gepland", "Bevestigd", "Onderweg", "Afgerond"];
const driverOptions = ["Erwin", "Julian", "Gerben"];

function sortRides(list) {
  return [...list].sort((a, b) => {
    const dateCompare = a.ride_date.localeCompare(b.ride_date);
    if (dateCompare !== 0) return dateCompare;
    return a.departure_time.localeCompare(b.departure_time);
  });
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getRideStatusStyle(status) {
  switch (status) {
    case "Gepland":
      return { background: "#f3e8ff", color: "#7c3aed", border: "1px solid #ddd6fe" };
    case "Bevestigd":
      return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
    case "Onderweg":
      return { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" };
    case "Afgerond":
      return { background: "#e5e7eb", color: "#374151", border: "1px solid #d1d5db" };
    default:
      return { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" };
  }
}

function Badge({ children, style }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 800,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 22,
        padding: 20,
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 24px rgba(17,24,39,0.05)",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ color: "#111827", fontWeight: 900, fontSize: 34 }}>{value}</div>
      <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Account aangemaakt. Je kunt nu inloggen.");
        setMode("signin");
      }
    } catch (err) {
      setError(err.message || "Er ging iets mis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #111827 60%, #1f2937 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 24,
        }}
      >
        <div
          style={{
            color: "white",
            padding: 36,
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 22,
              background: "white",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 900,
              marginBottom: 24,
            }}
          >
            D
          </div>

          <h1 style={{ margin: 0, fontSize: 46, lineHeight: 1.05 }}>Dispatch Dashboard</h1>
          <p style={{ color: "#cbd5e1", fontSize: 18, lineHeight: 1.6, marginTop: 18, maxWidth: 520 }}>
            Echte login, gedeelde planning en ritten die online worden opgeslagen.
          </p>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 28,
            padding: 34,
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 900, color: "#111827", marginBottom: 8 }}>
            {mode === "signin" ? "Inloggen" : "Account aanmaken"}
          </div>
          <div style={{ color: "#6b7280", marginBottom: 22 }}>
            Maak eerst jouw 3 accounts aan. Daarna kun je nieuwe aanmeldingen weer uitzetten in Supabase.
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={labelStyle}>
              E-mailadres
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Wachtwoord
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                style={inputStyle}
              />
            </label>

            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? "Bezig..." : mode === "signin" ? "Inloggen" : "Account aanmaken"}
            </button>
          </form>

          {message ? (
            <div
              style={{
                marginTop: 14,
                background: "#ecfdf5",
                color: "#166534",
                border: "1px solid #bbf7d0",
                borderRadius: 14,
                padding: "12px 14px",
                fontWeight: 700,
              }}
            >
              {message}
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                marginTop: 14,
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                borderRadius: 14,
                padding: "12px 14px",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setMessage("");
                setError("");
              }}
              style={secondaryButtonStyle}
            >
              {mode === "signin" ? "Nieuw account maken" : "Terug naar inloggen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RideEditor({ selectedRide, onSave, onDelete, onNew, saving }) {
  function createFormState(ride) {
    return {
      id: ride?.id || null,
      driver_name: ride?.driver_name || driverOptions[0],
      ride_date: ride?.ride_date || "",
      departure_time: ride?.departure_time || "",
      arrival_time: ride?.arrival_time || "",
      pickup_location: ride?.pickup_location || "",
      delivery_location: ride?.delivery_location || "",
      cargo: ride?.cargo || "",
      notes: ride?.notes || "",
      status: ride?.status || "Gepland",
    };
  }

  const [formData, setFormData] = useState(createFormState(selectedRide));

  useEffect(() => {
    setFormData(createFormState(selectedRide));
  }, [selectedRide]);

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (
      !formData.ride_date ||
      !formData.departure_time ||
      !formData.arrival_time ||
      !formData.pickup_location.trim() ||
      !formData.delivery_location.trim() ||
      !formData.cargo.trim()
    ) {
      alert("Vul datum, tijden, van-locatie, naar-locatie en kenteken/chassisnummer in.");
      return;
    }

    onSave({
      id: formData.id,
      driver_name: formData.driver_name,
      ride_date: formData.ride_date,
      departure_time: formData.departure_time,
      arrival_time: formData.arrival_time,
      pickup_location: formData.pickup_location.trim(),
      delivery_location: formData.delivery_location.trim(),
      cargo: formData.cargo.trim(),
      notes: formData.notes.trim(),
      status: formData.status,
    });
  }

  const isEditing = Boolean(selectedRide?.id);

  return (
    <div
      style={{
        background: "white",
        borderRadius: 24,
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 24px rgba(17,24,39,0.05)",
        padding: 22,
        position: "sticky",
        top: 98,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>
            {isEditing ? "Rit bewerken" : "Nieuwe rit"}
          </div>
          <div style={{ color: "#6b7280", marginTop: 4 }}>
            {isEditing ? "Pas de geselecteerde rit aan." : "Voeg direct een nieuwe rit toe."}
          </div>
        </div>

        {isEditing ? (
          <button type="button" onClick={onNew} style={secondaryButtonStyle}>
            Nieuwe rit
          </button>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={labelStyle}>
          Chauffeur
          <select
            value={formData.driver_name}
            onChange={(e) => updateField("driver_name", e.target.value)}
            style={inputStyle}
          >
            {driverOptions.map((driver) => (
              <option key={driver} value={driver}>
                {driver}
              </option>
            ))}
          </select>
        </label>

        <div style={twoColStyle}>
          <label style={labelStyle}>
            Datum
            <input
              type="date"
              value={formData.ride_date}
              onChange={(e) => updateField("ride_date", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Status
            <select
              value={formData.status}
              onChange={(e) => updateField("status", e.target.value)}
              style={inputStyle}
            >
              {rideStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={twoColStyle}>
          <label style={labelStyle}>
            Vertrektijd
            <input
              type="time"
              value={formData.departure_time}
              onChange={(e) => updateField("departure_time", e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Aankomsttijd
            <input
              type="time"
              value={formData.arrival_time}
              onChange={(e) => updateField("arrival_time", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>

        <label style={labelStyle}>
          Van locatie
          <input
            type="text"
            value={formData.pickup_location}
            onChange={(e) => updateField("pickup_location", e.target.value)}
            placeholder="Bijv. Amsterdam"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Naar locatie
          <input
            type="text"
            value={formData.delivery_location}
            onChange={(e) => updateField("delivery_location", e.target.value)}
            placeholder="Bijv. Rotterdam"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Kenteken of chassisnummer
          <input
            type="text"
            value={formData.cargo}
            onChange={(e) => updateField("cargo", e.target.value)}
            placeholder="Bijv. V-123-AB of WVWZZZ..."
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Notities
          <textarea
            value={formData.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Extra instructies of opmerkingen"
            style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" style={primaryButtonStyle} disabled={saving}>
            {saving ? "Opslaan..." : isEditing ? "Wijzigingen opslaan" : "Rit opslaan"}
          </button>

          {isEditing ? (
            <button
              type="button"
              onClick={() => onDelete(selectedRide.id)}
              disabled={saving}
              style={{
                background: "#fee2e2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                borderRadius: 14,
                padding: "12px 16px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Verwijderen
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function RideTable({
  rides,
  selectedRideId,
  onSelectRide,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  driverFilter,
  setDriverFilter,
  dateFilter,
  setDateFilter,
  clearFilters,
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 24,
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 24px rgba(17,24,39,0.05)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 20, borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>Planning</div>
            <div style={{ color: "#6b7280", marginTop: 4 }}>Centrale rittenlijst.</div>
          </div>

          <div style={{ color: "#6b7280", fontWeight: 800 }}>{rides.length} ritten zichtbaar</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr auto",
            gap: 12,
            marginTop: 18,
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op locatie, kenteken, chassisnummer of notities..."
            style={inputStyle}
          />

          <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} style={inputStyle}>
            <option value="all">Alle chauffeurs</option>
            {driverOptions.map((driver) => (
              <option key={driver} value={driver}>
                {driver}
              </option>
            ))}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
            <option value="all">Alle statussen</option>
            {rideStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={inputStyle}
          />

          <button type="button" onClick={clearFilters} style={secondaryButtonStyle}>
            Wissen
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
          <thead>
            <tr style={{ background: "#f9fafb", color: "#6b7280", textAlign: "left" }}>
              <th style={thStyle}>Datum</th>
              <th style={thStyle}>Tijd</th>
              <th style={thStyle}>Chauffeur</th>
              <th style={thStyle}>Van</th>
              <th style={thStyle}>Naar</th>
              <th style={thStyle}>Vervoer</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Notities</th>
            </tr>
          </thead>

          <tbody>
            {rides.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>
                  Geen ritten gevonden binnen deze filters.
                </td>
              </tr>
            ) : (
              rides.map((ride) => {
                const selected = selectedRideId === ride.id;

                return (
                  <tr
                    key={ride.id}
                    onClick={() => onSelectRide(ride)}
                    style={{
                      background: selected ? "#eff6ff" : "white",
                      cursor: "pointer",
                      borderTop: "1px solid #e5e7eb",
                    }}
                  >
                    <td style={tdStyle}>{formatDate(ride.ride_date)}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>
                        {ride.departure_time} → {ride.arrival_time}
                      </div>
                    </td>
                    <td style={tdStyle}>{ride.driver_name}</td>
                    <td style={tdStyle}>{ride.pickup_location || "—"}</td>
                    <td style={tdStyle}>{ride.delivery_location || "—"}</td>
                    <td style={tdStyle}>{ride.cargo}</td>
                    <td style={tdStyle}>
                      <Badge style={getRideStatusStyle(ride.status)}>{ride.status}</Badge>
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          maxWidth: 220,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "#4b5563",
                        }}
                      >
                        {ride.notes || "—"}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dashboard({ session }) {
  const [rides, setRides] = useState([]);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadRides() {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .order("ride_date", { ascending: true })
      .order("departure_time", { ascending: true });

    if (!error) {
      const sorted = sortRides(data || []);
      setRides(sorted);
      if (sorted.length && !selectedRideId) {
        setSelectedRideId(sorted[0].id);
      }
    } else {
      alert(error.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRides();
  }, []);

  async function saveRide(ride) {
    setSaving(true);

    if (ride.id) {
      const { data, error } = await supabase
        .from("rides")
        .update({
          driver_name: ride.driver_name,
          ride_date: ride.ride_date,
          departure_time: ride.departure_time,
          arrival_time: ride.arrival_time,
          pickup_location: ride.pickup_location,
          delivery_location: ride.delivery_location,
          cargo: ride.cargo,
          notes: ride.notes,
          status: ride.status,
        })
        .eq("id", ride.id)
        .select()
        .single();

      if (error) {
        alert(error.message);
      } else if (data) {
        setRides((prev) => sortRides(prev.map((r) => (r.id === data.id ? data : r))));
        setSelectedRideId(data.id);
      }
    } else {
      const { data, error } = await supabase
        .from("rides")
        .insert({
          driver_name: ride.driver_name,
          ride_date: ride.ride_date,
          departure_time: ride.departure_time,
          arrival_time: ride.arrival_time,
          pickup_location: ride.pickup_location,
          delivery_location: ride.delivery_location,
          cargo: ride.cargo,
          notes: ride.notes,
          status: ride.status,
        })
        .select()
        .single();

      if (error) {
        alert(error.message);
      } else if (data) {
        setRides((prev) => sortRides([...prev, data]));
        setSelectedRideId(data.id);
      }
    }

    setSaving(false);
  }

  async function deleteRide(rideId) {
    const ok = window.confirm("Weet je zeker dat je deze rit wilt verwijderen?");
    if (!ok) return;

    setSaving(true);
    const { error } = await supabase.from("rides").delete().eq("id", rideId);

    if (error) {
      alert(error.message);
    } else {
      setRides((prev) => prev.filter((r) => r.id !== rideId));
      setSelectedRideId(null);
    }
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function newRide() {
    setSelectedRideId(null);
  }

  const filteredRides = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rides.filter((ride) => {
      const matchesSearch =
        !q ||
        ride.cargo.toLowerCase().includes(q) ||
        (ride.notes || "").toLowerCase().includes(q) ||
        (ride.pickup_location || "").toLowerCase().includes(q) ||
        (ride.delivery_location || "").toLowerCase().includes(q) ||
        ride.ride_date.toLowerCase().includes(q) ||
        ride.departure_time.toLowerCase().includes(q) ||
        ride.arrival_time.toLowerCase().includes(q) ||
        ride.driver_name.toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || ride.status === statusFilter;
      const matchesDriver = driverFilter === "all" || ride.driver_name === driverFilter;
      const matchesDate = !dateFilter || ride.ride_date === dateFilter;

      return matchesSearch && matchesStatus && matchesDriver && matchesDate;
    });
  }, [rides, search, statusFilter, driverFilter, dateFilter]);

  const selectedRide =
    filteredRides.find((ride) => ride.id === selectedRideId) ||
    rides.find((ride) => ride.id === selectedRideId) ||
    null;

  const today = new Date().toISOString().slice(0, 10);
  const todayRides = rides.filter((r) => r.ride_date === today).length;
  const inProgress = rides.filter((r) => r.status === "Onderweg").length;
  const completed = rides.filter((r) => r.status === "Afgerond").length;

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "Arial, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#0f172a",
          color: "white",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            padding: "18px 24px",
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>Dispatch Dashboard</div>
            <div style={{ color: "#cbd5e1", marginTop: 6 }}>
              Ingelogd als {session.user.email}
            </div>
          </div>

          <button type="button" onClick={signOut} style={darkGhostButtonStyle}>
            Uitloggen
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1500, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard title="Totaal ritten" value={rides.length} sub="Live database" />
          <StatCard title="Ritten vandaag" value={todayRides} sub="Op basis van vandaag" />
          <StatCard title="Onderweg" value={inProgress} sub="Nu actief" />
          <StatCard title="Afgerond" value={completed} sub="Voltooide ritten" />
        </div>

        {loading ? (
          <div style={{ background: "white", padding: 24, borderRadius: 24, border: "1px solid #e5e7eb" }}>
            Laden...
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 24, alignItems: "start" }}>
            <RideTable
              rides={filteredRides}
              selectedRideId={selectedRideId}
              onSelectRide={(ride) => setSelectedRideId(ride.id)}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              driverFilter={driverFilter}
              setDriverFilter={setDriverFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              clearFilters={() => {
                setSearch("");
                setStatusFilter("all");
                setDriverFilter("all");
                setDateFilter("");
              }}
            />

            <RideEditor
              selectedRide={selectedRide}
              onSave={saveRide}
              onDelete={deleteRide}
              onNew={newRide}
              saving={saving}
            />
          </div>
        )}
      </main>
    </div>
  );
}

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  color: "#374151",
  fontSize: 14,
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 15px",
  borderRadius: 14,
  border: "1px solid #d1d5db",
  background: "white",
  fontSize: 15,
  outline: "none",
  color: "#111827",
  fontFamily: "Arial, sans-serif",
};

const primaryButtonStyle = {
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  background: "white",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const darkGhostButtonStyle = {
  background: "transparent",
  color: "white",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const thStyle = {
  padding: "14px 16px",
  fontSize: 13,
  fontWeight: 800,
};

const tdStyle = {
  padding: "14px 16px",
  verticalAlign: "middle",
  color: "#374151",
  fontSize: 14,
};

const twoColStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checkingSession) {
    return <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>Laden...</div>;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <Dashboard session={session} />;
}

export default App;