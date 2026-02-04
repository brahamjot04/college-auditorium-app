import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";

function SeatingPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  // State
  const [eventName, setEventName] = useState("Loading...");
  const [bookedSeats, setBookedSeats] = useState({});
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Modal Inputs
  const [studentName, setStudentName] = useState("");
  const [studentContact, setStudentContact] = useState("");

  // ----------------------------------------------------------------
  // 1. EXACT ROW DEFINITIONS
  // ----------------------------------------------------------------
  const ROW_CONFIG = [
    { id: 1, left: [1, 8], right: [9, 16] },
    { id: 2, left: [17, 25], right: [26, 34] },
    { id: 3, left: [34, 43], right: [44, 53] },
    { id: 4, left: [54, 64], right: [65, 75] },
    { id: 5, left: [76, 87], right: [88, 99] },
    { id: 6, left: [100, 111], right: [112, 123] },
    { id: 7, left: [124, 135], right: [136, 147] },
    { id: 8, left: [148, 159], right: [160, 171] },
    { id: 9, left: [172, 183], right: [184, 195] },

    // --- GAP INSERTED BY CODE ---

    { id: 10, left: [196, 207], right: [208, 219] },
    { id: 11, left: [220, 231], right: [232, 243] }, // Contains 230
    { id: 12, left: [244, 255], right: [256, 267] },
    { id: 13, left: [268, 279], right: [280, 291] }, // Contains 285
    { id: 14, left: [292, 303], right: [304, 315] },
    { id: 15, left: [316, 327], right: [328, 339] },
    { id: 16, left: [340, 351], right: [352, 363] },
    { id: 17, left: [364, 375], right: [376, 387] },
    { id: 18, left: [388, 399], right: [400, 411] },
    { id: 19, left: [412, 423], right: [424, 435] },
    { id: 20, left: [436, 447], right: null },
  ];

  // Helper: Handle 34(a) and 34(b)
  const getSeatLabel = (rowId, num) => {
    if (rowId === 2 && num === 34) return "34(a)";
    if (rowId === 3 && num === 34) return "34(b)";
    return num.toString();
  };

  // Helper: Generate seat objects
  const generateSeats = (rowId, range, isRightSide) => {
    if (!range) return [];
    const [start, end] = range;
    let seats = [];
    for (let i = start; i <= end; i++) {
      seats.push({
        row: rowId,
        num: i,
        label: getSeatLabel(rowId, i),
        uniqueId: `seat_${i}_${rowId}`,
        side: isRightSide ? "right" : "left",
      });
    }
    return seats;
  };

  // ----------------------------------------------------------------
  // 2. DATA FETCHING
  // ----------------------------------------------------------------
  useEffect(() => {
    getDoc(doc(db, "events", eventId)).then((docSnap) => {
      if (docSnap.exists()) setEventName(docSnap.data().name);
    });

    const unsubscribe = onSnapshot(
      collection(db, "events", eventId, "seats"),
      (snapshot) => {
        const seatData = {};
        snapshot.forEach((doc) => {
          seatData[doc.id] = doc.data();
        });
        setBookedSeats(seatData);
      },
    );
    return () => unsubscribe();
  }, [eventId]);

  // ----------------------------------------------------------------
  // 3. HANDLERS
  // ----------------------------------------------------------------
  const handleSeatClick = (seat) => {
    // Safety check for blackout seats
    if (seat.num === 230 || seat.num === 285) return;

    if (bookedSeats[seat.uniqueId]) {
      if (
        window.confirm(
          `Release seat ${seat.label} (${bookedSeats[seat.uniqueId].name})?`,
        )
      ) {
        deleteDoc(doc(db, "events", eventId, "seats", seat.uniqueId));
      }
    } else {
      setSelectedSeat(seat);
      setStudentName("");
      setStudentContact("");
    }
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!studentName || !studentContact) return;
    try {
      await setDoc(doc(db, "events", eventId, "seats", selectedSeat.uniqueId), {
        label: selectedSeat.label,
        name: studentName,
        contact: studentContact,
        bookedAt: new Date(),
      });
      setSelectedSeat(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // ----------------------------------------------------------------
  // 4. RENDER UI
  // ----------------------------------------------------------------
  return (
    <div className="container-fluid py-4 bg-light min-vh-100 d-flex flex-column align-items-center">
      {/* HEADER */}
      <div
        className="w-100 d-flex justify-content-between align-items-center mb-4 px-3 sticky-top bg-light py-2 shadow-sm"
        style={{ zIndex: 10 }}
      >
        <button
          onClick={() => navigate("/home")}
          className="btn btn-outline-dark btn-sm"
        >
          ← Back
        </button>
        <h5
          className="fw-bold m-0 text-truncate ms-2 me-2"
          style={{ maxWidth: "200px" }}
        >
          {eventName}
        </h5>
        <div className="d-flex gap-1 small">
          <span className="badge bg-success" style={{ fontSize: "0.7rem" }}>
            Free
          </span>
          <span className="badge bg-danger" style={{ fontSize: "0.7rem" }}>
            Booked
          </span>
          <span className="badge bg-dark" style={{ fontSize: "0.7rem" }}>
            Blocked
          </span>
        </div>
      </div>

      {/* STAGE */}
      <div
        className="bg-dark text-white text-center py-2 mb-4 rounded shadow mx-auto"
        style={{ width: "min(90%, 600px)" }}
      >
        STAGE
      </div>

      {/* --- SCROLL WRAPPER (Fixes Left Cut-off) --- */}
      <div
        className="w-100"
        style={{ overflowX: "auto", paddingBottom: "80px" }}
      >
        {/* INNER CONTAINER (Forces min-width) */}
        <div
          className="d-flex flex-column gap-1 mx-auto"
          style={{
            minWidth: "980px",
            width: "fit-content",
            paddingLeft: "10px",
            paddingRight: "10px",
          }}
        >
          {ROW_CONFIG.map((row) => {
            const leftSeats = generateSeats(row.id, row.left, false);
            const rightSeats = generateSeats(row.id, row.right, true);

            return (
              <React.Fragment key={row.id}>
                <div className="d-flex justify-content-center align-items-center">
                  {/* Row Label */}
                  <div
                    className="text-muted small me-2"
                    style={{ width: "30px", textAlign: "right" }}
                  >
                    R{row.id}
                  </div>

                  {/* LEFT WING */}
                  <div
                    className="d-flex gap-1 justify-content-end"
                    style={{ width: "450px" }}
                  >
                    {leftSeats.map((seat) => (
                      <SeatBox
                        key={seat.uniqueId}
                        seat={seat}
                        isBooked={bookedSeats[seat.uniqueId]}
                        onClick={() => handleSeatClick(seat)}
                        setHover={setHoverInfo}
                      />
                    ))}
                  </div>

                  {/* AISLE */}
                  <div style={{ width: "60px" }}></div>

                  {/* RIGHT WING */}
                  <div
                    className="d-flex gap-1 justify-content-start"
                    style={{ width: "450px" }}
                  >
                    {rightSeats.map((seat) => (
                      <SeatBox
                        key={seat.uniqueId}
                        seat={seat}
                        isBooked={bookedSeats[seat.uniqueId]}
                        onClick={() => handleSeatClick(seat)}
                        setHover={setHoverInfo}
                      />
                    ))}
                  </div>
                </div>

                {/* WALKWAY SEPARATOR */}
                {row.id === 9 && (
                  <div
                    className="w-100 text-center my-4 py-1 bg-secondary text-white small rounded"
                    style={{ opacity: 0.8 }}
                  >
                    WALKWAY
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* TOOLTIP */}
      {hoverInfo && (
        <div
          className="position-absolute bg-dark text-white p-2 rounded shadow text-center"
          style={{
            top: hoverInfo.y,
            left: hoverInfo.x,
            zIndex: 1000,
            pointerEvents: "none",
            transform: "translate(-50%, -100%)",
            marginTop: "-10px",
            minWidth: "150px",
          }}
        >
          <div className="fw-bold">{hoverInfo.data.name}</div>
          <div className="text-warning small">{hoverInfo.data.contact}</div>
        </div>
      )}

      {/* MODAL */}
      {selectedSeat && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">
                    Book Seat {selectedSeat.label}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setSelectedSeat(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={submitBooking}>
                    <div className="mb-3">
                      <label className="form-label">Student Name</label>
                      <input
                        type="text"
                        className="form-control"
                        autoFocus
                        required
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Contact</label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        value={studentContact}
                        onChange={(e) => setStudentContact(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-100">
                      Confirm Booking
                    </button>
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

// ----------------------------------------------------------------
// SUB-COMPONENT: SEAT BOX
// ----------------------------------------------------------------
function SeatBox({ seat, isBooked, onClick, setHover }) {
  // BLACKOUT LOGIC: 230 & 285 (Black box, no click)
  const isBlackedOut = seat.num === 230 || seat.num === 285;

  if (isBlackedOut) {
    return (
      <div
        className="rounded d-flex align-items-center justify-content-center text-white"
        style={{
          width: "30px",
          height: "30px",
          backgroundColor: "#000", // Pure Black
          cursor: "not-allowed",
          fontSize: "10px",
          fontWeight: "bold",
          userSelect: "none",
          boxShadow: "inset 0 0 5px rgba(255,255,255,0.2)",
        }}
        title="Blocked"
      >
        {seat.label}
      </div>
    );
  }

  // STANDARD SEAT
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        if (isBooked) {
          const rect = e.target.getBoundingClientRect();
          setHover({
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY,
            data: isBooked,
          });
        }
      }}
      onMouseLeave={() => setHover(null)}
      className="rounded d-flex align-items-center justify-content-center text-white"
      style={{
        width: "30px",
        height: "30px",
        fontSize: "10px",
        fontWeight: "bold",
        cursor: "pointer",
        backgroundColor: isBooked ? "#dc3545" : "#198754",
        boxShadow: isBooked ? "inset 0 0 5px rgba(0,0,0,0.5)" : "none",
        userSelect: "none",
      }}
    >
      {seat.label}
    </div>
  );
}

export default SeatingPage;
