import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
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
  const [eventsError, setEventsError] = useState("");

  // Create Form State
  const [newEventName, setNewEventName] = useState("");
  const [eventDate, setEventDate] = useState("");

  // Edit Form State
  const [editingEvent, setEditingEvent] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");

  const navigate = useNavigate();

  // ---------------------------------------------------------
  // 1. DATA FETCHING
  // ---------------------------------------------------------
  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "desc"));

    const handleSnapshot = (snapshot) => {
      setEventsError("");
      setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };

    const handleEventsError = (err) => {
      console.error("Failed to fetch ordered events:", err);

      // Fallback: still fetch events without ordering if ordered query fails.
      const fallbackUnsubscribe = onSnapshot(
        collection(db, "events"),
        (snapshot) => {
          setEventsError("");
          setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        },
        (fallbackErr) => {
          console.error("Failed to fetch events:", fallbackErr);
          setEvents([]);
          setEventsError(fallbackErr.message || "Unable to fetch events.");
        },
      );

      return fallbackUnsubscribe;
    };

    let fallbackCleanup = null;
    const unsubscribe = onSnapshot(q, handleSnapshot, (err) => {
      fallbackCleanup = handleEventsError(err);
    });

    return () => {
      unsubscribe();
      if (fallbackCleanup) fallbackCleanup();
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "pending"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setPendingUsers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (err) => {
        console.error("Failed to fetch pending users:", err);
      },
    );

    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------------
  // 2. ACTIONS
  // ---------------------------------------------------------

  // CREATE
  const createEvent = async (e) => {
    e.preventDefault();
    if (!newEventName || !eventDate) return;

    try {
      await addDoc(collection(db, "events"), {
        name: newEventName,
        date: eventDate,
        createdAt: new Date(),
      });
      setNewEventName("");
      setEventDate("");
    } catch (err) {
      alert("Error creating event: " + err.message);
    }
  };

  // DELETE
  const handleDeleteEvent = async (eventId, eventName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${eventName}"?\n\nThis will remove the event from the list. (Note: Student bookings in the database might need manual cleanup if you re-create it).`,
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "events", eventId));
    } catch (err) {
      alert("Error deleting event: " + err.message);
    }
  };

  // PREPARE EDIT
  const openEditModal = (event) => {
    setEditingEvent(event);
    setEditName(event.name);
    setEditDate(event.date);
  };

  // SAVE EDIT
  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editingEvent || !editName || !editDate) return;

    try {
      await updateDoc(doc(db, "events", editingEvent.id), {
        name: editName,
        date: editDate,
      });
      setEditingEvent(null);
    } catch (err) {
      alert("Error updating event: " + err.message);
    }
  };

  // APPROVE USER
  const approveUser = async (userId, userEmail) => {
    if (!window.confirm(`Approve admin access for ${userEmail}?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { role: "admin" });
    } catch (err) {
      alert("Failed to approve user");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
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

      {/* PENDING APPROVALS */}
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
                <span>{user.email}</span>
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => approveUser(user.id, user.email)}
                >
                  Approve
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

      {/* UPCOMING EVENTS LIST */}
      <h3 className="mb-4 fw-bold text-secondary">Your Events</h3>

      {eventsError && (
        <div className="alert alert-danger" role="alert">
          Failed to load events: {eventsError}
        </div>
      )}

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
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h5 className="card-title fw-bold text-primary mb-0">
                      {event.name}
                    </h5>
                    <div className="btn-group">
                      <button
                        onClick={() => openEditModal(event)}
                        className="btn btn-sm btn-outline-secondary"
                        title="Edit Event"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id, event.name)}
                        className="btn btn-sm btn-outline-danger"
                        title="Delete Event"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <p className="card-text text-muted mb-4 flex-grow-1">
                    📅 {new Date(event.date).toLocaleDateString()}
                  </p>

                  {/* BUTTONS: MANAGE SEATS & CHECK-IN */}
                  <div className="d-grid gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/seats/${event.id}`)}
                    >
                      Manage Seats
                    </button>
                    <button
                      className="btn btn-outline-dark"
                      onClick={() => navigate(`/checkin/${event.id}`)}
                    >
                      📋 Gate Check-In
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingEvent && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-secondary text-white">
                  <h5 className="modal-title">Edit Event</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setEditingEvent(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleUpdateEvent}>
                    <div className="mb-3">
                      <label className="form-label">Event Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Event Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => setEditingEvent(null)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-success">
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Home;
