import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";

function CheckInPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [attendees, setAttendees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Stats
  const totalBooked = attendees.length;
  const totalCheckedIn = attendees.filter((a) => a.hasCheckedIn).length;
  const percentage =
    totalBooked > 0 ? Math.round((totalCheckedIn / totalBooked) * 100) : 0;

  // 1. Fetch Data
  useEffect(() => {
    const q = query(
      collection(db, "events", eventId, "seats"),
      where("status", "==", "booked"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // --- NEW SORTING LOGIC ---
      // We parse the ID "seat_45_3" -> 45 to sort numerically
      list.sort((a, b) => {
        try {
          // ID format is "seat_{number}_{row}"
          const numA = parseInt(a.id.split("_")[1]);
          const numB = parseInt(b.id.split("_")[1]);

          // If numbers are the same (like 34a and 34b), sort by row
          if (numA === numB) {
            const rowA = parseInt(a.id.split("_")[2]);
            const rowB = parseInt(b.id.split("_")[2]);
            return rowA - rowB;
          }
          return numA - numB;
        } catch (e) {
          return 0; // Fallback if ID format is weird
        }
      });

      setAttendees(list);
    });

    return () => unsubscribe();
  }, [eventId]);

  // 2. Handle Check-In Toggle
  const toggleCheckIn = async (attendee) => {
    if (navigator.vibrate) navigator.vibrate(50); // Tactile feedback

    const seatRef = doc(db, "events", eventId, "seats", attendee.id);
    try {
      await updateDoc(seatRef, {
        hasCheckedIn: !attendee.hasCheckedIn,
        checkInTime: new Date(),
      });
    } catch (err) {
      alert("Error updating: " + err.message);
    }
  };

  // 3. Filter Logic
  const filteredList = attendees.filter((person) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      person.name.toLowerCase().includes(searchLower) ||
      person.contact.includes(searchTerm) ||
      person.label.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container-fluid min-vh-100 bg-light px-0">
      {/* --- STICKY HEADER --- */}
      <div
        className="sticky-top bg-white shadow-sm px-3 py-3"
        style={{ zIndex: 1000 }}
      >
        {/* Top Row: Back Button & Stats */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button
            onClick={() => navigate("/home")}
            className="btn btn-outline-secondary btn-sm"
          >
            ← Back
          </button>

          <div className="text-end">
            <h6 className="m-0 fw-bold">Gate Check-In</h6>
            <span
              className={`badge ${percentage === 100 ? "bg-success" : "bg-primary"}`}
            >
              {totalCheckedIn} / {totalBooked} ({percentage}%)
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="input-group input-group-lg">
          <span className="input-group-text bg-light border-end-0">🔍</span>
          <input
            type="text"
            className="form-control border-start-0 bg-light"
            placeholder="Search Name, Phone, Seat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="btn btn-outline-secondary border-start-0"
              onClick={() => setSearchTerm("")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* --- CONTENT GRID --- */}
      <div className="container py-3">
        <div className="row g-3">
          {filteredList.length === 0 ? (
            <div className="col-12 text-center py-5 text-muted">
              <h5>No guests found</h5>
              <p>Try searching for a different name or seat number.</p>
            </div>
          ) : (
            filteredList.map((person) => (
              <div key={person.id} className="col-12 col-md-6 col-lg-4">
                <div
                  className={`card border-0 shadow-sm h-100 transition-all ${person.hasCheckedIn ? "bg-success-subtle border-success" : "bg-white"}`}
                  style={{
                    borderLeft: person.hasCheckedIn
                      ? "5px solid #198754"
                      : "5px solid #6c757d",
                    transition: "transform 0.2s",
                  }}
                >
                  <div className="card-body d-flex justify-content-between align-items-center p-3">
                    {/* Guest Info */}
                    <div className="text-truncate pe-2">
                      <h5 className="fw-bold mb-1 text-truncate">
                        {person.name}
                      </h5>
                      <div className="d-flex flex-column gap-1 text-muted small">
                        <div className="d-flex align-items-center">
                          {/* SEAT NUMBER IS NOW EMPHASIZED */}
                          <span
                            className="badge bg-dark fs-6 me-2"
                            style={{ minWidth: "50px" }}
                          >
                            {person.label}
                          </span>
                          <span className="text-truncate">
                            {person.contact}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div>
                      <button
                        onClick={() => toggleCheckIn(person)}
                        className={`btn btn-lg rounded-circle d-flex align-items-center justify-content-center shadow-sm ${person.hasCheckedIn ? "btn-success" : "btn-white border"}`}
                        style={{ width: "60px", height: "60px" }}
                      >
                        {person.hasCheckedIn ? (
                          <span style={{ fontSize: "1.5rem" }}>✓</span>
                        ) : (
                          <span
                            className="text-muted"
                            style={{ fontSize: "0.8rem" }}
                          >
                            IN
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CheckInPage;
