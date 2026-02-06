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
  writeBatch,
} from "firebase/firestore";

function SeatingPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  // State
  const [eventName, setEventName] = useState("Loading...");
  const [bookedSeats, setBookedSeats] = useState({});
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Modal Inputs (Booking)
  const [studentName, setStudentName] = useState("");
  const [studentContact, setStudentContact] = useState("");

  // Modal Inputs (Blocking)
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  // ----------------------------------------------------------------
  // 1. CONFIGURATION
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
    { id: 10, left: [196, 207], right: [208, 219] },
    { id: 11, left: [220, 231], right: [232, 243] },
    { id: 12, left: [244, 255], right: [256, 267] },
    { id: 13, left: [268, 279], right: [280, 291] },
    { id: 14, left: [292, 303], right: [304, 315] },
    { id: 15, left: [316, 327], right: [328, 339] },
    { id: 16, left: [340, 351], right: [352, 363] },
    { id: 17, left: [364, 375], right: [376, 387] },
    { id: 18, left: [388, 399], right: [400, 411] },
    { id: 19, left: [412, 423], right: [424, 435] },
    { id: 20, left: [436, 447], right: null },
  ];

  // Helper: Find Row ID for a given Seat Number
  const findRowForSeat = (seatNum) => {
    for (const row of ROW_CONFIG) {
      if (
        (row.left && seatNum >= row.left[0] && seatNum <= row.left[1]) ||
        (row.right && seatNum >= row.right[0] && seatNum <= row.right[1])
      ) {
        return row.id;
      }
    }
    return null;
  };

  const getSeatLabel = (rowId, num) => {
    if (rowId === 2 && num === 34) return "34(a)";
    if (rowId === 3 && num === 34) return "34(b)";
    return num.toString();
  };

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
  // 2. DATA
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

  // -- BLOCKING LOGIC --
  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    const start = parseInt(blockStart);
    const end = parseInt(blockEnd);

    if (isNaN(start) || isNaN(end) || start > end) {
      alert("Invalid Range");
      return;
    }

    const batch = writeBatch(db); // Use batch for better performance
    let count = 0;

    for (let i = start; i <= end; i++) {
      const rowId = findRowForSeat(i);
      if (rowId) {
        const uniqueId = `seat_${i}_${rowId}`;
        const seatRef = doc(db, "events", eventId, "seats", uniqueId);

        // We use a special status 'blocked'
        batch.set(seatRef, {
          label: getSeatLabel(rowId, i),
          status: "blocked",
          bookedAt: new Date(),
        });
        count++;
      }
    }

    if (count === 0) {
      alert("No valid seats found in that range.");
    } else {
      await batch.commit();
      setShowBlockModal(false);
      setBlockStart("");
      setBlockEnd("");
    }
  };

  // -- BOOKING LOGIC --
  const handleSeatClick = (seat) => {
    // if (seat.num === 230 || seat.num === 285) return;

    const existing = bookedSeats[seat.uniqueId];

    if (existing) {
      // If it's a BLOCKED seat, allow admin to unblock
      if (existing.status === "blocked") {
        if (window.confirm(`Unblock Seat ${seat.label}?`)) {
          deleteDoc(doc(db, "events", eventId, "seats", seat.uniqueId));
        }
      }
      // If it's a STUDENT booking
      else {
        if (
          window.confirm(
            `Release seat ${seat.label} booked by ${existing.name}?`,
          )
        ) {
          deleteDoc(doc(db, "events", eventId, "seats", seat.uniqueId));
        }
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
        status: "booked", // Standard booking
        bookedAt: new Date(),
      });
      setSelectedSeat(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // ----------------------------------------------------------------
  // 4. RENDER
  // ----------------------------------------------------------------
  return (
    <div className="container-fluid py-4 bg-light min-vh-100 d-flex flex-column align-items-center">
      {/* HEADER */}
      <div
        className="w-100 d-flex justify-content-between align-items-center mb-4 px-3 sticky-top bg-light py-2 shadow-sm"
        style={{ zIndex: 10 }}
      >
        <div className="d-flex align-items-center">
          <button
            onClick={() => navigate("/home")}
            className="btn btn-outline-dark btn-sm me-2"
          >
            ← Back
          </button>
          <h5
            className="fw-bold m-0 text-truncate"
            style={{ maxWidth: "150px" }}
          >
            {eventName}
          </h5>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* NEW BLOCK BUTTON */}
          <button
            onClick={() => setShowBlockModal(true)}
            className="btn btn-dark btn-sm px-3"
          >
            Block Range
          </button>

          {/* Legend */}
          <div className="d-none d-md-flex gap-1 small ms-2">
            <span className="badge bg-success">Free</span>
            <span className="badge bg-danger">Booked</span>
            <span className="badge bg-secondary">Blocked</span>
          </div>
        </div>
      </div>

      {/* STAGE */}
      <div
        className="bg-dark text-white text-center py-2 mb-4 rounded shadow mx-auto"
        style={{ width: "min(90%, 600px)" }}
      >
        STAGE
      </div>

      {/* SCROLL WRAPPER */}
      <div
        className="w-100"
        style={{ overflowX: "auto", paddingBottom: "80px" }}
      >
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
                  <div
                    className="text-muted small me-2"
                    style={{ width: "30px", textAlign: "right" }}
                  >
                    R{row.id}
                  </div>

                  <div
                    className="d-flex gap-1 justify-content-end"
                    style={{ width: "450px" }}
                  >
                    {leftSeats.map((seat) => (
                      <SeatBox
                        key={seat.uniqueId}
                        seat={seat}
                        data={bookedSeats[seat.uniqueId]} // Pass full data object
                        onClick={() => handleSeatClick(seat)}
                        setHover={setHoverInfo}
                      />
                    ))}
                  </div>

                  <div style={{ width: "60px" }}></div>

                  <div
                    className="d-flex gap-1 justify-content-start"
                    style={{ width: "450px" }}
                  >
                    {rightSeats.map((seat) => (
                      <SeatBox
                        key={seat.uniqueId}
                        seat={seat}
                        data={bookedSeats[seat.uniqueId]}
                        onClick={() => handleSeatClick(seat)}
                        setHover={setHoverInfo}
                      />
                    ))}
                  </div>
                </div>

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

      {/* BLOCK RANGE MODAL */}
      {showBlockModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-dark text-white">
                  <h5 className="modal-title">Block Seat Range</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowBlockModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <p className="small text-muted">
                    This will make the selected seats unavailable.
                  </p>
                  <form onSubmit={handleBlockSubmit}>
                    <div className="row">
                      <div className="col-6 mb-3">
                        <label className="form-label">Start Number</label>
                        <input
                          type="number"
                          className="form-control"
                          required
                          value={blockStart}
                          onChange={(e) => setBlockStart(e.target.value)}
                        />
                      </div>
                      <div className="col-6 mb-3">
                        <label className="form-label">End Number</label>
                        <input
                          type="number"
                          className="form-control"
                          required
                          value={blockEnd}
                          onChange={(e) => setBlockEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-dark w-100">
                      Block Seats
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOOKING MODAL */}
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
          <div className="fw-bold">{hoverInfo.data.name || "Blocked"}</div>
          {hoverInfo.data.contact && (
            <div className="text-warning small">{hoverInfo.data.contact}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// SUB-COMPONENT: SEAT BOX
// ----------------------------------------------------------------
function SeatBox({ seat, data, onClick, setHover }) {
  // const isBlackedOut = seat.num === 230 || seat.num === 285;
  const isBlocked = data && data.status === "blocked";
  const isBooked = data && !isBlocked;

  // 1. Permanent Blackout (Structure)
  // if (isBlackedOut) {
  //   return (
  //     <div
  //       className="seat-base"
  //       style={{
  //         backgroundColor: "#000",
  //         cursor: "not-allowed",
  //         boxShadow: "inset 0 0 5px rgba(255,255,255,0.2)",
  //       }}
  //     >
  //       {seat.label}
  //     </div>
  //   );
  // }

  // 2. Admin Blocked (Manual Range)
  if (isBlocked) {
    return (
      <div
        onClick={onClick}
        className="seat-base"
        style={{ backgroundColor: "#6c757d", cursor: "pointer" }} // Gray
      >
        {seat.label}
      </div>
    );
  }

  // 3. Standard Booked / Available
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        if (isBooked) {
          const rect = e.target.getBoundingClientRect();
          setHover({
            x: rect.left + rect.width / 2 + window.scrollX,
            y: rect.top + window.scrollY,
            data: data,
          });
        }
      }}
      onMouseLeave={() => setHover(null)}
      className="seat-base"
      style={{
        backgroundColor: isBooked ? "#dc3545" : "#198754", // Red or Green
        cursor: "pointer",
        boxShadow: isBooked ? "inset 0 0 5px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {seat.label}
    </div>
  );
}

// Simple CSS helper for seats (can be in index.css, but inline for safety here)
const seatStyles = `
  .seat-base {
    width: 30px; 
    height: 30px; 
    border-radius: 4px;
    display: flex;
    align-items: center; 
    justify-content: center;
    color: white;
    font-size: 10px; 
    font-weight: bold;
    user-select: none;
    transition: transform 0.1s;
  }
  .seat-base:active {
    transform: scale(0.95);
  }
`;

// Inject styles dynamically (one-time hack for single file)
if (!document.getElementById("seat-styles")) {
  const style = document.createElement("style");
  style.id = "seat-styles";
  style.innerHTML = seatStyles;
  document.head.appendChild(style);
}

export default SeatingPage;
