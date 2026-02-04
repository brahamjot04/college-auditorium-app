// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./Login";
import Home from "./Home";
import Register from "./Register"; // Import the new component
import SeatingPage from "./SeatingPage"; // We will create this next

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} /> {/* New Route */}
        <Route path="/home" element={<Home />} />
        <Route path="/seats/:eventId" element={<SeatingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
