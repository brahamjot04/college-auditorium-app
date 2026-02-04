// src/Home.jsx
import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

function Home() {
  const [events, setEvents] = useState([]);
  const [newEventName, setNewEventName] = useState("");
  const [eventDate, setEventDate] = useState("");

  // Fetch events real-time
  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

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
      console.error("Error adding event:", err);
    }
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-5">
        <h1 className="fw-bold">Events Manager</h1>
        <button
          className="btn btn-outline-danger"
          onClick={() => {
            /* Add logout logic here later */
          }}
        >
          Logout
        </button>
      </div>

      {/* Create Event Card */}
      <div className="card mb-5 border-0 shadow-sm">
        <div className="card-header bg-white fw-bold">Create New Event</div>
        <div className="card-body">
          <form onSubmit={createEvent} className="row g-3 align-items-end">
            <div className="col-md-6">
              <label className="form-label">Event Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="E.g. Annual Fest 2026"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div className="col-md-2 d-grid">
              <button type="submit" className="btn btn-success">
                Create
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Events List */}
      <h3 className="mb-3">Upcoming Events</h3>
      <div className="row">
        {events.map((event) => (
          <div key={event.id} className="col-md-6 mb-3">
            <div className="card h-100 border-0 shadow-sm hover-shadow">
              <div className="card-body d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="card-title mb-1">{event.name}</h5>
                  <p className="card-text text-muted small">{event.date}</p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => alert("Logic to open " + event.name)}
                >
                  Manage Seats
                </button>
              </div>
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="col-12 text-center text-muted py-5">
            No events found. Create one above!
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
