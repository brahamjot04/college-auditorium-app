import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  where,
  onSnapshot,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

function Home() {
  const [events, setEvents] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);

  // Form State
  const [newEventName, setNewEventName] = useState("");
  const [eventDate, setEventDate] = useState("");

  const navigate = useNavigate();

  // ---------------------------------------------------------
  // 1. DATA FETCHING (Real-time)
  // ---------------------------------------------------------

  // Fetch Events
  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Fetch Pending Users
  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingUsers(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    });
    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------------
  // 2. ACTIONS
  // ---------------------------------------------------------

  // Create a new event
  const createEvent = async (e) => {
    e.preventDefault();
    if (!newEventName || !eventDate) return;

    try {
      await addDoc(collection(db, "events"), {
        name: newEventName,
        date: eventDate,
        createdAt: new Date(),
      });
      // Reset form
      setNewEventName("");
      setEventDate("");
    } catch (err) {
      console.error("Error creating event:", err);
      alert("Failed to create event");
    }
  };

  // Approve a pending user
  const approveUser = async (userId, userEmail) => {
    if (!window.confirm(`Approve admin access for ${userEmail}?`)) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        role: "admin",
      });
    } catch (err) {
      console.error("Error approving user:", err);
      alert("Failed to approve user");
    }
  };

  // Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // Navigate to Seating Plan (We will build this page next)
  const openSeatingPlan = (eventId) => {
    navigate(`/seats/${eventId}`);
  };

  // ---------------------------------------------------------
  // 3. RENDER UI
  // ---------------------------------------------------------
  return (
    <div className="container py-5">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-5 border-bottom pb-3">
        <div>
          <h1 className="fw-bold mb-0">Events Manager</h1>
          <small className="text-muted">College Auditorium Admin Panel</small>
        </div>
        <div className="d-flex gap-2">
          {/* Optional: Add Admin Button if you want it here */}
          <button
            onClick={() => navigate("/register")}
            className="btn btn-outline-primary"
          >
            + Add Admin
          </button>
          <button onClick={handleLogout} className="btn btn-danger">
            Logout
          </button>
        </div>
      </div>

      {/* PENDING APPROVALS (Conditional) */}
      {pendingUsers.length > 0 && (
        <div className="card mb-5 border-warning shadow-sm">
          <div className="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center">
            <span>⚠️ Pending Access Requests</span>
            <span className="badge bg-dark rounded-pill">
              {pendingUsers.length}
            </span>
          </div>
          <ul className="list-group list-group-flush">
            {pendingUsers.map((user) => (
              <li
                key={user.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div>
                  <span className="fw-semibold">{user.email}</span>
                  <span className="text-muted small ms-2">({user.role})</span>
                </div>
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => approveUser(user.id, user.email)}
                >
                  Approve Access
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CREATE EVENT FORM */}
      <div className="card mb-5 border-0 shadow-sm bg-light">
        <div className="card-body">
          <h5 className="card-title fw-bold mb-3">Create New Event</h5>
          <form onSubmit={createEvent} className="row g-3">
            <div className="col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Event Name (e.g. Freshers 2026)"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <input
                type="date"
                className="form-control"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div className="col-md-2 d-grid">
              <button type="submit" className="btn btn-dark">
                Create
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* UPCOMING EVENTS GRID */}
      <h3 className="mb-4 fw-bold text-secondary">Your Events</h3>

      {events.length === 0 ? (
        <div className="text-center py-5 text-muted bg-white rounded border border-dashed">
          <h5>No events found</h5>
          <p>Create your first event above to get started.</p>
        </div>
      ) : (
        <div className="row g-4">
          {events.map((event) => (
            <div key={event.id} className="col-md-6 col-lg-4">
              <div className="card h-100 border-0 shadow-sm hover-shadow transition-all">
                <div className="card-body d-flex flex-col justify-content-between">
                  <div>
                    <h5 className="card-title fw-bold text-primary">
                      {event.name}
                    </h5>
                    <p className="card-text text-muted mb-4">
                      📅 {new Date(event.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="d-grid">
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => openSeatingPlan(event.id)}
                    >
                      Manage Seats
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
