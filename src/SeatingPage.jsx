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
  const [bookingStartSeat, setBookingStartSeat] = useState(""); // NEW
  const [bookingEndSeat, setBookingEndSeat] = useState(""); // NEW

  // Modal Inputs (Blocking)
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  // Modal Inputs (Unblocking)
  const [showUnblockModal, setShowUnblockModal] = useState(false); // NEW
  const [unblockStart, setUnblockStart] = useState(""); // NEW
  const [unblockEnd, setUnblockEnd] = useState(""); // NEW

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

  // -- BLOCK RANGE --
  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    const start = parseInt(blockStart);
    const end = parseInt(blockEnd);

    if (isNaN(start) || isNaN(end) || start > end) {
      alert("Invalid Range");
      return;
    }

    const batch = writeBatch(db);
    let count = 0;

    for (let i = start; i <= end; i++) {
      const rowId = findRowForSeat(i);
      if (rowId) {
        const uniqueId = `seat_${i}_${rowId}`;
        const seatRef = doc(db, "events", eventId, "seats", uniqueId);

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

  // -- UNBLOCK RANGE (NEW) --
  const handleUnblockSubmit = async (e) => {
    e.preventDefault();
    const start = parseInt(unblockStart);
    const end = parseInt(unblockEnd);

    if (isNaN(start) || isNaN(end) || start > end) {
      alert("Invalid Range");
      return;
    }

    const batch = writeBatch(db);
    let count = 0;

    for (let i = start; i <= end; i++) {
      const rowId = findRowForSeat(i);
      if (rowId) {
        const uniqueId = `seat_${i}_${rowId}`;
        const seatRef = doc(db, "events", eventId, "seats", uniqueId);
        // We DELETE the document to unblock it
        batch.delete(seatRef);
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
      alert(`Successfully unblocked range ${start}-${end}`);
      setShowUnblockModal(false);
      setUnblockStart("");
      setUnblockEnd("");
    } else {
      alert("No seats found in range.");
    }
  };

  // -- SEAT CLICK --
  const handleSeatClick = (seat) => {
    const existing = bookedSeats[seat.uniqueId];

    if (existing) {
      // Unbooking/Unblocking Logic
      const action = existing.status === "blocked" ? "Unblock" : "Release";
      const name = existing.name ? `booked by ${existing.name}` : "";

      if (window.confirm(`${action} seat ${seat.label} ${name}?`)) {
        deleteDoc(doc(db, "events", eventId, "seats", seat.uniqueId));
      }
    } else {
      // Open Booking Modal
      setSelectedSeat(seat);
      setBookingStartSeat(seat.num); // Auto-fill start
      setBookingEndSeat(""); // Reset end
      setStudentName("");
      setStudentContact("");
    }
  };

  // -- BOOKING SUBMIT (Updated for Ranges) --
  const submitBooking = async (e) => {
    e.preventDefault();
    if (!studentName || !studentContact || !bookingStartSeat) return;

    const start = parseInt(bookingStartSeat);
    // If end seat is empty, treat it as single seat booking (start to start)
    const end = bookingEndSeat ? parseInt(bookingEndSeat) : start;

    if (start > end) {
      alert("Start seat must be smaller than end seat.");
      return;
    }

    try {
      const batch = writeBatch(db);
      let count = 0;

      for (let i = start; i <= end; i++) {
        const rowId = findRowForSeat(i);
        if (rowId) {
          const uniqueId = `seat_${i}_${rowId}`;
          const seatRef = doc(db, "events", eventId, "seats", uniqueId);

          batch.set(seatRef, {
            label: getSeatLabel(rowId, i),
            name: studentName,
            contact: studentContact,
            status: "booked",
            bookedAt: new Date(),
          });
          count++;
        }
      }

      if (count > 0) {
        await batch.commit();
        setSelectedSeat(null); // Close modal
      } else {
        alert("Invalid seat range.");
      }
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
          {/* Unblock Button */}
          <button
            onClick={() => setShowUnblockModal(true)}
            className="btn btn-outline-danger btn-sm px-2"
          >
            Unblock Range
          </button>
          {/* Block Button */}
          <button
            onClick={() => setShowBlockModal(true)}
            className="btn btn-dark btn-sm px-3"
          >
            Block Range
          </button>

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

      {/* SEATING MAP */}
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
                        data={bookedSeats[seat.uniqueId]}
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

      {/* NEW: UNBLOCK RANGE MODAL */}
      {showUnblockModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">Unblock / Release Range</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowUnblockModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <p className="small text-danger">
                    Warning: This will clear all bookings and blocks in this
                    range.
                  </p>
                  <form onSubmit={handleUnblockSubmit}>
                    <div className="row">
                      <div className="col-6 mb-3">
                        <label className="form-label">Start Number</label>
                        <input
                          type="number"
                          className="form-control"
                          required
                          value={unblockStart}
                          onChange={(e) => setUnblockStart(e.target.value)}
                        />
                      </div>
                      <div className="col-6 mb-3">
                        <label className="form-label">End Number</label>
                        <input
                          type="number"
                          className="form-control"
                          required
                          value={unblockEnd}
                          onChange={(e) => setUnblockEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-danger w-100">
                      Unblock Seats
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BOOKING MODAL (Updated) */}
      {selectedSeat && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">Book Seat(s)</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setSelectedSeat(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={submitBooking}>
                    {/* Range Inputs */}
                    <div className="row">
                      <div className="col-6 mb-2">
                        <label className="form-label small">Start Seat</label>
                        <input
                          type="number"
                          className="form-control"
                          value={bookingStartSeat}
                          onChange={(e) => setBookingStartSeat(e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-6 mb-2">
                        <label className="form-label small">
                          End Seat (Optional)
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          value={bookingEndSeat}
                          onChange={(e) => setBookingEndSeat(e.target.value)}
                          placeholder="Single seat"
                        />
                      </div>
                    </div>
                    <hr className="my-2" />
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
                      {bookingEndSeat
                        ? "Confirm Multi-Booking"
                        : "Confirm Booking"}
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
  const isBlocked = data && data.status === "blocked";
  const isBooked = data && !isBlocked;

  // 2. Admin Blocked
  if (isBlocked) {
    return (
      <div
        onClick={onClick}
        className="seat-base"
        style={{ backgroundColor: "#6c757d", cursor: "pointer" }}
      >
        {seat.label}
      </div>
    );
  }

  // 3. Booked / Available
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
        backgroundColor: isBooked ? "#dc3545" : "#198754",
        cursor: "pointer",
        boxShadow: isBooked ? "inset 0 0 5px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {seat.label}
    </div>
  );
}

// Simple CSS helper
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

if (!document.getElementById("seat-styles")) {
  const style = document.createElement("style");
  style.id = "seat-styles";
  style.innerHTML = seatStyles;
  document.head.appendChild(style);
}

export default SeatingPage;
